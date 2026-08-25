import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import type { RecordItem, WorkbenchSnapshot } from '../../domain/models';

const FORMULA_PREFIX = /^[=+\-@]/;

function csvSafe(value: unknown): string {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  const neutralized = FORMULA_PREFIX.test(source) ? `'${source}` : source;
  return /[",\r\n]/.test(neutralized) ? `"${neutralized.replaceAll('"', '""')}"` : neutralized;
}

function csvFields(record: RecordItem) {
  return record.fields.map((field) => ({
    ...field,
    value: FORMULA_PREFIX.test(field.value) ? `'${field.value}` : field.value,
  }));
}

function recordMetadata(record: RecordItem): string[] {
  const lines = [
    `- 状态：${record.status}`,
    `- 工作区：${record.workspaceId}`,
    `- 创建：${new Date(record.createdAt).toISOString()}`,
    `- 更新：${new Date(record.updatedAt).toISOString()}`,
  ];
  if (record.dueDate) lines.push(`- 截止：${record.dueDate}`);
  if (record.planDate) lines.push(`- 日程：${record.planDate}`);
  if (record.literature) {
    if (record.literature.authors) lines.push(`- 作者：${record.literature.authors}`);
    if (record.literature.year) lines.push(`- 年份：${record.literature.year}`);
    if (record.literature.doi) lines.push(`- DOI：${record.literature.doi}`);
    if (record.literature.url) lines.push(`- 链接：${record.literature.url}`);
    lines.push(`- 阅读状态：${record.literature.readingStatus}`);
  }
  for (const field of record.fields) lines.push(`- ${field.name || '自定义字段'}：${field.value}`);
  return lines;
}

export function serializeJson(snapshot: WorkbenchSnapshot): string {
  return JSON.stringify(
    { app: 'research-workbench', version: 2, exportedAt: new Date().toISOString(), ...snapshot },
    null,
    2,
  );
}

export function serializeMarkdown(snapshot: WorkbenchSnapshot): string {
  const sections = snapshot.types.flatMap((type) => {
    const records = snapshot.records.filter((record) => record.typeId === type.id);
    if (records.length === 0) return [];
    return [
      `## ${type.name}`,
      ...records.flatMap((record) => [
        `### ${record.title}`,
        recordMetadata(record).join('\n'),
        record.content.trim() || '_无正文_',
      ]),
    ];
  });
  return ['# Research Workbench 导出', '', `导出时间：${new Date().toISOString()}`, '', ...sections, ''].join('\n\n');
}

export function serializeCsv(snapshot: WorkbenchSnapshot): string {
  const typeNames = new Map(snapshot.types.map((type) => [type.id, type.name]));
  const workspaceNames = new Map(snapshot.workspaces.map((workspace) => [workspace.id, workspace.name]));
  const header = [
    'id', 'title', 'type', 'workspace', 'status', 'priority', 'done', 'starred', 'dueDate',
    'planDate', 'projectId', 'content', 'customFields', 'literatureDetails', 'createdAt', 'updatedAt',
  ];
  const rows = snapshot.records.map((record) => [
    record.id,
    record.title,
    typeNames.get(record.typeId) ?? record.typeId,
    workspaceNames.get(record.workspaceId) ?? record.workspaceId,
    record.status,
    record.priority,
    record.done,
    record.starred,
    record.dueDate ?? '',
    record.planDate ?? '',
    record.projectId ?? '',
    record.content,
    csvFields(record),
    record.literature ?? '',
    new Date(record.createdAt).toISOString(),
    new Date(record.updatedAt).toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map(csvSafe).join(',')).join('\r\n') + '\r\n';
}

function preserveRawMarkup(markdown: string): string {
  return markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export async function serializeHtml(snapshot: WorkbenchSnapshot): Promise<string> {
  const markdown = preserveRawMarkup(serializeMarkdown(snapshot));
  const rendered = String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(markdown),
  );
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research Workbench 导出</title><style>body{max-width:880px;margin:40px auto;padding:0 24px;color:#24211b;font:16px/1.75 system-ui,"PingFang SC",sans-serif}h1,h2,h3{font-family:"Songti SC",serif}pre{overflow:auto;background:#17150f;color:#f2edde;padding:16px;border-radius:8px}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 9px}</style></head>
<body>${rendered}</body></html>`;
}
