import { describe, expect, it } from 'vitest';
import { createEvent, draftFromEvent, emptyDraft, moveEvent, updateEvent, validateDraft } from './eventModel';

describe('予定の入力チェック', () => {
  it('必須項目と時刻の前後関係', () => {
    const d = emptyDraft('2026-10-21');
    expect(validateDraft(d).title).toBe('タイトルを入力してください。');
    expect(validateDraft({ ...d, title: '会議', endMin: d.startMin }).endMin).toBe('終了時刻は開始時刻より後にしてください。');
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
