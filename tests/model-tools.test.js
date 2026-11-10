const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const tool = path.resolve(__dirname, '../tools/models/embed_glb.mjs');
function glb(json) {
  const text = JSON.stringify(json);
  const chunk = Buffer.from(text.padEnd(Math.ceil(text.length / 4) * 4));
  const data = Buffer.alloc(20 + chunk.length);
  data.write('glTF');
  data.writeUInt32LE(2, 4);
  data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(chunk.length, 12);
  data.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(data, 20);
  return data;
}

test('embed preserves GLB bytes and existing asset entries', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'humen-embed-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const input = path.join(temp, 'model.glb');
  const output = path.join(temp, 'model.js');
  const bytes = glb({ asset: { version: '2.0' }, scenes: [{}], scene: 0 });
  fs.writeFileSync(input, bytes);
  const result = spawnSync(process.execPath, [tool, input, 'cannon', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const context = { window: { HUMEN_ASSETS: { previous: 'retained' } } };
  vm.runInNewContext(fs.readFileSync(output, 'utf8'), context);
  assert.equal(context.window.HUMEN_ASSETS.previous, 'retained');
  assert.deepEqual(Buffer.from(context.window.HUMEN_ASSETS.cannon, 'base64'), bytes);
});

test('embed rejects malformed or network-dependent models without writing output', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'humen-invalid-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const input = path.join(temp, 'model.glb');
  const output = path.join(temp, 'model.js');
  const cases = [
    Buffer.from('not a GLB'),
    glb({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] }),
    glb({ asset: { version: '2.0' }, buffers: [{ uri: 'external.bin' }] }),
    glb({ asset: { version: '2.0' }, images: [{ uri: 'texture.png' }] }),
  ];
  for (const bytes of cases) {
    fs.writeFileSync(input, bytes);
    const result = spawnSync(process.execPath, [tool, input, 'qing', output], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid GLB|external resource|compression/);
    assert.equal(fs.existsSync(output), false);
  }
});
