import type { WorkbenchSnapshot } from '../../domain/models';
import type { DesktopPlatform } from '../../platform/DesktopPlatform';
import { serializeCsv, serializeHtml, serializeJson, serializeMarkdown } from './serializers';

export type ExportFormat = 'json' | 'markdown' | 'csv' | 'html';

const META: Record<ExportFormat, { extension: string; mimeType: string }> = {
  json: { extension: 'json', mimeType: 'application/json' },
  markdown: { extension: 'md', mimeType: 'text/markdown' },
  csv: { extension: 'csv', mimeType: 'text/csv' },
  html: { extension: 'html', mimeType: 'text/html' },
};

export async function exportSnapshot(
  format: ExportFormat,
  snapshot: WorkbenchSnapshot,
  platform: DesktopPlatform,
): Promise<{ status: 'saved'; filename: string } | { status: 'cancelled' }> {
  const contents =
    format === 'json'
      ? serializeJson(snapshot)
      : format === 'markdown'
        ? serializeMarkdown(snapshot)
        : format === 'csv'
          ? serializeCsv(snapshot)
          : await serializeHtml(snapshot);
  const meta = META[format];
  const date = new Date().toISOString().slice(0, 10);
  const suggestedName = `research-workbench-${date}.${meta.extension}`;
  const filename = await platform.saveTextFile({ suggestedName, contents, mimeType: meta.mimeType });
  return filename ? { status: 'saved', filename } : { status: 'cancelled' };
}
