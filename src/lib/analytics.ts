/**
 * 振り返り（THE CHRONICLE）の集計
 *
 * 「予定時間」と「実績」は厳密に区別します。
 * - 予定時間: 登録された開始〜終了の長さ
 * - 完了: 利用者が「完了」と記録した予定だけ
 * - 実績時間: 利用者が実際の所要時間を入力した予定だけ
 * 記録がないものを推測で埋めることはしません。
 */
import { CATEGORIES } from '../data/categories';
import type { CalendarEvent, CategoryId } from '../data/types';
import { compareDateKeys, rangeKeys, diffDays, type DateKey } from './date';
import { expandRange } from './recurrence';
import { durationOf } from './schedule';

export interface CategoryTotal {
  category: CategoryId;
  plannedMinutes: number;
  count: number;
  completedCount: number;
}

export interface PeriodSummary {
  start: DateKey;
  end: DateKey;
  eventCount: number;
  plannedMinutes: number;
  completedCount: number;
  missedCount: number;
  /** 完了・未実施のどちらも記録されていない（終わった日の）予定 */
  unrecordedCount: number;
  /** 実績時間が記録された予定 */
  withActual: { event: CalendarEvent; planned: number; actual: number }[];
  actualMinutesTotal: number;
  plannedMinutesOfActual: number;
  byCategory: CategoryTotal[];
  sampleCount: number;
}

/** 期間内の予定（繰り返し・日またぎを日ごとに展開したもの） */
export function eventsInRange(events: CalendarEvent[], start: DateKey, end: DateKey): CalendarEvent[] {
  return expandRange(events, start, end);
}

/** 予定時間として数える長さ（終日の予定は時間を占有しないので 0） */
function plannedOf(e: CalendarEvent): number {
  return e.allDay ? 0 : durationOf(e);
}

export function summarize(events: CalendarEvent[], start: DateKey, end: DateKey, today: DateKey): PeriodSummary {
  const list = eventsInRange(events, start, end);
  const byCat = new Map<CategoryId, CategoryTotal>();
  for (const c of CATEGORIES) byCat.set(c.id, { category: c.id, plannedMinutes: 0, count: 0, completedCount: 0 });

  let planned = 0;
  let completed = 0;
  let missed = 0;
  let unrecorded = 0;
  const withActual: PeriodSummary['withActual'] = [];

  for (const e of list) {
    const d = plannedOf(e);
    planned += d;
    const cat = byCat.get(e.category)!;
    cat.plannedMinutes += d;
    cat.count += 1;
    if (e.status === 'completed') {
      completed += 1;
      cat.completedCount += 1;
    } else if (e.status === 'missed') {
      missed += 1;
    } else if (compareDateKeys(e.date, today) <= 0) {
      unrecorded += 1;
    }
    if (e.actualMinutes != null) withActual.push({ event: e, planned: d, actual: e.actualMinutes });
  }

  withActual.sort((a, b) => compareDateKeys(a.event.date, b.event.date) || a.event.startMin - b.event.startMin);

  return {
    start,
    end,
    eventCount: list.length,
    plannedMinutes: planned,
    completedCount: completed,
    missedCount: missed,
    unrecordedCount: unrecorded,
    withActual,
    actualMinutesTotal: withActual.reduce((s, x) => s + x.actual, 0),
    plannedMinutesOfActual: withActual.reduce((s, x) => s + x.planned, 0),
    byCategory: [...byCat.values()].filter((c) => c.count > 0).sort((a, b) => b.plannedMinutes - a.plannedMinutes),
    sampleCount: list.filter((e) => e.isSample).length,
  };
}

export interface DayRecord {
  date: DateKey;
  events: CalendarEvent[];
  plannedMinutes: number;
  completedCount: number;
  recordedCount: number;
}

/** 日ごとの記録（予定のある日だけ、新しい順） */
export function dayRecords(events: CalendarEvent[], start: DateKey, end: DateKey): DayRecord[] {
  const n = diffDays(start, end) + 1;
  if (n <= 0) return [];
  const map = new Map<DateKey, CalendarEvent[]>();
  for (const k of rangeKeys(start, n)) map.set(k, []);
  for (const e of expandRange(events, start, end)) map.get(e.date)?.push(e);
  return [...map.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([date, list]) => ({
      date,
      events: [...list].sort((a, b) => a.startMin - b.startMin),
      plannedMinutes: list.reduce((s, e) => s + plannedOf(e), 0),
      completedCount: list.filter((e) => e.status === 'completed').length,
      recordedCount: list.filter((e) => e.status !== 'planned').length,
    }))
    .sort((a, b) => compareDateKeys(b.date, a.date));
}
