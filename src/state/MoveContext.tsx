/**
 * 予定を別の時刻へ動かすときの流れ
 *
 *  1. 動かした先で他の予定と重ならない → そのまま保存（「元に戻す」付き）
 *  2. 重なる → 「再編成の確認」を表示して、利用者が選ぶ
 *       a. 後ろの予定を順に送る（提案の比較を表示）
 *       b. 重なったまま動かす
 *       c. やめる
 *  他の予定を黙って上書き・移動することはありません。
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';
import { PlanComparison } from '../components/PlanComparison';
import { draftFromEvent, moveEvent } from '../data/eventModel';
import type { CalendarEvent } from '../data/types';
import { formatDateJa, formatMinutes, minutesOfDay, todayKey } from '../lib/date';
import { proposeMove, type PlanResult } from '../lib/planner';
import { canDrag, isInstance, isSimple, timedOn } from '../lib/recurrence';
import { conflictsFor, eventsOnDate } from '../lib/schedule';
import { useEvents } from './EventsContext';
import { useToast } from './ToastContext';

type RequestMove = (event: CalendarEvent, newStart: number) => Promise<void>;

interface Pending {
  event: CalendarEvent;
  newStart: number;
  before: CalendarEvent[];
  ripple: PlanResult;
  conflictTitles: string[];
}

const MoveContext = createContext<RequestMove | null>(null);

export function MoveProvider({ children }: { children: ReactNode }) {
  const { events, settings, commit, editOccurrence, remove, restore } = useEvents();
  const { push } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);

  const saveWithUndo = useCallback(
    async (updated: CalendarEvent[], originals: CalendarEvent[], message: string) => {
      const ok = await commit(updated);
      if (!ok) return;
      push({
        kind: 'success',
        message,
        action: {
          label: '元に戻す',
          onClick: async () => {
            if (await commit(originals)) push({ kind: 'info', message: '移動を取り消しました。' });
          },
        },
      });
    },
    [commit, push],
  );

  const requestMove = useCallback<RequestMove>(
    async (event, newStart) => {
      const dur = event.endMin - event.startMin;
      const start = Math.max(0, Math.min(1440 - dur, newStart));
      if (start === event.startMin) return;
      // 日をまたぐ・終日の予定はドラッグで動かさない（編集画面で変更）
      if (!canDrag(event)) return;
      const candidate = { ...event, startMin: start, endMin: start + dur };
      const hits = conflictsFor(candidate, timedOn(events, event.date)).filter((c) => c.kind === 'overlap');
      // 繰り返しの一回を動かすと、その回だけが別の予定になる
      if (isInstance(event) && event.recurring) {
        const prevBase = events.find((e) => e.id === event.baseId);
        const detached = await editOccurrence(event, { ...draftFromEvent(prevBase ?? event), date: event.date, endDate: event.date, startMin: start, endMin: start + dur, repeat: null });
        if (!detached || !prevBase) return;
        push({
          kind: hits.length > 0 ? 'info' : 'success',
          message: `${formatDateJa(event.date)}の「${event.title}」だけを ${formatMinutes(start)} に移動しました${hits.length > 0 ? '（重なりがあります）' : ''}。`,
          action: {
            label: '元に戻す',
            onClick: async () => {
              if ((await remove(detached.id)) && (await restore([prevBase]))) push({ kind: 'info', message: '移動を取り消しました。' });
            },
          },
        });
        return;
      }
      if (!isSimple(event)) return;
      if (hits.length === 0) {
        await saveWithUndo([moveEvent(event, start)], [event], `「${event.title}」を ${formatMinutes(event.startMin)} → ${formatMinutes(start)} に移動しました。`);
        return;
      }
      const before = eventsOnDate(events, event.date);
      const ripple = proposeMove(before, event.id, start, {
        respectBuffers: false,
        minGap: 0,
        windowEnd: settings.dayEndMin,
        nowMin: event.date === todayKey() ? minutesOfDay(new Date()) : null,
      });
      setPending({ event, newStart: start, before, ripple, conflictTitles: hits.map((h) => h.event.title) });
    },
    [events, settings.dayEndMin, saveWithUndo, editOccurrence, remove, restore, push],
  );

  const applyRipple = async () => {
    if (!pending) return;
    const { ripple, before, event } = pending;
    const originals = before.filter((b) => ripple.changes.some((c) => c.id === b.id));
    const updated = ripple.changes.map((c) => {
      const orig = originals.find((o) => o.id === c.id)!;
      return moveEvent(orig, c.toStart, new Date(), c.id === event.id ? undefined : `「${event.title}」の移動に合わせて後ろへ送る`);
    });
    setPending(null);
    await saveWithUndo(updated, originals, `${updated.length}件の予定を再編成しました。`);
  };

  const applyOverlap = async () => {
    if (!pending) return;
    const { event, newStart } = pending;
    setPending(null);
    await saveWithUndo([moveEvent(event, newStart)], [event], `「${event.title}」を移動しました（重なりは残っています）。`);
  };

  const others = pending ? pending.ripple.changes.filter((c) => c.id !== pending.event.id).length : 0;

  return (
    <MoveContext.Provider value={requestMove}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title="時間の再編成"
        kicker="REORGANIZATION"
        width={760}
        footer={
          pending && (
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                やめる
              </button>
              <button type="button" className="btn" onClick={applyOverlap}>
                重なったまま移動
              </button>
              <button type="button" className="btn btn--primary" onClick={applyRipple} disabled={others === 0} data-autofocus>
                後ろの予定を{others}件送って移動
              </button>
            </>
          )
        }
      >
        {pending && (
          <div className="reorg">
            <p>
              「{pending.event.title}」を {formatDateJa(pending.event.date)} {formatMinutes(pending.newStart)} に動かすと、
              {pending.conflictTitles.map((t) => `「${t}」`).join('')}と重なります。
            </p>
            <PlanComparison
              before={pending.before}
              result={pending.ripple}
              windowStart={settings.dayStartMin}
              windowEnd={settings.dayEndMin}
              primaryId={pending.event.id}
            />
            <p className="field__hint">固定された予定・記録済みの予定・すでに始まった予定は動かしません。適用するまで何も保存されません。</p>
          </div>
        )}
      </Dialog>
    </MoveContext.Provider>
  );
}

export function useRequestMove(): RequestMove {
  const ctx = useContext(MoveContext);
  if (!ctx) throw new Error('MoveProvider の内側で使ってください');
  return ctx;
}
