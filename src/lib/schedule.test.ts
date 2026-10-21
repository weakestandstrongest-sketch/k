import { describe, expect, it } from 'vitest';
import { assignLanes, conflictsFor, findConflicts, freeSlots, nextEvent, timeBreakdown, totalFree } from './schedule';
import { ev } from './testUtils';

describe('衝突の検出', () => {
  it('本体の重なりと、余白だけの重なりを区別する', () => {
    const a = ev('09:00', '10:00', { id: 'a' });
    const b = ev('09:30', '10:30', { id: 'b' });
    const c = ev('11:00', '12:00', { id: 'c', bufferBeforeMin: 30 });
    const d = ev('10:45', '11:00', { id: 'd' }); // c の余白と重なる
    const list = findConflicts([a, b, c, d]);
    expect(list.map((x) => [x.a.id, x.b.id, x.kind])).toEqual([
      ['a', 'b', 'overlap'],
      ['d', 'c', 'buffer'],
    ]);
  });

  it('隣接しているだけの予定は衝突しない', () => {
    expect(findConflicts([ev('09:00', '10:00'), ev('10:00', '11:00')])).toHaveLength(0);
  });

  it('別の日の予定は衝突しない', () => {
    const a = ev('09:00', '10:00', { date: '2026-10-21' });
    expect(conflictsFor({ ...a, id: 'x', date: '2026-10-22' }, [a])).toHaveLength(0);
    expect(conflictsFor({ ...a, id: 'x' }, [a])).toHaveLength(1);
  });
});

describe('空き時間', () => {
  const list = [ev('09:00', '10:00'), ev('09:30', '11:00'), ev('13:00', '14:00', { bufferBeforeMin: 30, bufferAfterMin: 15 })];
  it('活動時間帯のうち予定のない時間を返す', () => {
    const slots = freeSlots(list, { windowStart: 8 * 60, windowEnd: 18 * 60 });
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      [480, 540],
      [660, 780],
      [840, 1080],
    ]);
    expect(totalFree(list, { windowStart: 480, windowEnd: 1080 })).toBe(60 + 120 + 240);
  });
  it('余白を含める・現在時刻以降に限定する', () => {
    const slots = freeSlots(list, { windowStart: 480, windowEnd: 1080, includeBuffers: true, from: 600 });
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      [660, 750],
      [855, 1080],
    ]);
  });
});

describe('列の割り当て', () => {
  it('重なる予定は別の列、重ならなければ 1 列', () => {
    const a = ev('09:00', '10:00', { id: 'a' });
    const b = ev('09:30', '10:30', { id: 'b' });
    const c = ev('10:00', '11:00', { id: 'c' });
    const d = ev('12:00', '13:00', { id: 'd' });
    const lanes = assignLanes([a, b, c, d]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('b')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('c')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('d')).toEqual({ lane: 0, lanes: 1 });
  });
});

describe('次の予定', () => {
  it('進行中の予定を優先し、未実施の予定は除く', () => {
    const a = ev('09:00', '10:00', { id: 'a' });
    const b = ev('11:00', '12:00', { id: 'b', status: 'missed' });
    const c = ev('13:00', '14:00', { id: 'c' });
    expect(nextEvent([a, b, c], 570)).toMatchObject({ ongoing: true, event: { id: 'a' } });
    expect(nextEvent([a, b, c], 600)).toMatchObject({ ongoing: false, event: { id: 'c' } });
    expect(nextEvent([a, b, c], 900)).toBeNull();
  });
});

describe('時間の内訳', () => {
  it('活動時間 = 予定 + 余白 + 空き（重なりは二重に数えない）', () => {
    const list = [ev('09:00', '10:00'), ev('09:30', '10:30'), ev('12:00', '13:00', { bufferBeforeMin: 30 })];
    const b = timeBreakdown(list, 8 * 60, 18 * 60);
    expect(b).toEqual({ window: 600, core: 150, bufferExtra: 30, free: 420 });
    expect(b.core + b.bufferExtra + b.free).toBe(b.window);
  });
});
