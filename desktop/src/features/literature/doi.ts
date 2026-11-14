export function normalizeDoi(input: string): string | null {
  const value = input.trim().replace(/^doi:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\/\S+$/i.test(value)) return null;
  return value;
}

export function doiUrl(doi: string): string {
  const normalized = normalizeDoi(doi);
  if (!normalized) throw new Error('DOI 格式无效');
  return `https://doi.org/${normalized}`;
}
