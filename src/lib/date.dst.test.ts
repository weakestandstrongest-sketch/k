// 夏時間のあるタイムゾーンでも日付がずれないことを確認する
(globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { addDays, diffDays, toDateKey, weekKeys } from './date';

describe('夏時間の切り替え', () => {
  it('切り替え日をまたいでも 1 日ずつ進む', () => {
    // 2026-03-08 と 2026-11-01 はニューヨークの夏時間切り替え日
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(diffDays('2026-03-01', '2026-03-15')).toBe(14);
    expect(weekKeys('2026-03-10', 0)).toEqual([
      '2026-03-08', '2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14',
    ]);
  });

  it('真夜中直後のローカル時刻を正しい日付にする', () => {
    expect(toDateKey(new Date(2026, 2, 8, 0, 30))).toBe('2026-03-08');
    expect(toDateKey(new Date(2026, 10, 1, 23, 30))).toBe('2026-11-01');
  });
});
