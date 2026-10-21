/**
 * 確認ダイアログを Promise で呼び出す仕組み
 *   const ok = await confirm({ title: '削除しますか？', ... });
 *   const which = await choose({ title: '繰り返しの予定', options: [...] });
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

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  danger?: boolean;
}

export interface ChoiceOptions<T extends string> {
  title: string;
  message: ReactNode;
  options: ChoiceOption<T>[];
  kicker?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
type ChooseFn = <T extends string>(opts: ChoiceOptions<T>) => Promise<T | null>;

const ConfirmContext = createContext<{ confirm: ConfirmFn; choose: ChooseFn } | null>(null);

interface Pending {
  title: string;
  message: ReactNode;
  kicker?: string;
  buttons: { value: string; label: string; className: string }[];
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolver = useRef<((v: string | null) => void) | null>(null);

  const open = useCallback((p: Pending) => {
    resolver.current?.(null);
    setPending(p);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirm = useCallback<ConfirmFn>(
    async (o) => {
      const v = await open({
        title: o.title,
        message: o.message,
        kicker: o.kicker,
        buttons: [
          { value: 'cancel', label: o.cancelLabel ?? 'キャンセル', className: 'btn btn--ghost' },
          { value: 'ok', label: o.confirmLabel ?? 'OK', className: `btn ${o.danger ? 'btn--danger' : 'btn--primary'}` },
        ],
      });
      return v === 'ok';
    },
    [open],
  );

  const choose = useCallback(
    async <T extends string>(o: ChoiceOptions<T>): Promise<T | null> => {
      const v = await open({
        title: o.title,
        message: o.message,
        kicker: o.kicker,
        buttons: [
          { value: '__cancel', label: 'キャンセル', className: 'btn btn--ghost' },
          ...o.options.map((opt, i) => ({
            value: opt.value,
            label: opt.label,
            className: `btn ${opt.danger ? 'btn--danger' : i === o.options.length - 1 ? 'btn--primary' : ''}`,
          })),
        ],
      });
      return v && v !== '__cancel' ? (v as T) : null;
    },
    [open],
  ) as ChooseFn;

  const close = (value: string | null) => {
    resolver.current?.(value);
    resolver.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm, choose }}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => close(null)}
        title={pending?.title ?? ''}
        kicker={pending?.kicker ?? 'CONFIRMATION'}
        role="alertdialog"
        width={500}
        footer={
          <>
            {pending?.buttons.map((b, i) => (
              <button key={b.value} type="button" className={b.className} onClick={() => close(b.value === 'cancel' ? null : b.value)} data-autofocus={i === pending.buttons.length - 1 ? true : undefined}>
                {b.label}
              </button>
            ))}
          </>
        }
      >
        <div className="confirm__message">{pending?.message}</div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('ConfirmProvider の内側で使ってください');
  return ctx.confirm;
}

export function useChoose(): ChooseFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('ConfirmProvider の内側で使ってください');
  return ctx.choose;
}
