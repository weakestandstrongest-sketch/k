/**
 * 時間設計（THE EQUATION）の決定的なルール
 *
 * ルール（いつも同じ入力なら同じ結果になります）:
 *  1. 「固定」の予定、完了・未実施を記録した予定、すでに終わった予定は動かさない。
 *  2. 動かせる予定は開始時刻の早い順に処理し、元の時刻より「前」には動かさない。
 *  3. 他の予定（と必要なら余白）に重ならない、元の時刻以降で最初の時刻へ移す。
 *  4. 活動時間帯の終わりまでに収まらない予定は動かさず「収まらない」と報告する。
 *  5. この関数は提案を作るだけで、保存はしない（適用は利用者の確認後）。
 */
import type { CalendarEvent } from '../data/types';
import { bufferedInterval, coreInterval, findConflicts, overlaps, sortEvents, type Interval } from './schedule';

export interface PlanOptions {
  /** 余白（移動・準備）も重ならないようにする */
  respectBuffers: boolean;
  /** 予定と予定のあいだに最低限あける分数 */
  minGap: number;
  /** 活動時間帯の終わり（これを超える位置には移さない） */
  windowEnd: number;
  /** 今日の場合の現在時刻（分）。これより前に終わった予定は動かさない */
  nowMin?: number | null;
  /** 位置を固定する追加の予定（ドラッグで動かした予定など） */
  pinnedIds?: string[];
}

export interface PlanChange {
  id: string;
  title: string;
  fromStart: number;
  fromEnd: number;
  toStart: number;
  toEnd: number;
}

export interface PlanResult {
  /** 提案後の予定（その日の全予定） */
  events: CalendarEvent[];
  changes: PlanChange[];
  /** 収まらず、動かせなかった予定 */
  unplaced: CalendarEvent[];
  conflictsBefore: number;
  conflictsAfter: number;
}

export function isAnchored(e: CalendarEvent, opts: Pick<PlanOptions, 'nowMin' | 'pinnedIds'>): boolean {
  if (e.fixed) return true;
  if (e.status !== 'planned') return true;
  if (opts.pinnedIds?.includes(e.id)) return true;
  if (opts.nowMin != null && e.startMin < opts.nowMin) return true; // 開始済み・終了済み
  return false;
}

function footprint(e: CalendarEvent, start: number, opts: PlanOptions): Interval {
  const dur = e.endMin - e.startMin;
  const moved = { ...e, startMin: start, endMin: start + dur };
  const base = opts.respectBuffers ? bufferedInterval(moved) : coreInterval(moved);
  return base;
}

function padded(i: Interval, gap: number): Interval {
  return { start: i.start - gap, end: i.end + gap };
}

function countConflicts(events: CalendarEvent[], respectBuffers: boolean): number {
  return findConflicts(events).filter((c) => respectBuffers || c.kind === 'overlap').length;
}

/** その日の予定の重なりを解消する提案を作る */
export function proposeResolution(dayEvents: CalendarEvent[], opts: PlanOptions): PlanResult {
  const sorted = sortEvents(dayEvents);
  const placed: Interval[] = [];
  const result = new Map<string, CalendarEvent>();
  const unplaced: CalendarEvent[] = [];

  // 固定（アンカー）された予定を先に配置
  for (const e of sorted) {
    if (isAnchored(e, opts)) {
      placed.push(footprint(e, e.startMin, opts));
      result.set(e.id, e);
    }
  }

  for (const e of sorted) {
    if (result.has(e.id)) continue;
    const dur = e.endMin - e.startMin;
    const candidateStart = findEarliestStart(e, e.startMin, placed, opts);
    if (candidateStart === null || candidateStart + dur > Math.max(opts.windowEnd, e.endMin) || candidateStart + dur > 1440) {
      // 収まらない：元の位置のまま残す（衝突は残る）
      unplaced.push(e);
      result.set(e.id, e);
      placed.push(footprint(e, e.startMin, opts));
      continue;
    }
    const moved = candidateStart === e.startMin ? e : { ...e, startMin: candidateStart, endMin: candidateStart + dur };
    result.set(e.id, moved);
    placed.push(footprint(moved, moved.startMin, opts));
  }

  const events = sortEvents(sorted.map((e) => result.get(e.id) ?? e));
  const changes: PlanChange[] = [];
  for (const before of sorted) {
    const after = result.get(before.id)!;
    if (after.startMin !== before.startMin) {
      changes.push({
        id: before.id,
        title: before.title,
        fromStart: before.startMin,
        fromEnd: before.endMin,
        toStart: after.startMin,
        toEnd: after.endMin,
      });
    }
  }

  return {
    events,
    changes,
    unplaced: unplaced.filter((u) => conflictsWithPlaced(u, events, opts)),
    conflictsBefore: countConflicts(sorted, opts.respectBuffers),
    conflictsAfter: countConflicts(events, opts.respectBuffers),
  };
}

function conflictsWithPlaced(e: CalendarEvent, events: CalendarEvent[], opts: PlanOptions): boolean {
  const f = padded(footprint(e, e.startMin, opts), opts.minGap);
  return events.some((o) => o.id !== e.id && overlaps(f, footprint(o, o.startMin, opts)));
}

function findEarliestStart(e: CalendarEvent, from: number, placed: Interval[], opts: PlanOptions): number | null {
  const dur = e.endMin - e.startMin;
  let t = from;
  // 衝突がなくなるまで、ぶつかった予定の直後へ進める（有限回で終わる）
  for (let guard = 0; guard < 500; guard++) {
    if (t + dur > 1440) return null;
    const f = padded(footprint(e, t, opts), opts.minGap);
    const hit = placed.filter((p) => overlaps(f, p));
    if (hit.length === 0) return t;
    // ぶつかった区間の終わり + 前余白 + 間隔 が次の候補
    const before = opts.respectBuffers ? e.bufferBeforeMin : 0;
    const next = Math.max(...hit.map((p) => p.end)) + before + opts.minGap;
    t = Math.ceil(next / 5) * 5; // 5分刻みに揃える
  }
  return null;
}

/**
 * ある予定を新しい時刻へ動かしたときの提案。
 * 動かした予定は位置を固定し、ぶつかる後続の予定だけを後ろへ送ります。
 */
export function proposeMove(
  dayEvents: CalendarEvent[],
  movedId: string,
  newStart: number,
  opts: Omit<PlanOptions, 'pinnedIds'>,
): PlanResult {
  const moved = dayEvents.find((e) => e.id === movedId);
  if (!moved) throw new Error('対象の予定が見つかりません');
  const dur = moved.endMin - moved.startMin;
  const shifted = dayEvents.map((e) => (e.id === movedId ? { ...e, startMin: newStart, endMin: newStart + dur } : e));
  const res = proposeResolution(shifted, { ...opts, pinnedIds: [movedId] });
  // 変更の「移動元」は本来の位置にする
  const changes = res.changes.filter((c) => c.id !== movedId);
  changes.unshift({ id: movedId, title: moved.title, fromStart: moved.startMin, fromEnd: moved.endMin, toStart: newStart, toEnd: newStart + dur });
  return { ...res, changes, conflictsBefore: countConflicts(shifted, opts.respectBuffers) };
}
