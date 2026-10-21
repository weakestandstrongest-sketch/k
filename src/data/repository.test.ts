import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabaseConnection } from './db';
import { clearAllEvents, deleteEvent, loadAllEvents, loadSettings, saveEvent, saveEvents, saveSettings } from './repository';
import { buildSampleEvents } from './sampleData';
import { normalizeEvent } from './normalize';
import { ev } from '../lib/testUtils';

describe('IndexedDB への保存', () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await clearAllEvents();
  });

  it('保存・読み込み・削除ができる', async () => {
    const a = ev('09:00', '10:00', { title: '保存テスト' });
    await saveEvent(a);
    resetDatabaseConnection(); // 再起動を想定
    const loaded = await loadAllEvents();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(a);
    await deleteEvent(a.id);
    expect(await loadAllEvents()).toHaveLength(0);
  });

  it('まとめて保存できる', async () => {
    await saveEvents([ev('09:00', '10:00'), ev('11:00', '12:00')]);
    expect(await loadAllEvents()).toHaveLength(2);
  });

  it('設定の既定値と保存', async () => {
    const s = await loadSettings();
    expect(s.weekStartsOn).toBe(0);
    await saveSettings({ ...s, weekStartsOn: 1 });
    expect((await loadSettings()).weekStartsOn).toBe(1);
  });
});

describe('データの検証', () => {
  it('壊れた予定は読み込まない', () => {
    expect(normalizeEvent({ id: 'x', date: '2026-02-30', startMin: 0, endMin: 60 })).toBeNull();
    expect(normalizeEvent({ id: 'x', date: '2026-10-21', startMin: 600, endMin: 500 })).toBeNull();
    const ok = normalizeEvent({ id: 'x', date: '2026-10-21', startMin: 600, endMin: 660, category: '??' });
    expect(ok).toMatchObject({ category: 'other', status: 'planned', title: '（無題）' });
  });

  it('見本データはすべて見本として区別され、妥当な値を持つ', () => {
    const list = buildSampleEvents('2026-10-21');
    expect(list.length).toBeGreaterThan(20);
    for (const e of list) {
      expect(e.isSample).toBe(true);
      expect(normalizeEvent(e)).toEqual(e);
    }
    // 未来の見本には完了などの記録を付けない
    expect(list.filter((e) => e.date >= '2026-10-21').every((e) => e.status === 'planned' && e.actualMinutes === null)).toBe(true);
  });
});
