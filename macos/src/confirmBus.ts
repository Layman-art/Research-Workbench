import type { ConfirmOptions } from './components/ConfirmDialog';

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export const CONFIRM_EVENT = 'rw:confirm';

/** 弹出应用内确认对话框，返回用户是否确认。替代 window.confirm。 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<ConfirmRequest>(CONFIRM_EVENT, {
        detail: { ...options, resolve },
      }),
    );
  });
}
