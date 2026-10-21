import { createEvent, emptyDraft } from '../data/eventModel';
import type { CalendarEvent, EventDraft } from '../data/types';

let n = 0;
/** テスト用の予定を作る（'09:00' 形式で時刻を指定） */
export function ev(start: string, end: string, extra: Partial<EventDraft> & { id?: string } = {}): CalendarEvent {
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const base = createEvent(
    { ...emptyDraft(extra.date ?? '2026-10-21'), title: extra.title ?? `予定${++n}`, startMin: toMin(start), endMin: toMin(end), ...extra },
    new Date(Date.UTC(2026, 0, 1, 0, 0, n)),
  );
  return extra.id ? { ...base, id: extra.id } : base;
}
