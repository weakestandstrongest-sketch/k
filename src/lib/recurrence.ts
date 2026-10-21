/**
 * 予定を「日ごとの表示単位（インスタンス）」に展開する
 *
 * 保存されている予定（CalendarEvent）は 1 件でも、
 *  - 繰り返しの予定は、各回に
 *  - 日をまたぐ予定は、日ごとの区切り（初日・途中・最終日）に
 * 分けて扱います。画面と計算はすべてこのインスタンスを使い、
 * 保存は必ず元の予定（baseId）に対して行います。
 *
 * インスタンスの ID は  元のID [@回の開始日] [#その日]  の形です。
 * 繰り返しでも日またぎでもない予定は、元の ID と同じになります。
 */
import type { CalendarEvent, OccurrenceRecord } from '../data/types';
import { addDays, compareDateKeys, diffDays, formatMinutes, formatTimeRange, parseDateKey, startOfWeek, weekdayOf, type DateKey } from './date';

export type Segment = 'single' | 'first' | 'middle' | 'last';

export interface EventInstance extends CalendarEvent {
  /** 元の（保存されている）予定の ID */
  baseId: string;
  /** この回の開始日 */
  occurrence: DateKey;
  /** 日をまたぐ予定の、どの部分か */
  segment: Segment;
  /** 繰り返しの一回か */
  recurring: boolean;
}

export function makeInstanceId(baseId: string, occurrence: DateKey, segDate: DateKey, recurring: boolean, multiDay: boolean): string {
  return `${baseId}${recurring ? `@${occurrence}` : ''}${multiDay ? `#${segDate}` : ''}`;
}

export function parseInstanceId(id: string): { baseId: string; occurrence: DateKey | null; segDate: DateKey | null } {
  const [left, segDate = null] = id.split('#');
  const [baseId, occurrence = null] = left.split('@');
  return { baseId, occurrence, segDate };
}

function monthIndex(key: DateKey): number {
  const { year, month } = parseDateKey(key);
  return year * 12 + month - 1;
}

/** 繰り返しの規則に、その日が当てはまるか（開始日・終了日・例外は別に確認） */
function matchesRule(e: CalendarEvent, d: DateKey): boolean {
  const r = e.repeat;
  if (!r) return d === e.date;
  const base = parseDateKey(e.date);
  const cur = parseDateKey(d);
  switch (r.freq) {
    case 'daily':
      return diffDays(e.date, d) % r.interval === 0;
    case 'weekly': {
      const days = r.weekdays.length > 0 ? r.weekdays : [weekdayOf(e.date)];
      if (!days.includes(weekdayOf(d))) return false;
      const weeks = Math.floor(diffDays(startOfWeek(e.date, 0), startOfWeek(d, 0)) / 7);
      return weeks % r.interval === 0;
    }
    case 'monthly':
      // 31日などがない月は飛ばす（iPhone のカレンダーと同じ考え方）
      return cur.day === base.day && (monthIndex(d) - monthIndex(e.date)) % r.interval === 0;
    case 'yearly':
      return cur.month === base.month && cur.day === base.day && (cur.year - base.year) % r.interval === 0;
  }
}

/** [from, to] と重なる回の「開始日」を列挙する */
export function occurrencesOf(e: CalendarEvent, from: DateKey, to: DateKey): DateKey[] {
  const span = diffDays(e.date, e.endDate);
  if (!e.repeat) {
    return compareDateKeys(e.date, to) <= 0 && compareDateKeys(e.endDate, from) >= 0 ? [e.date] : [];
  }
  const out: DateKey[] = [];
  let d = compareDateKeys(e.date, addDays(from, -span)) > 0 ? e.date : addDays(from, -span);
  const last = e.repeat.until && compareDateKeys(e.repeat.until, to) < 0 ? e.repeat.until : to;
  const exceptions = new Set(e.exceptions);
  for (let guard = 0; compareDateKeys(d, last) <= 0 && guard < 5000; guard++, d = addDays(d, 1)) {
    if (exceptions.has(d)) continue;
    if (matchesRule(e, d)) out.push(d);
  }
  return out;
}

