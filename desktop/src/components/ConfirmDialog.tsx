import { Modal } from './Modal';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

/**
 * 应用内确认对话框（替代原生 window.confirm），
 * 与整体设计风格一致，支持「危险」高亮与自定义文案。
 */
export function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  const settle = (confirmed: boolean) => {
    state.resolve(confirmed);
    onClose();
  };

  return (
    <Modal
      title={state.title ?? '确认操作'}
      onClose={() => settle(false)}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => settle(false)}>
            {state.cancelLabel ?? '取消'}
          </button>
          <button
            className={state.danger ? 'btn btn-danger-solid' : 'btn btn-primary'}
            onClick={() => settle(true)}
          >
            {state.confirmLabel ?? '确认'}
          </button>
        </>
      }
    >
      <p className="confirm-message">{state.message}</p>
    </Modal>
  );
}
