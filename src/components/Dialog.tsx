/**
 * 汎用のダイアログ枠
 * 開くとき：枠線が描かれ、中身が下から浮かび上がる（ENGRAVE + TICK）
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '../state/useFocusTrap';
import { ease } from '../motion/tokens';
import { Icon } from './Icon';
import './Dialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** 装飾用の英字見出し */
  kicker?: string;
  theme?: string;
  role?: 'dialog' | 'alertdialog';
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, kicker, theme, role = 'dialog', width = 560, children, footer }: Props) {
  return <AnimatePresence>{open && <DialogPanel {...{ onClose, title, kicker, theme, role, width, children, footer }} />}</AnimatePresence>;
}

function DialogPanel({ onClose, title, kicker, theme, role, width, children, footer }: Omit<Props, 'open'>) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduce = useReducedMotion();
  useFocusTrap(ref, true, onClose);

  return (
    <motion.div
      className="dialog-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        data-theme={theme}
        className="dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, clipPath: 'inset(0% 0% 100% 0%)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, transition: { duration: 0.2, ease: ease.escapement } }}
        transition={{ duration: 0.45, ease: ease.glide }}
      >
        <span className="dialog__corner dialog__corner--tl" aria-hidden="true" />
        <span className="dialog__corner dialog__corner--br" aria-hidden="true" />
        <header className="dialog__head">
          {kicker && <p className="dialog__kicker">{kicker}</p>}
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <button type="button" className="dialog__close" onClick={onClose} aria-label="閉じる">
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__foot">{footer}</footer>}
      </motion.div>
    </motion.div>
  );
}
