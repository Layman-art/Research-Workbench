import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MoonHero } from '../components/MoonHero';
import { buildInitialSnapshot } from '../repositories';
import { useStore } from '../stores';

const original = useStore.getState();

describe('MoonHero', () => {
  afterEach(() => useStore.setState(original, true));

  it('navigates to a record type from the distribution legend', () => {
    const snapshot = buildInitialSnapshot();
    useStore.setState({ ...snapshot, phase: 'ready', view: 'dashboard', statusFilter: 'done' });
    const project = snapshot.types.find((type) => type.kind === 'project')!;
    const count = snapshot.records.filter((record) => record.typeId === project.id).length;

    render(<MoonHero />);
    fireEvent.click(screen.getByRole('button', { name: `${project.name}，${count} 条记录` }));

    expect(useStore.getState().view).toBe(project.id);
    expect(useStore.getState().statusFilter).toBe('all');
  });
});
