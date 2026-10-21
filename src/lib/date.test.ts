import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  formatDateJa,
  formatDuration,
  formatMinutes,
  isValidDateKey,
  monthGridKeys,
  parseTime,
  startOfWeek,
  toDateKey,
  weekdayOf,
} from './date';

describe('date', () => {
  it('ローカル日付を DateKey に変換する', () => {
    expect(toDateKey(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21');
    expect(toDateKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('日付の加算は月末・年末・うるう年をまたげる', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(diffDays('2026-10-01', '2026-11-01')).toBe(31);
  });

  it('曜日と週の始まり', () => {
    expect(weekdayOf('2026-10-21')).toBe(3); // 水曜日
    expect(startOfWeek('2026-10-21', 0)).toBe('2026-10-18');
    expect(startOfWeek('2026-10-21', 1)).toBe('2026-10-19');
    expect(startOfWeek('2026-10-18', 1)).toBe('2026-10-12');
    const grid = monthGridKeys('2026-10-21', 0);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-27');
  });

  it('不正な日付を検出する', () => {
    expect(isValidDateKey('2026-02-29')).toBe(false);
    expect(isValidDateKey('2028-02-29')).toBe(true);
    expect(isValidDateKey('2026-1-1')).toBe(false);
  });

  it('時刻と所要時間の表記', () => {
    expect(formatMinutes(570)).toBe('09:30');
    expect(formatMinutes(1440)).toBe('24:00');
    expect(parseTime('9:05')).toBe(545);
    expect(parseTime('24:00')).toBe(1440);
    expect(parseTime('24:30')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(formatDuration(90)).toBe('1時間30分');
    expect(formatDuration(45)).toBe('45分');
    expect(formatDuration(120)).toBe('2時間');
    expect(formatDateJa('2026-10-21', { year: true })).toBe('2026年10月21日（水）');
  });
});
