import { useMemo } from 'react';
import type { CalendarEvent, Settings } from '../data/types';
import type { DateKey } from '../lib/date';
import { conflictingIds, eventsOnDate, findConflicts, freeSlots, totalFree } from '../lib/schedule';

/** ある 1 日について、画面で使う計算結果をまとめて返す */
export function useDayData(events: CalendarEvent[], date: DateKey, settings: Settings, nowMin: number | null) {
  return useMemo(() => {
    const day = eventsOnDate(events, date);
    const window = { windowStart: settings.dayStartMin, windowEnd: settings.dayEndMin };
    const conflicts = findConflicts(day);
    const free = freeSlots(day, { ...window, includeBuffers: true, from: nowMin ?? undefined, minLength: 5 });
    return {
      day,
      conflicts,
      conflictMap: conflictingIds(day),
      overlapCount: conflicts.filter((c) => c.kind === 'overlap').length,
      bufferCount: conflicts.filter((c) => c.kind === 'buffer').length,
      /** 余白を含めた、残りの空き（今日なら現在時刻以降） */
      free,
      freeMinutes: free.reduce((s, x) => s + x.minutes, 0),
      /** 活動時間帯全体の空き（余白を含む） */
      freeAllDay: totalFree(day, { ...window, includeBuffers: true }),
      plannedMinutes: day.reduce((s, e) => s + (e.endMin - e.startMin), 0),
    };
  }, [events, date, settings.dayStartMin, settings.dayEndMin, nowMin]);
}
