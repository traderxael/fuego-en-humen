import { readFileSync, writeFileSync } from 'node:fs';

const [input, name, output] = process.argv.slice(2);
if (!input || !output || !['cannon', 'qing'].includes(name)) {
  throw new Error('Usage: node embed_glb.mjs input.glb cannon|qing output.js');
}
const bytes = readFileSync(input);
if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF' ||
    bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length ||
    bytes.readUInt32LE(16) !== 0x4e4f534a || 20 + bytes.readUInt32LE(12) > bytes.length) {
  throw new Error('Invalid GLB header');
}
const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const extensions = [...(json.extensionsUsed || []), ...(json.extensionsRequired || [])];
if (extensions.some((extension) => /draco|meshopt|basisu/.test(extension))) {
  throw new Error('Unsupported compression: export without Draco, Meshopt or BasisU');
}
for (const resource of [...(json.buffers || []), ...(json.images || [])]) {
  if (resource.uri && !resource.uri.startsWith('data:')) {
    throw new Error('GLB contains an external resource');
  }
}
writeFileSync(output, 'window.HUMEN_ASSETS = window.HUMEN_ASSETS || {};\n' +
  'window.HUMEN_ASSETS[' + JSON.stringify(name) + '] = ' + JSON.stringify(bytes.toString('base64')) + ';\n');
console.log('EMBED_OK ' + name + ' ' + bytes.length + ' bytes');
