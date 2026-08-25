import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownPreview } from '../features/markdown/MarkdownPreview';
import { markdownSummary } from '../features/markdown/plainText';
import { MarkdownEditor } from '../features/markdown/MarkdownEditor';

const source =
  '# 标题\n\n- 列表\n\n```bash\npnpm test\n```\n\n[论文](https://doi.org/10.1000/test)\n<script>alert(1)</script>';

describe('Markdown', () => {
  afterEach(cleanup);

  it('renders GFM content without executing raw HTML and routes HTTPS links externally', () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <MarkdownPreview source={source} onOpenExternal={openExternal} />,
    );

    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByText('pnpm test')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: '论文' }));
    expect(openExternal).toHaveBeenCalledWith('https://doi.org/10.1000/test');
  });

  it('produces a clean and bounded plain-text summary', () => {
    const summary = markdownSummary(source, 20);

    expect(summary).toContain('标题');
    expect(summary).toContain('列表');
    expect(summary).not.toMatch(/#|`|<script>/);
    expect(Array.from(summary)).toHaveLength(20);
  });

  it('switches between a controlled textarea and rendered preview', () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditor value="# 实验记录" onChange={onChange} onOpenExternal={vi.fn()} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '## 新结果' } });
    expect(onChange).toHaveBeenCalledWith('## 新结果');
    fireEvent.click(screen.getByRole('button', { name: '预览' }));
    expect(screen.getByRole('heading', { name: '实验记录' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('preserves single line breaks as <br> (remark-breaks)', () => {
    const { container } = render(
      <MarkdownPreview source={`第一行
第二行`} onOpenExternal={vi.fn()} />,
    );

    expect(container.querySelector('br')).not.toBeNull();
  });

  it('offers a split mode that shows editor and preview side by side', () => {
    render(
      <MarkdownEditor value="# 同步预览" onChange={vi.fn()} onOpenExternal={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '分栏' }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '同步预览' })).toBeInTheDocument();
  });
});
