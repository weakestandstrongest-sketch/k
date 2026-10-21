/**
 * Screen 3: THE CHAMBER（私室 / 予定の詳細）
 *
 * 選んだ予定がそのまま大きなパネルへ広がり（共有レイアウト）、
 * 深紅の扉が左右に開いて中身が現れます。閉じると元の位置へ戻ります。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { draftFromEvent } from '../data/eventModel';
import type { EventDraft } from '../data/types';
import { formatDateJa } from '../lib/date';
import { ease, t } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import { useConfirm } from '../state/ConfirmContext';
import { useEvents } from '../state/EventsContext';
import { useFocusTrap } from '../state/useFocusTrap';
import { useToast } from '../state/ToastContext';
import { ChamberView } from './ChamberView';
import { EventForm } from './EventForm';
import { Icon } from './Icon';
import './Chamber.css';

export function Chamber() {
  const { chamber, closeChamber, openChamber, setFocusDate } = useApp();
  const { events, create, update, remove, restore, saving } = useEvents();
  const confirm = useConfirm();
  const { push } = useToast();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dirtyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const event = chamber && chamber.mode !== 'new' ? events.find((e) => e.id === chamber.id) : undefined;
  // 共有レイアウトの相手（開いた元の行）は、開いた時点で固定する。
  // 閲覧⇔編集を切り替えても枠が作り直されず、閉じると元の行へ戻る。
  const [layoutKey] = useState(() => (chamber?.mode === 'view' ? chamber.layoutKey : undefined));

  // 開いている予定が他の操作で消えた場合は閉じる
  useEffect(() => {
    if (chamber && chamber.mode !== 'new' && !event) closeChamber();
  }, [chamber, event, closeChamber]);

  const requestClose = async () => {
    if (chamber?.mode !== 'view' && dirtyRef.current) {
      const ok = await confirm({ title: '変更を破棄しますか？', message: '保存していない変更は失われます。', confirmLabel: '破棄する', cancelLabel: '編集に戻る', danger: true });
      if (!ok) return;
    }
    dirtyRef.current = false;
    closeChamber();
  };

  useFocusTrap(ref, true, requestClose);

  // 背景のスクロールを止める
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!chamber) return null;

  const handleSubmit = async (draft: EventDraft) => {
    setBusy(true);
    try {
      if (chamber.mode === 'new') {
        const created = await create(draft);
        if (created) {
          dirtyRef.current = false;
          setFocusDate(created.date);
          push({ kind: 'success', message: `「${created.title}」を${formatDateJa(created.date)}に保存しました。` });
          openChamber({ mode: 'view', id: created.id });
        }
      } else if (event) {
        const saved = await update(event.id, draft);
        if (saved) {
          dirtyRef.current = false;
          push({ kind: 'success', message: '変更を保存しました。' });
          openChamber({ mode: 'view', id: saved.id, layoutKey: undefined });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const ok = await confirm({
      title: 'この予定を削除しますか？',
      message: `「${event.title}」（${formatDateJa(event.date)}）を削除します。削除の直後なら「元に戻す」で復元できます。`,
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    const removed = await remove(event.id);
    if (removed) {
      closeChamber();
      push({
        kind: 'success',
        message: `「${removed.title}」を削除しました。`,
        action: {
          label: '元に戻す',
          onClick: async () => {
            if (await restore([removed])) push({ kind: 'success', message: '予定を復元しました。' });
          },
        },
      });
    }
  };

  const mode = chamber.mode;
  const heading = mode === 'new' ? '新しい予定' : mode === 'edit' ? '予定を編集' : '予定の詳細';

  return (
    <motion.div
      className="chamber-layer"
      data-theme="chamber"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.05 } }}
      transition={{ duration: 0.3 }}
    >
      <div className="chamber-layer__veil" onClick={requestClose} aria-hidden="true" />
      <div ref={ref} className="chamber" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        {/* 共有レイアウト：一覧の行からこの枠へ広がる */}
        {layoutKey && !reduce ? (
          <motion.div layoutId={`shell-${layoutKey}`} className="chamber__shell" transition={t.chamber} />
        ) : (
          <motion.div
            className="chamber__shell"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: ease.glide }}
          />
        )}

        {/* 扉（左右に開く） */}
        {!reduce && (
          <>
            <motion.div
              className="chamber__door chamber__door--l"
              aria-hidden="true"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              exit={{ scaleX: 1, transition: { duration: 0.22, ease: ease.escapement } }}
              transition={{ duration: 0.55, ease: ease.regal, delay: 0.18 }}
            />
            <motion.div
              className="chamber__door chamber__door--r"
              aria-hidden="true"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              exit={{ scaleX: 1, transition: { duration: 0.22, ease: ease.escapement } }}
              transition={{ duration: 0.55, ease: ease.regal, delay: 0.18 }}
            />
          </>
        )}

        <motion.div
          className="chamber__inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.3, delay: reduce ? 0 : 0.22 }}
        >
          <header className="chamber__bar">
            <button type="button" className="chamber__back" onClick={requestClose}>
              <Icon name="prev" size={18} />
              <span>戻る</span>
            </button>
            <div className="chamber__bar-title">
              <p className="kicker">THE CHAMBER</p>
              {mode !== 'view' && (
                <h2 className="chamber__heading" id={titleId}>
                  {heading}
                </h2>
              )}
              {mode === 'view' && <p className="chamber__heading">{heading}</p>}
            </div>
            {mode === 'view' && event && (
              <div className="chamber__tools">
                <button type="button" className="btn btn--small" onClick={() => openChamber({ mode: 'edit', id: event.id })}>
                  <Icon name="edit" size={16} />
                  編集
                </button>
                <button type="button" className="btn btn--small btn--ghost" onClick={handleDelete} aria-label="この予定を削除">
                  <Icon name="trash" size={16} />
                  <span className="chamber__tool-label">削除</span>
                </button>
              </div>
            )}
          </header>

          <div className="chamber__scroll">
            {mode === 'view' && event && <ChamberView event={event} titleId={titleId} onOpenOther={(id) => openChamber({ mode: 'view', id })} />}
            {mode === 'edit' && event && (
              <EventForm
                key={`edit-${event.id}`}
                initial={draftFromEvent(event)}
                eventId={event.id}
                allEvents={events}
                saving={saving || busy}
                submitLabel="変更を保存"
                onSubmit={handleSubmit}
                onCancel={async (dirty) => {
                  if (dirty) {
                    const ok = await confirm({ title: '変更を破棄しますか？', message: '保存していない変更は失われます。', confirmLabel: '破棄する', cancelLabel: '編集に戻る', danger: true });
                    if (!ok) return;
                  }
                  dirtyRef.current = false;
                  openChamber({ mode: 'view', id: event.id });
                }}
              />
            )}
            {mode === 'new' && (
              <EventForm
                key="new"
                initial={chamber.draft}
                allEvents={events}
                saving={saving || busy}
                submitLabel="予定を保存"
                onSubmit={handleSubmit}
                onCancel={async (dirty) => {
                  if (dirty) {
                    const ok = await confirm({ title: '入力内容を破棄しますか？', message: 'この予定は保存されません。', confirmLabel: '破棄する', cancelLabel: '入力に戻る', danger: true });
                    if (!ok) return;
                  }
                  dirtyRef.current = false;
                  closeChamber();
                }}
              />
            )}
          </div>
        </motion.div>
      </div>
      <DirtyTracker onChange={(v) => (dirtyRef.current = v)} />
    </motion.div>
  );
}

/**
 * フォームの「未保存の変更」を Esc／背景クリックでの閉じる操作にも反映するため、
 * フォーム内の入力イベントを監視して汚れフラグを立てる。
 */
function DirtyTracker({ onChange }: { onChange: (dirty: boolean) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest('.evform')) onChange(true);
    };
    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, [onChange]);
  return null;
}
