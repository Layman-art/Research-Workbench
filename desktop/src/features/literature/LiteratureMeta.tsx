import { ExternalLink } from 'lucide-react';
import type { LiteratureDetails } from '../../domain/models';
import { doiUrl, normalizeDoi } from './doi';
import { READING_STATUS_LABEL } from './readingStatus';

function httpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function LiteratureMeta({
  details,
  onOpenExternal,
}: {
  details: LiteratureDetails;
  onOpenExternal: (url: string) => void | Promise<void>;
}) {
  const doi = normalizeDoi(details.doi);
  const link = httpsUrl(details.url);
  return (
    <div className="literature-meta">
      <span className={`reading-status reading-${details.readingStatus}`}>
        {READING_STATUS_LABEL[details.readingStatus]}
      </span>
      {(details.authors || details.year) && <span>{[details.authors, details.year].filter(Boolean).join(' · ')}</span>}
      {doi && (
        <button aria-label={`打开 DOI ${doi}`} onClick={() => void onOpenExternal(doiUrl(doi))}>
          DOI {doi} <ExternalLink size={11} />
        </button>
      )}
      {link && (
        <button aria-label="打开文献链接" onClick={() => void onOpenExternal(link)}>
          原文链接 <ExternalLink size={11} />
        </button>
      )}
    </div>
  );
}