/** 1 つの回を、日ごとのインスタンスにする（[from, to] の範囲だけ） */
function segmentsOf(e: CalendarEvent, occurrence: DateKey, from: DateKey, to: DateKey): EventInstance[] {
  const span = diffDays(e.date, e.endDate);
  const recurring = !!e.repeat;
  const rec: OccurrenceRecord | undefined = recurring ? e.records[occurrence] : undefined;
  const out: EventInstance[] = [];
  for (let k = 0; k <= span; k++) {
    const day = addDays(occurrence, k);
    if (compareDateKeys(day, from) < 0 || compareDateKeys(day, to) > 0) continue;
    const segment: Segment = span === 0 ? 'single' : k === 0 ? 'first' : k === span ? 'last' : 'middle';
    let startMin = e.startMin;
    let endMin = e.endMin;
    if (!e.allDay && span > 0) {
      if (segment === 'first') endMin = 1440;
      else if (segment === 'last') startMin = 0;
      else {
        startMin = 0;
        endMin = 1440;
      }
    }
    out.push({
      ...e,
      id: makeInstanceId(e.id, occurrence, day, recurring, span > 0),
      baseId: e.id,
      occurrence,
      segment,
      recurring,
      date: day,
      endDate: day,
      // 日をまたぐ予定の途中の日は、終日の欄に表示する
      allDay: e.allDay || segment === 'middle',
      startMin: e.allDay ? 0 : startMin,
      endMin: e.allDay ? 1440 : endMin,
      bufferBeforeMin: segment === 'single' || segment === 'first' ? e.bufferBeforeMin : 0,
      bufferAfterMin: segment === 'single' || segment === 'last' ? e.bufferAfterMin : 0,
      status: rec ? rec.status : recurring ? 'planned' : e.status,
      actualMinutes: rec ? rec.actualMinutes : recurring ? null : e.actualMinutes,
    });
  }
  return out;
}

export function sortInstances<T extends CalendarEvent>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      compareDateKeys(a.date, b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      a.startMin - b.startMin ||
      a.endMin - b.endMin ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/** 期間内のすべてのインスタンス（日付順・終日が先） */
export function expandRange(events: CalendarEvent[], from: DateKey, to: DateKey): EventInstance[] {
  const out: EventInstance[] = [];
  for (const e of events) {
    for (const occ of occurrencesOf(e, from, to)) out.push(...segmentsOf(e, occ, from, to));
  }
  return sortInstances(out);
}

/** その日のすべてのインスタンス（終日を含む） */
export function instancesOn(events: CalendarEvent[], date: DateKey): EventInstance[] {
  return expandRange(events, date, date);
}

/** その日の、時間の決まったインスタンス（時間軸・重なり・空き時間の計算用） */
export function timedOn(events: CalendarEvent[], date: DateKey): EventInstance[] {
  return instancesOn(events, date).filter((e) => !e.allDay);
}

/** その日の、終日のインスタンス（日をまたぐ予定の途中の日を含む） */
export function allDayOn(events: CalendarEvent[], date: DateKey): EventInstance[] {
  return instancesOn(events, date).filter((e) => e.allDay);
}

/** インスタンス ID から、そのインスタンス（その回の最初の区切り、または指定の日）を探す */
export function findInstance(events: CalendarEvent[], id: string): EventInstance | null {
  const { baseId, occurrence, segDate } = parseInstanceId(id);
  const base = events.find((e) => e.id === baseId);
  if (!base) return null;
  const occ = occurrence ?? base.date;
  if (base.repeat && !occurrencesOf(base, occ, occ).includes(occ)) return null;
  const span = diffDays(base.date, base.endDate);
  const segs = segmentsOf(base, occ, occ, addDays(occ, span));
  return segs.find((s) => s.date === segDate) ?? segs[0] ?? null;
}

/** インスタンスかどうか */
export function isInstance(e: CalendarEvent): e is EventInstance {
  return typeof (e as EventInstance).baseId === 'string';
}

/** 保存しても安全な、元の予定の形に戻す（日またぎ・繰り返しでない予定専用） */
export function toBase(e: CalendarEvent): CalendarEvent {
  if (!isInstance(e)) return e;
  const { baseId, occurrence: _o, segment: _s, recurring: _r, ...rest } = e;
  void _o;
  void _s;
  void _r;
  return { ...rest, id: baseId };
}

/** 再編成の提案や、ドラッグで「そのまま動かしてよい」単純な予定か */
export function isSimple(e: CalendarEvent): boolean {
  if (!isInstance(e)) return !e.repeat && e.endDate === e.date && !e.allDay;
  return !e.recurring && e.segment === 'single' && !e.allDay;
}

/** ドラッグで時刻を動かせるか（日をまたぐ予定の一部・終日は不可） */
export function canDrag(e: CalendarEvent): boolean {
  if (e.allDay) return false;
  return isInstance(e) ? e.segment === 'single' : e.endDate === e.date;
}

/** 一覧に出す時刻の表記（終日、日をまたぐ予定は「23:00〜」「〜6:30」） */
export function timeLabel(e: CalendarEvent): string {
  if (e.allDay) return '終日';
  if (isInstance(e)) {
    if (e.segment === 'first') return `${formatMinutes(e.startMin)}〜`;
    if (e.segment === 'last') return `〜${formatMinutes(e.endMin)}`;
  }
  return formatTimeRange(e.startMin, e.endMin);
}
