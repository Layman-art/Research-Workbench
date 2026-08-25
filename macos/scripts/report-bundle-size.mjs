import { readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../dist', import.meta.url));
const totals = {
  totalBytes: 0,
  fontBytes: 0,
  javascriptBytes: 0,
  cssBytes: 0,
  fileCount: 0,
  fontFileCount: 0,
};

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }

    const { size } = await stat(path);
    const extension = extname(entry.name);
    totals.totalBytes += size;
    totals.fileCount += 1;

    if (extension === '.woff' || extension === '.woff2') {
      totals.fontBytes += size;
      totals.fontFileCount += 1;
    } else if (extension === '.js') {
      totals.javascriptBytes += size;
    } else if (extension === '.css') {
      totals.cssBytes += size;
    }
  }
}

try {
  await visit(outputDirectory);
  console.log(JSON.stringify(totals, null, 2));
} catch (error) {
  if (error?.code === 'ENOENT') {
    console.error('dist/ 不存在，请先运行 pnpm build。');
    process.exitCode = 1;
  } else {
    throw error;
  }
}
