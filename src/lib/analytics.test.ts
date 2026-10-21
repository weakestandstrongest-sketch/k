import { describe, expect, it } from 'vitest';
import { dayRecords, summarize } from './analytics';
import { ev } from './testUtils';

describe('振り返りの集計', () => {
  const list = [
    ev('09:00', '10:00', { date: '2026-10-19', category: 'work', status: 'completed', actualMinutes: 75 }),
    ev('10:00', '10:30', { date: '2026-10-19', category: 'meeting', status: 'missed' }),
    ev('13:00', '15:00', { date: '2026-10-20', category: 'work' }),
    ev('13:00', '14:00', { date: '2026-10-25', category: 'study' }),
  ];

  it('予定時間・完了・実績を区別して数える', () => {
    const s = summarize(list, '2026-10-19', '2026-10-25', '2026-10-21');
    expect(s.eventCount).toBe(4);
    expect(s.plannedMinutes).toBe(60 + 30 + 120 + 60);
    expect(s.completedCount).toBe(1);
    expect(s.missedCount).toBe(1);
    // 今日以前で記録のないもの（10/20）のみ。未来の 10/25 は数えない
    expect(s.unrecordedCount).toBe(1);
    expect(s.withActual).toHaveLength(1);
    expect(s.actualMinutesTotal).toBe(75);
    expect(s.plannedMinutesOfActual).toBe(60);
    expect(s.byCategory[0]).toMatchObject({ category: 'work', plannedMinutes: 180, count: 2, completedCount: 1 });
  });

  it('日ごとの記録は予定のある日だけを新しい順に', () => {
    const r = dayRecords(list, '2026-10-01', '2026-10-21');
    expect(r.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-19']);
    expect(r[1]).toMatchObject({ completedCount: 1, recordedCount: 2 });
  });
});
