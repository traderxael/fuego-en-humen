// Rebuild the classic-script loader without installing dependencies in the repo.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'humen-gltfloader-'));

try {
  await writeFile(path.join(temp, 'package.json'), '{"private":true}\n');
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
    'install', '--no-save', '--no-package-lock', '--ignore-scripts',
    '--include=optional', '--no-audit', '--no-fund',
    'three@0.160.0', 'esbuild@0.28.2',
  ], {
    cwd: temp,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const requireTemp = createRequire(path.join(temp, 'package.json'));
  const threeRoot = path.dirname(path.dirname(requireTemp.resolve('three')));
  const modules = [
    'examples/jsm/loaders/GLTFLoader.js',
    'examples/jsm/utils/BufferGeometryUtils.js',
  ];
  const names = new Set();
  for (const file of modules) {
    const source = await readFile(path.join(threeRoot, file), 'utf8');
    const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]three['"]/g)];
    if (!imports.length) throw new Error('No Three imports found in ' + file);
    for (const match of imports) {
      for (const binding of match[1].split(',')) {
        const name = binding.trim().split(/\s+as\s+/)[0];
        if (name) names.add(name);
      }
    }
  }

  const shim = path.join(temp, 'three-global-shim.js');
  await writeFile(shim, [
    'const T = globalThis.THREE;',
    "if (!T || T.REVISION !== '160') throw new Error('GLTFLoader requires global THREE r160');",
    ...[...names].sort().map(name => `export const ${name} = T.${name};`),
    '',
  ].join('\n'));
  const entry = path.join(temp, 'entry.js');
  const loaderPath = path.join(threeRoot, modules[0]).split(path.sep).join('/');
  await writeFile(entry,
    `import { GLTFLoader } from ${JSON.stringify(loaderPath)};\n` +
    'globalThis.THREE.GLTFLoader = GLTFLoader;\n');

  // npm's postinstall/.bin wrapper is unnecessary: execute the native optional package.
  const executable = process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild';
  const binary = requireTemp.resolve(`@esbuild/${process.platform}-${process.arch}/${executable}`);
  const output = path.join(temp, 'gltfloader.min.js');
  const license = await readFile(path.join(threeRoot, 'LICENSE'), 'utf8');
  execFileSync(binary, [
    entry, '--bundle', '--format=iife', '--platform=browser', '--target=es2020',
    `--alias:three=${shim}`, '--minify', '--legal-comments=inline',
    `--banner:js=/*! GLTFLoader + BufferGeometryUtils, Three.js r160; esbuild 0.28.2.\n${license.trim()}\n*/`,
    `--outfile=${output}`,
  ], { cwd: temp, stdio: 'inherit' });

  const destination = path.join(root, 'vendor', 'gltfloader.min.js');
  await copyFile(output, destination);
  console.log(`Built ${destination} (${names.size} global THREE bindings).`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
