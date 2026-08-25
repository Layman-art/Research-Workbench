import removeMarkdown from 'remove-markdown';

export function markdownToPlainText(source: string): string {
  const withoutHtml = source.replace(/<[^>]*>/g, ' ');
  return removeMarkdown(withoutHtml, { useImgAltText: true })
    .replace(/\s+/g, ' ')
    .trim();
}

/** 转为纯文本但保留换行（用于卡片正文多行展示）：空白折叠为单个换行，段落间保留空行结构 */
export function markdownToPlainLines(source: string): string {
  const withoutHtml = source.replace(/<[^>]*>/g, ' ');
  const text = removeMarkdown(withoutHtml, { useImgAltText: true });
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function markdownSummary(source: string, maxLength = 160): string {
  const plainText = markdownToPlainText(source);
  const characters = Array.from(plainText);
  if (characters.length <= maxLength) return plainText;
  if (maxLength <= 1) return '…'.slice(0, maxLength);
  return `${characters.slice(0, maxLength - 1).join('')}…`;
}
