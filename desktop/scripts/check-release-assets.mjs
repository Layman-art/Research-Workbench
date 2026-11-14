import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const folder = process.argv[2];
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const files = (await readdir(folder)).filter((file) => /\.(exe|dmg)$/.test(file));
if (!files.length) throw new Error('No installers were produced');
for (const file of files) {
  if (!file.includes(`_${version}_`)) throw new Error(`Installer version missing: ${file}`);
  const { size } = await stat(path.join(folder, file));
  if (size < 100_000) throw new Error(`Installer is unexpectedly small: ${file}`);
  console.log(`${file}: ${(size / 1024 / 1024).toFixed(2)} MiB`);
}
