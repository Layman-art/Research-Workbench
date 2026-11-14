import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { doiUrl, normalizeDoi } from '../features/literature/doi';
import { LiteratureMeta } from '../features/literature/LiteratureMeta';

describe('literature records', () => {
  it('normalizes DOI URLs and prefixes', () => {
    expect(normalizeDoi('https://doi.org/10.1145/123')).toBe('10.1145/123');
    expect(normalizeDoi('doi:10.1145/123')).toBe('10.1145/123');
    expect(normalizeDoi('   ')).toBeNull();
    expect(normalizeDoi('not a doi')).toBeNull();
    expect(doiUrl('10.1145/123')).toBe('https://doi.org/10.1145/123');
  });

  it('renders Chinese reading statuses and opens a validated DOI', () => {
    const onOpen = vi.fn();
    const details = { authors: 'Ada Lovelace', year: 2026, doi: '10.1145/123', url: '', readingStatus: 'reading' as const };
    const { rerender } = render(<LiteratureMeta details={details} onOpenExternal={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '打开 DOI 10.1145/123' }));
    expect(onOpen).toHaveBeenCalledWith('https://doi.org/10.1145/123');
    expect(screen.getByText('在读')).toBeInTheDocument();
    rerender(<LiteratureMeta details={{ ...details, readingStatus: 'unread' }} onOpenExternal={onOpen} />);
    expect(screen.getByText('待读')).toBeInTheDocument();
    rerender(<LiteratureMeta details={{ ...details, readingStatus: 'read' }} onOpenExternal={onOpen} />);
    expect(screen.getByText('已读')).toBeInTheDocument();
  });
});
