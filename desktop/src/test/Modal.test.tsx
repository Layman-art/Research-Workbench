import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../components/Modal';

describe('Modal close protection', () => {
  afterEach(cleanup);

  it('keeps the modal open when an Escape close request is rejected', async () => {
    const onClose = vi.fn();
    const onRequestClose = vi.fn().mockResolvedValue(false);
    render(
      <Modal title="编辑" onClose={onClose} onRequestClose={onRequestClose}>
        正文
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    await Promise.resolve();

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '编辑' })).toBeInTheDocument();
  });
});
