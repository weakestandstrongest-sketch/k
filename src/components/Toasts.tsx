/** 保存・エラー・衝突などの通知（画面の下／右下に表示） */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useToast, type ToastKind } from '../state/ToastContext';
import { ease } from '../motion/tokens';
import { Icon, type IconName } from './Icon';
import './Toasts.css';

const ICON: Record<ToastKind, IconName> = { success: 'check', error: 'warn', info: 'clock', warning: 'warn' };

export function Toasts() {
  const { toasts, dismiss } = useToast();
  const reduce = useReducedMotion();
  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            className={`toast toast--${t.kind}`}
            role={t.kind === 'error' ? 'alert' : 'status'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scaleX: 0.6 }}
            animate={{ opacity: 1, y: 0, scaleX: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: 0.2 } }}
            transition={{ duration: 0.38, ease: ease.escapement }}
          >
            <span className="toast__seal" aria-hidden="true">
              <Icon name={ICON[t.kind]} size={16} />
            </span>
            <span className="toast__message">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="通知を閉じる">
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
