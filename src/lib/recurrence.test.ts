import { describe, expect, it } from 'vitest';
import { allDayOn, expandRange, findInstance, occurrencesOf, parseInstanceId, timedOn } from './recurrence';
import { ev } from './testUtils';

describe('繰り返しの展開', () => {
  it('毎週（複数の曜日・隔週・終了日・例外）', () => {
    const e = ev('10:00', '11:00', {
      id: 'w',
      date: '2026-10-05', // 月曜
      repeat: { freq: 'weekly', interval: 2, weekdays: [1, 3], until: '2026-11-04' },
    });
    const withEx = { ...e, exceptions: ['2026-10-21'] };
    expect(occurrencesOf(withEx, '2026-10-01', '2026-11-30')).toEqual(['2026-10-05', '2026-10-07', '2026-10-19', '2026-11-02', '2026-11-04']);
  });

  it('毎日・毎月（31日のない月は飛ばす）・毎年（うるう日）', () => {
    const d = ev('09:00', '09:30', { date: '2026-10-30', repeat: { freq: 'daily', interval: 3, weekdays: [], until: null } });
    expect(occurrencesOf(d, '2026-10-29', '2026-11-06')).toEqual(['2026-10-30', '2026-11-02', '2026-11-05']);
    const m = ev('09:00', '09:30', { date: '2026-01-31', repeat: { freq: 'monthly', interval: 1, weekdays: [], until: null } });
    expect(occurrencesOf(m, '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);
    const y = ev('09:00', '09:30', { date: '2028-02-29', repeat: { freq: 'yearly', interval: 1, weekdays: [], until: null } });
    expect(occurrencesOf(y, '2028-01-01', '2033-12-31')).toEqual(['2028-02-29', '2032-02-29']);
  });

  it('各回の記録は回ごとに分かれる', () => {
    const e = ev('09:00', '10:00', { id: 'r', date: '2026-10-19', repeat: { freq: 'daily', interval: 1, weekdays: [], until: null } });
    const withRec = { ...e, records: { '2026-10-20': { status: 'completed' as const, actualMinutes: 50 } } };
    const list = expandRange([withRec], '2026-10-19', '2026-10-21');
    expect(list.map((x) => [x.id, x.status, x.actualMinutes])).toEqual([
      ['r@2026-10-19', 'planned', null],
      ['r@2026-10-20', 'completed', 50],
      ['r@2026-10-21', 'planned', null],
    ]);
  });
});

describe('日をまたぐ予定・終日の予定', () => {
  it('夜をまたぐ予定は日ごとに区切られる', () => {
    const e = ev('23:00', '06:30', { id: 'n', date: '2026-10-21', endDate: '2026-10-22' });
    expect(timedOn([e], '2026-10-21').map((x) => [x.id, x.startMin, x.endMin, x.segment])).toEqual([['n#2026-10-21', 1380, 1440, 'first']]);
    expect(timedOn([e], '2026-10-22').map((x) => [x.id, x.startMin, x.endMin, x.segment])).toEqual([['n#2026-10-22', 0, 390, 'last']]);
  });

  it('3 日以上の予定の途中の日は終日の欄に入る', () => {
    const e = ev('18:00', '10:00', { id: 't', date: '2026-10-21', endDate: '2026-10-23' });
    expect(allDayOn([e], '2026-10-22').map((x) => x.segment)).toEqual(['middle']);
    expect(timedOn([e], '2026-10-22')).toHaveLength(0);
  });

  it('終日の予定は時間軸に入らない', () => {
    const e = ev('00:00', '23:59', { id: 'a', date: '2026-10-21', endDate: '2026-10-22', allDay: true });
    expect(timedOn([e], '2026-10-21')).toHaveLength(0);
    expect(allDayOn([e], '2026-10-22')).toHaveLength(1);
  });

  it('インスタンス ID から元の予定と回を探せる', () => {
    expect(parseInstanceId('ev_x@2026-10-21#2026-10-22')).toEqual({ baseId: 'ev_x', occurrence: '2026-10-21', segDate: '2026-10-22' });
    const e = ev('09:00', '10:00', { id: 'r', date: '2026-10-19', repeat: { freq: 'daily', interval: 1, weekdays: [], until: null } });
    expect(findInstance([e], 'r@2026-10-25')).toMatchObject({ occurrence: '2026-10-25', date: '2026-10-25' });
    expect(findInstance([{ ...e, exceptions: ['2026-10-25'] }], 'r@2026-10-25')).toBeNull();
  });
});
