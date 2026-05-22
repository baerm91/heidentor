import { open } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const checkedAssets = [
  'the_heidentor_in_petronell-carnuntum/scene.bin',
  'the_heidentor_in_petronell-carnuntum/textures/Heidentor_O_u1_v1_baseColor.png',
  'reconstruction_of_the_heidentor/scene.bin',
  'reconstruction_of_the_heidentor/textures/Heidentor_normal.png'
];

async function readHeader(filePath) {
  const file = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(128);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await file.close();
  }
}

const pointerFiles = [];

for (const asset of checkedAssets) {
  const header = await readHeader(join(root, asset));

  if (header.startsWith('version https://git-lfs.github.com/spec/v1')) {
    pointerFiles.push(asset);
  }
}

if (pointerFiles.length > 0) {
  console.error(
    [
      'Git LFS assets were not downloaded before the build.',
      'Enable Git LFS in Vercel: Project Settings -> Git -> Git Large File Storage, then redeploy.',
      '',
      'Pointer files found:',
      ...pointerFiles.map((file) => `- ${file}`)
    ].join('\n')
  );
  process.exit(1);
}
