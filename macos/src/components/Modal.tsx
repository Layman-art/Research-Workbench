import { useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  onRequestClose?: () => boolean | Promise<boolean>;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, onClose, onRequestClose, children, footer }: ModalProps) {
  const attemptClose = useCallback(async () => {
    if (!onRequestClose || (await onRequestClose())) onClose();
  }, [onClose, onRequestClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void attemptClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attemptClose]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && void attemptClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="icon-btn" onClick={() => void attemptClose()} aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
