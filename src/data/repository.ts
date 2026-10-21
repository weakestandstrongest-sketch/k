/**
 * データ層：予定と設定の読み書き
 * 画面（React コンポーネント）からは、この関数だけを使って保存します。
 */
import { DEFAULT_SETTINGS, type CalendarEvent, type Settings } from './types';
import { withStore } from './db';
import { normalizeEvent } from './normalize';

export async function loadAllEvents(): Promise<CalendarEvent[]> {
  const raw = await withStore<unknown[]>('events', 'readonly', (store) => store.getAll());
  return raw.map(normalizeEvent).filter((e): e is CalendarEvent => e !== null);
}

export async function saveEvent(event: CalendarEvent): Promise<void> {
  await withStore('events', 'readwrite', (store) => store.put(event));
}

/** 複数の予定をひとつのトランザクションで保存（全部成功するか、全部失敗するか） */
export async function saveEvents(events: CalendarEvent[]): Promise<void> {
  if (events.length === 0) return;
  await withStore('events', 'readwrite', (store) => {
    for (const e of events) store.put(e);
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await withStore('events', 'readwrite', (store) => store.delete(id));
}

export async function deleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withStore('events', 'readwrite', (store) => {
    for (const id of ids) store.delete(id);
  });
}

export async function clearAllEvents(): Promise<void> {
  await withStore('events', 'readwrite', (store) => store.clear());
}

// ---------- 設定 ----------

interface KeyValue<T> {
  key: string;
  value: T;
}

export async function loadSettings(): Promise<Settings> {
  const row = await withStore<KeyValue<Partial<Settings>> | undefined>('settings', 'readonly', (store) =>
    store.get('settings'),
  );
  const v = row?.value ?? {};
  const merged: Settings = { ...DEFAULT_SETTINGS, ...v };
  // 壊れた値に備えて検証
  if (merged.weekStartsOn !== 0 && merged.weekStartsOn !== 1) merged.weekStartsOn = DEFAULT_SETTINGS.weekStartsOn;
  if (
    !Number.isInteger(merged.dayStartMin) ||
    !Number.isInteger(merged.dayEndMin) ||
    merged.dayStartMin < 0 ||
    merged.dayEndMin > 1440 ||
    merged.dayEndMin <= merged.dayStartMin
  ) {
    merged.dayStartMin = DEFAULT_SETTINGS.dayStartMin;
    merged.dayEndMin = DEFAULT_SETTINGS.dayEndMin;
  }
  return merged;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await withStore('settings', 'readwrite', (store) => store.put({ key: 'settings', value: settings }));
}

// ---------- メタ情報（初回起動の判定など） ----------

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await withStore<KeyValue<T> | undefined>('meta', 'readonly', (store) => store.get(key));
  return row?.value;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await withStore('meta', 'readwrite', (store) => store.put({ key, value }));
}
