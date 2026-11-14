import { describe, expect, it } from 'vitest';
import { buildInitialSnapshot } from '../repositories';
import { validateImportData } from '../stores/workbenchStore';
import { serializeCsv, serializeHtml, serializeMarkdown, serializeJson } from '../features/export/serializers';

function exportFixture() {
  const snapshot = buildInitialSnapshot();
  snapshot.records = [
    {
      ...snapshot.records[0],
      title: '=SUM(A1:A2), “引号”',
      content: '# 结果\n\n```bash\npnpm test\n```\n\n<script>alert(1)</script>',
      fields: [
        { id: 'a', name: '链接', value: '+危险' },
        { id: 'b', name: '备注', value: '@命令' },
      ],
    },
  ];
  return snapshot;
}

describe('portable export serializers', () => {
  it('quotes RFC 4180 CSV cells and neutralizes spreadsheet formulas', () => {
    const csv = serializeCsv(exportFixture());
    expect(csv).toContain('"\'=SUM(A1:A2), “引号”"');
    expect(csv).toContain("'+危险");
    expect(csv).toContain("'@命令");
    expect(csv).toContain('\r\n');
  });

  it('keeps Markdown source readable and grouped by content type', () => {
    const markdown = serializeMarkdown(exportFixture());
    expect(markdown).toContain('# Research Workbench 导出');
    expect(markdown).toContain('```bash\npnpm test\n```');
  });

  it('produces standalone UTF-8 HTML without executable raw markup', async () => {
    const html = await serializeHtml(exportFixture());
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<h1>结果</h1>');
    expect(html).not.toContain('<script>');
    expect(html).toMatch(/(?:&lt;|&#x3C;)script>alert\(1\)(?:&lt;|&#x3C;)\/script>/);
  });
  it('round trips version 3 backups including trash, file references and activity history', () => {
    const snapshot = exportFixture();
    const record = snapshot.records[0];
    record.deletedAt = Date.now();
    record.attachments = [{ id: 'file-1', name: '实验.txt', path: 'D:/实验/实验.txt', kind: 'file' }];
    snapshot.activities = [{ id: 'event-1', recordId: record.id, recordTitle: record.title, typeId: record.typeId, workspaceId: record.workspaceId, kind: 'deleted', occurredAt: record.deletedAt }];
    const payload = JSON.parse(serializeJson(snapshot));
    expect(payload.version).toBe(3);
    const imported = validateImportData(payload);
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);
    expect(imported.snapshot.records[0].attachments).toEqual(record.attachments);
    expect(imported.snapshot.records[0].deletedAt).toBe(record.deletedAt);
    expect(imported.snapshot.activities).toEqual(snapshot.activities);
    expect(serializeMarkdown(snapshot)).not.toContain(record.title);
    expect(serializeCsv(snapshot)).not.toContain(record.id);
  });

  it('strips executable URL protocols from HTML links and images', async () => {
    const snapshot = exportFixture();
    snapshot.records[0].content = '[click](javascript:alert%281%29) ![image](data:text/html,evil) <img src=x onerror=alert(1)>';
    const html = await serializeHtml(snapshot);
    expect(html).not.toMatch(/(?:href|src)="(?:javascript|data):/);
    expect(html).not.toContain('<img src=x onerror=');
  });

});
