/**
 * 確認ダイアログを Promise で呼び出す仕組み
 *   const ok = await confirm({ title: '削除しますか？', ... });
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  kicker?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={opts !== null}
        onClose={() => close(false)}
        title={opts?.title ?? ''}
        kicker={opts?.kicker ?? 'CONFIRMATION'}
        role="alertdialog"
        theme={opts?.danger ? 'chamber' : undefined}
        width={480}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => close(false)}>
              {opts?.cancelLabel ?? 'キャンセル'}
            </button>
            <button type="button" className={`btn ${opts?.danger ? 'btn--danger' : 'btn--primary'}`} onClick={() => close(true)} data-autofocus>
              {opts?.confirmLabel ?? 'OK'}
            </button>
          </>
        }
      >
        <div className="confirm__message">{opts?.message}</div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('ConfirmProvider の内側で使ってください');
  return ctx;
}
