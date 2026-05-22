import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

const assets = [
  'the_heidentor_in_petronell-carnuntum',
  'reconstruction_of_the_heidentor',
  'heidentor_blueprint.png',
  'heidentor-stations.json',
  'roman_blueprint_bg.png',
  'star_sky_bg.png'
];

await mkdir(dist, { recursive: true });

await Promise.all(
  assets.map((asset) =>
    cp(join(root, asset), join(dist, asset), {
      recursive: true,
      force: true
    })
  )
);
