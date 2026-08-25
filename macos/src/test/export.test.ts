import { describe, expect, it } from 'vitest';
import { buildInitialSnapshot } from '../repositories';
import { serializeCsv, serializeHtml, serializeMarkdown } from '../features/export/serializers';

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
});
