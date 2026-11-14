import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

if (!process.env.CI) throw new Error('Only run against the disposable CI profile');
const [databasePath, executable] = process.argv.slice(2);
const title = '原生长笔记保存回归';
const content = '# 实验记录\n\n' + '记录实验步骤、原始结果与下一步改进。'.repeat(1500) + '\n完整结尾标记';
const draftText = '未命名草稿：退出前立即写入，重新打开后必须能恢复。';
const timeout = setTimeout(() => { console.error('Native smoke test timed out'); process.exit(1); }, 120_000);
let browser;
let page;

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9437', { timeout: 2_000 });
      page = browser.contexts()[0]?.pages()[0];
      if (!page) throw new Error('Native webview is not ready');
      page.setDefaultTimeout(15_000);
      await page.getByRole('button', { name: '工作台总览', exact: true }).waitFor();
      return;
    } catch (error) {
      await browser?.close().catch(() => undefined);
      if (attempt === 39) throw error;
      await pause(500);
    }
  }
}

async function quit(command = 'plugin:event|emit', args = { event: 'workbench:exit-requested', payload: null }) {
  const disconnected = new Promise((resolve) => browser.once('disconnected', resolve));
  await page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args }).catch(() => undefined);
  await Promise.race([disconnected, pause(15_000).then(() => { throw new Error('Native quit did not finish'); })]);
}

function verifyDisk() {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const records = db.prepare('SELECT content FROM records WHERE title = ?').all(title);
    assert.equal(records.length, 1, 'retry must never duplicate the note');
    assert.equal(records[0].content, content, 'committed content must survive process restart');
    const drafts = db.prepare('SELECT payload FROM drafts').all().map((row) => JSON.parse(row.payload));
    assert.ok(drafts.some((draft) => draft.content === draftText), 'pending untitled draft must survive quit');
  } finally { db.close(); }
}

async function openNote() {
  await page.locator('.sidebar').getByRole('button', { name: /心得笔记/ }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  return page.getByRole('dialog');
}

try {
  await connect();
  await page.locator('.sidebar').getByRole('button', { name: /心得笔记/ }).click();
  await page.locator('.topbar').getByRole('button', { name: /新建/ }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('给这条记录起个名字').fill(title);
  await dialog.locator('textarea.markdown-source').fill(content);
  await dialog.getByRole('button', { name: '展开编辑区' }).click();
  // CI desktop resolution and Windows DPI affect CSS pixels; check usable width.
  await page.waitForFunction(() => {
    const editor = document.querySelector('.record-editor-expanded');
    return editor && editor.getBoundingClientRect().width >= window.innerWidth - 48;
  });
  await dialog.getByRole('button', { name: '创建记录', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  console.log('Native UI: long note committed.');
  await page.locator('.topbar').getByRole('button', { name: /新建/ }).click();
  await page.getByRole('dialog').locator('textarea.markdown-source').fill(draftText);
  // No 500 ms debounce wait: exercise the real native exit -> draft flush handshake.
  await quit();
  verifyDisk();
  console.log('Native UI: quit flushed pending draft and preserved the full note.');
  spawn(executable, ['--hidden'], { windowsHide: true, stdio: 'ignore', env: process.env }).unref();
  await connect();
  dialog = await openNote();
  assert.equal(await dialog.locator('textarea.markdown-source').inputValue(), content);
  await dialog.getByRole('button', { name: '关闭', exact: true }).first().click();
  await page.locator('.sidebar').getByRole('button', { name: '工作台总览', exact: true }).click();
  await page.getByRole('button', { name: /未命名草稿/ }).click();
  await page.getByRole('button', { name: '恢复草稿', exact: true }).click();
  assert.equal(await page.getByRole('dialog').locator('textarea.markdown-source').inputValue(), draftText);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).first().click();
  await page.getByRole('button', { name: '保留草稿并关闭', exact: true }).click();
  console.log('Native UI: note and untitled draft recovered after restart.');
  const backup = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('create_backup', { reason: 'native-smoke' }));
  dialog = await openNote();
  await dialog.locator('textarea.markdown-source').fill('修改后的内容，应被所选备份恢复。');
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.evaluate((name) => window.__TAURI_INTERNALS__.invoke('restore_backup', { name }), backup.name);
  await quit('finish_exit', { restart: true });
  await connect();
  verifyDisk();
  console.log('Native UI: backup restored the note and draft after another restart.');
  dialog = await openNote();
  assert.equal(await dialog.locator('textarea.markdown-source').inputValue(), content);
  await mkdir('desktop/test-results/native', { recursive: true });
  await page.screenshot({ path: 'desktop/test-results/native/restored-note.png' });
  await dialog.getByRole('button', { name: '关闭', exact: true }).first().click();
  await quit();
  console.log('Native WebView2 passed: long note, immediate quit, untitled draft recovery, database backup and restart restore.');
} catch (error) {
  await mkdir('desktop/test-results/native', { recursive: true });
  await page?.screenshot({ path: 'desktop/test-results/native/failure.png' }).catch(() => undefined);
  throw error;
} finally {
  clearTimeout(timeout);
  await browser?.close().catch(() => undefined);
}
