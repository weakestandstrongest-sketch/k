/**
 * 時間計算（純粋関数）
 * - 重なり（衝突）の検出
 * - 空き時間の計算
 * - 重なった予定を横に並べるための列（レーン）割り当て
 */
import type { CalendarEvent } from '../data/types';
import type { DateKey } from './date';

export interface Interval {
  start: number;
  end: number;
}

/** 予定本体の時間 */
export function coreInterval(e: Pick<CalendarEvent, 'startMin' | 'endMin'>): Interval {
  return { start: e.startMin, end: e.endMin };
}

/** 移動・準備の余白を含めた時間（0〜1440 に収める） */
export function bufferedInterval(
  e: Pick<CalendarEvent, 'startMin' | 'endMin' | 'bufferBeforeMin' | 'bufferAfterMin'>,
): Interval {
  return {
    start: Math.max(0, e.startMin - e.bufferBeforeMin),
    end: Math.min(1440, e.endMin + e.bufferAfterMin),
  };
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function durationOf(e: Pick<CalendarEvent, 'startMin' | 'endMin'>): number {
  return e.endMin - e.startMin;
}

export function eventsOnDate(events: CalendarEvent[], date: DateKey): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.date === date));
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/** 区間の和集合（ソート済み・重なりなし） */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

export function totalMinutes(intervals: Interval[]): number {
  return mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}

// ---------- 衝突 ----------

export type ConflictKind = 'overlap' | 'buffer';

export interface Conflict {
  a: CalendarEvent;
  b: CalendarEvent;
  /** overlap: 予定本体どうしが重なる / buffer: 余白（移動・準備）だけが重なる */
  kind: ConflictKind;
  /** 重なっている区間 */
  start: number;
  end: number;
}

/** 同じ日の予定どうしの衝突をすべて列挙する */
export function findConflicts(dayEvents: CalendarEvent[]): Conflict[] {
  const list = sortEvents(dayEvents);
  const out: Conflict[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.date !== b.date) continue;
      const ca = coreInterval(a);
      const cb = coreInterval(b);
      if (overlaps(ca, cb)) {
        out.push({ a, b, kind: 'overlap', start: Math.max(ca.start, cb.start), end: Math.min(ca.end, cb.end) });
        continue;
      }
      const ba = bufferedInterval(a);
      const bb = bufferedInterval(b);
      if (overlaps(ba, bb)) {
        out.push({ a, b, kind: 'buffer', start: Math.max(ba.start, bb.start), end: Math.min(ba.end, bb.end) });
      }
    }
  }
  return out;
}

/** ある候補（新規・移動後）の予定が、他の予定と衝突するか */
export function conflictsFor(
  candidate: Pick<CalendarEvent, 'id' | 'date' | 'startMin' | 'endMin' | 'bufferBeforeMin' | 'bufferAfterMin'>,
  allEvents: CalendarEvent[],
): { event: CalendarEvent; kind: ConflictKind }[] {
  const out: { event: CalendarEvent; kind: ConflictKind }[] = [];
  const core = coreInterval(candidate);
  const buf = bufferedInterval(candidate);
  for (const e of allEvents) {
    if (e.id === candidate.id || e.date !== candidate.date) continue;
    if (overlaps(core, coreInterval(e))) out.push({ event: e, kind: 'overlap' });
    else if (overlaps(buf, bufferedInterval(e))) out.push({ event: e, kind: 'buffer' });
  }
  return out;
}

/** 衝突している予定の ID の集合 */
export function conflictingIds(dayEvents: CalendarEvent[]): Map<string, ConflictKind> {
  const map = new Map<string, ConflictKind>();
  for (const c of findConflicts(dayEvents)) {
    for (const e of [c.a, c.b]) {
      if (map.get(e.id) !== 'overlap') map.set(e.id, c.kind);
    }
  }
  return map;
}

// ---------- 空き時間 ----------

export interface FreeSlot extends Interval {
  minutes: number;
}

export interface FreeTimeOptions {
  windowStart: number;
  windowEnd: number;
  /** 余白（移動・準備）も「埋まっている時間」として扱う */
  includeBuffers?: boolean;
  /** この時刻より前は数えない（今日の「残り」の計算用） */
  from?: number;
  /** これより短い空きは除外 */
  minLength?: number;
}

export function freeSlots(dayEvents: CalendarEvent[], opts: FreeTimeOptions): FreeSlot[] {
  const start = Math.max(opts.windowStart, opts.from ?? 0);
  const end = opts.windowEnd;
  if (end <= start) return [];
  const busy = mergeIntervals(dayEvents.map((e) => (opts.includeBuffers ? bufferedInterval(e) : coreInterval(e))));
  const slots: FreeSlot[] = [];
  let cursor = start;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start >= end) break;
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, end), minutes: Math.min(b.start, end) - cursor });
    cursor = Math.max(cursor, b.end);
    if (cursor >= end) break;
  }
  if (cursor < end) slots.push({ start: cursor, end, minutes: end - cursor });
  const min = opts.minLength ?? 1;
  return slots.filter((s) => s.minutes >= min);
}

export function totalFree(dayEvents: CalendarEvent[], opts: FreeTimeOptions): number {
  return freeSlots(dayEvents, opts).reduce((s, x) => s + x.minutes, 0);
}

// ---------- 列（レーン）割り当て ----------

export interface LaneInfo {
  lane: number;
  lanes: number;
}

/**
 * 重なる予定を左右に並べるための列番号を計算する。
 * 連鎖的に重なる予定のまとまり（クラスター）ごとに列数を決めます。
 */
export function assignLanes(dayEvents: CalendarEvent[]): Map<string, LaneInfo> {
  const list = sortEvents(dayEvents);
  const result = new Map<string, LaneInfo>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const e of list) {
    if (e.startMin >= clusterEnd && cluster.length > 0) flush();
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.endMin);
    } else {
      laneEnds[lane] = e.endMin;
    }
    cluster.push({ id: e.id, lane });
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  if (cluster.length) flush();
  return result;
}

/** 今日のうち、次に始まる（または進行中の）予定 */
export function nextEvent(dayEvents: CalendarEvent[], nowMin: number): { event: CalendarEvent; ongoing: boolean } | null {
  const sorted = sortEvents(dayEvents);
  const ongoing = sorted.find((e) => e.startMin <= nowMin && e.endMin > nowMin && e.status !== 'missed');
  if (ongoing) return { event: ongoing, ongoing: true };
  const upcoming = sorted.find((e) => e.startMin > nowMin && e.status !== 'missed');
  return upcoming ? { event: upcoming, ongoing: false } : null;
}

export function clampMinutes(min: number): number {
  return Math.max(0, Math.min(1440, min));
}

export function snapMinutes(min: number, step = 15): number {
  return Math.round(min / step) * step;
}

/** 活動時間帯の内訳：予定本体・余白（本体と重ならない部分）・空き */
export function timeBreakdown(dayEvents: CalendarEvent[], windowStart: number, windowEnd: number) {
  const clip = (i: Interval): Interval => ({ start: Math.max(windowStart, i.start), end: Math.min(windowEnd, i.end) });
  const window = Math.max(0, windowEnd - windowStart);
  const core = totalMinutes(dayEvents.map((e) => clip(coreInterval(e))));
  const buffered = totalMinutes(dayEvents.map((e) => clip(bufferedInterval(e))));
  return { window, core, bufferExtra: buffered - core, free: window - buffered };
}
