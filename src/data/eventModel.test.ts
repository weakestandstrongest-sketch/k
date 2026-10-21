import { describe, expect, it } from 'vitest';
import { createEvent, describeRepeat, describeWhen, draftFromEvent, emptyDraft, moveEvent, shiftKeepingSpan, updateEvent, validateDraft } from './eventModel';

describe('予定の入力チェック', () => {
  it('必須項目と時刻の前後関係', () => {
    const d = emptyDraft('2026-10-21');
    expect(validateDraft(d).title).toBe('タイトルを入力してください。');
    expect(validateDraft({ ...d, title: '会議', endMin: d.startMin }).endMin).toMatch(/^終了時刻は開始時刻より後にしてください。/);
    expect(validateDraft({ ...d, title: '会議', bufferAfterMin: -5 }).buffer).toBeDefined();
    expect(validateDraft({ ...d, title: '会議', date: '2026-13-01' }).date).toBeDefined();
    expect(validateDraft({ ...d, title: '会議' })).toEqual({});
  });

  it('更新と移動は履歴に残る', () => {
    const now = new Date('2026-10-21T00:00:00Z');
    const e = createEvent({ ...emptyDraft('2026-10-21'), title: '会議' }, now);
    expect(e.history).toHaveLength(1);
    const moved = moveEvent(e, 600, now);
    expect(moved.startMin).toBe(600);
    expect(moved.endMin).toBe(660);
    expect(moved.history.at(-1)?.kind).toBe('moved');
    const done = updateEvent(moved, { ...draftFromEvent(moved), status: 'completed' }, now);
    expect(done.history.at(-1)).toMatchObject({ kind: 'status', detail: '完了と記録' });
    expect(done.id).toBe(e.id);
  });
});

describe('日をまたぐ・終日・繰り返しの入力', () => {
  const base = { ...emptyDraft('2026-10-21'), title: '夜行バス' };
  it('翌日に終わる予定は有効、終了日が前ならエラー', () => {
    expect(validateDraft({ ...base, startMin: 23 * 60, endDate: '2026-10-22', endMin: 6 * 60 + 30 })).toEqual({});
    expect(validateDraft({ ...base, endDate: '2026-10-20' }).endDate).toBeDefined();
    expect(validateDraft({ ...base, endDate: '2026-12-31' }).endDate).toMatch(/31日以内/);
  });
  it('終日の予定は時刻を確認しない', () => {
    expect(validateDraft({ ...base, allDay: true, startMin: 600, endMin: 300 })).toEqual({});
    const e = createEvent({ ...base, allDay: true, startMin: 600, endMin: 700 });
    expect([e.startMin, e.endMin]).toEqual([0, 1440]);
  });
  it('繰り返しの入力チェック', () => {
    expect(validateDraft({ ...base, repeat: { freq: 'weekly', interval: 1, weekdays: [], until: null } }).repeat).toBeDefined();
    expect(validateDraft({ ...base, repeat: { freq: 'daily', interval: 0, weekdays: [], until: null } }).repeat).toBeDefined();
    expect(validateDraft({ ...base, repeat: { freq: 'daily', interval: 1, weekdays: [], until: '2026-10-01' } }).repeat).toBeDefined();
  });
  it('開始を動かすと長さを保って終了日もずれる', () => {
    const d = shiftKeepingSpan({ ...base, startMin: 600, endMin: 720 }, '2026-10-21', 23 * 60);
    expect([d.date, d.startMin, d.endDate, d.endMin]).toEqual(['2026-10-21', 1380, '2026-10-22', 60]);
  });
  it('表示用の文', () => {
    expect(describeWhen({ date: '2026-10-21', endDate: '2026-10-22', allDay: false, startMin: 1380, endMin: 390 })).toBe('10月21日（水） 23:00 〜 10月22日（木） 06:30');
    expect(describeWhen({ date: '2026-10-21', endDate: '2026-10-21', allDay: true, startMin: 0, endMin: 1440 })).toBe('10月21日（水） 終日');
    expect(describeRepeat({ freq: 'weekly', interval: 2, weekdays: [1, 3], until: null }, '2026-10-21')).toBe('2週ごと 月・水');
    expect(describeRepeat({ freq: 'monthly', interval: 1, weekdays: [], until: '2027-03-31' }, '2026-10-21')).toBe('毎月 21日（2027年3月31日まで）');
  });
});
