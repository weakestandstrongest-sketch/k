import { describe, expect, it } from 'vitest';
import { proposeMove, proposeResolution } from './planner';
import { ev } from './testUtils';

const base = { respectBuffers: false, minGap: 0, windowEnd: 23 * 60 };

describe('重なりの解消案', () => {
  it('固定された予定は動かさず、後ろの予定を空きへ送る', () => {
    const a = ev('09:00', '10:00', { id: 'a', fixed: true });
    const b = ev('09:30', '10:30', { id: 'b' });
    const c = ev('10:30', '11:00', { id: 'c' });
    const res = proposeResolution([a, b, c], base);
    expect(res.changes.map((x) => [x.id, x.toStart, x.toEnd])).toEqual([
      ['b', 600, 660],
      ['c', 660, 690],
    ]);
    expect(res.conflictsBefore).toBe(1);
    expect(res.conflictsAfter).toBe(0);
    expect(res.events.find((e) => e.id === 'a')!.startMin).toBe(540);
  });

  it('重なりのない予定は動かさない', () => {
    const res = proposeResolution([ev('09:00', '10:00'), ev('11:00', '12:00')], base);
    expect(res.changes).toHaveLength(0);
  });

  it('余白と最小間隔を考慮する', () => {
    const a = ev('09:00', '10:00', { id: 'a', bufferAfterMin: 15 });
    const b = ev('10:00', '11:00', { id: 'b', bufferBeforeMin: 10 });
    const res = proposeResolution([a, b], { ...base, respectBuffers: true, minGap: 5 });
    // a の後余白 10:15 + b の前余白 10 分 + 間隔 5 分 = 10:30
    expect(res.changes).toEqual([expect.objectContaining({ id: 'b', toStart: 630, toEnd: 690 })]);
  });

  it('活動時間帯に収まらない予定は動かさず報告する', () => {
    const a = ev('21:00', '22:30', { id: 'a', fixed: true });
    const b = ev('22:00', '23:00', { id: 'b' });
    const res = proposeResolution([a, b], base);
    expect(res.changes).toHaveLength(0);
    expect(res.unplaced.map((e) => e.id)).toEqual(['b']);
    expect(res.conflictsAfter).toBe(1);
  });

  it('記録済み・開始済みの予定は動かさない', () => {
    const a = ev('09:00', '10:00', { id: 'a' });
    const b = ev('09:30', '10:30', { id: 'b', status: 'completed' });
    const res = proposeResolution([a, b], { ...base, nowMin: 8 * 60 });
    // b は完了記録があるので固定。a を b の後ろへ
    expect(res.changes).toEqual([expect.objectContaining({ id: 'a', toStart: 630 })]);
    const res2 = proposeResolution([ev('09:00', '10:00', { id: 'x' }), ev('09:30', '10:00', { id: 'y' })], { ...base, nowMin: 9 * 60 + 40 });
    expect(res2.changes).toHaveLength(0);
  });

  it('同じ入力なら同じ提案になる（決定的）', () => {
    const list = [ev('09:00', '10:00', { id: 'a' }), ev('09:00', '10:00', { id: 'b' }), ev('09:15', '09:45', { id: 'c' })];
    const r1 = proposeResolution(list, base);
    const r2 = proposeResolution([...list].reverse(), base);
    expect(r1.changes).toEqual(r2.changes);
  });
});

describe('移動の提案', () => {
  it('動かした予定は固定し、ぶつかる後続だけを送る', () => {
    const a = ev('09:00', '10:00', { id: 'a' });
    const b = ev('11:00', '12:00', { id: 'b' });
    const c = ev('12:00', '13:00', { id: 'c' });
    const res = proposeMove([a, b, c], 'a', 11 * 60 + 30, base);
    expect(res.changes.map((x) => [x.id, x.fromStart, x.toStart])).toEqual([
      ['a', 540, 690],
      ['b', 660, 750],
      ['c', 720, 810],
    ]);
    expect(res.conflictsAfter).toBe(0);
  });
});
