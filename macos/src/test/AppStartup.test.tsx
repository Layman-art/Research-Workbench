import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStartup } from '../components/AppStartup';
import { useStore } from '../stores';

describe('AppStartup', () => {
  const original = useStore.getState();

  afterEach(() => {
    cleanup();
    useStore.setState(original, true);
  });

  it('hydrates once and keeps application content behind the loading state', () => {
    const hydrate = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ phase: 'loading', hydrate });

    render(
      <AppStartup>
        <div>工作台内容</div>
      </AppStartup>,
    );

    expect(screen.getByText('正在打开科研工作台…')).toBeInTheDocument();
    expect(screen.queryByText('工作台内容')).not.toBeInTheDocument();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('shows the persisted error and allows retrying initialization', () => {
    const hydrate = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ phase: 'error', error: 'database locked', hydrate });

    render(
      <AppStartup>
        <div>工作台内容</div>
      </AppStartup>,
    );

    expect(screen.getByText('database locked')).toBeInTheDocument();
    screen.getByRole('button', { name: '重试' }).click();
    expect(hydrate).toHaveBeenCalledTimes(2);
  });
});
