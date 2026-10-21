/**
 * 予定と設定の状態管理
 *
 * 保存の流れ:  画面 → この Context の関数 → repository（IndexedDB）
 * 保存が成功してから画面の状態を更新します。失敗した場合は状態を変えず、
 * エラーを通知します（「保存したふり」をしません）。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeStorageError } from '../data/db';
import { createEvent, updateEvent as applyDraft } from '../data/eventModel';
import * as repo from '../data/repository';
import { buildSampleEvents } from '../data/sampleData';
import { DEFAULT_SETTINGS, type CalendarEvent, type EventDraft, type Settings } from '../data/types';
import { todayKey } from '../lib/date';
import { useToast } from './ToastContext';

export type LoadStatus = 'loading' | 'ready' | 'error';

interface EventsApi {
  status: LoadStatus;
  /** 読み込みや保存領域の問題（表示用の日本語） */
  storageProblem: string | null;
  /** IndexedDB が使えず、メモリ上だけで動いている */
  memoryOnly: boolean;
  events: CalendarEvent[];
  settings: Settings;
  saving: boolean;
  hasSamples: boolean;
  create: (draft: EventDraft) => Promise<CalendarEvent | null>;
  update: (id: string, draft: EventDraft) => Promise<CalendarEvent | null>;
  /** 履歴付きで更新済みの予定をまとめて保存（移動・提案の適用） */
  commit: (updated: CalendarEvent[]) => Promise<boolean>;
  remove: (id: string) => Promise<CalendarEvent | null>;
  /** 削除の取り消し・変更の取り消し */
  restore: (events: CalendarEvent[]) => Promise<boolean>;
  updateSettings: (s: Settings) => Promise<boolean>;
  clearSamples: () => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  loadSamples: () => Promise<boolean>;
  retry: () => void;
}

const EventsContext = createContext<EventsApi | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const { push } = useToast();
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [storageProblem, setStorageProblem] = useState<string | null>(null);
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pending, setPending] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const memoryOnlyRef = useRef(false);

  // ---------- 起動時の読み込み ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loaded, s, seeded] = await Promise.all([repo.loadAllEvents(), repo.loadSettings(), repo.getMeta<boolean>('seeded')]);
        let list = loaded;
        if (!seeded && loaded.length === 0) {
          // 初回起動：見本データを入れる
          list = buildSampleEvents(todayKey());
          await repo.saveEvents(list);
          await repo.setMeta('seeded', true);
        } else if (!seeded) {
          await repo.setMeta('seeded', true);
        }
        if (cancelled) return;
        memoryOnlyRef.current = false;
        setMemoryOnly(false);
        setEvents(list);
        setSettings(s);
        setStorageProblem(null);
        setStatus('ready');
        // 端末の空き容量が少ないときにブラウザがデータを消さないよう、永続的な保存をお願いする
        // （許可されるかはブラウザ次第。ホーム画面に追加した iPhone の PWA では通常許可されます）
        navigator.storage?.persist?.().catch(() => undefined);
      } catch (err) {
        if (cancelled) return;
        // 保存領域が使えない場合は、保存しないことを明示したうえでメモリ上で動かす
        memoryOnlyRef.current = true;
        setMemoryOnly(true);
        setStorageProblem(describeStorageError(err));
        setEvents(buildSampleEvents(todayKey()));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** 保存処理を共通化：成功したら true */
  const persist = useCallback(
    async (op: () => Promise<void>, failMessage: string): Promise<boolean> => {
      if (memoryOnlyRef.current) return true; // 画面上だけで反映（保存されないことは常に表示中）
      setPending((n) => n + 1);
      try {
        await op();
        return true;
      } catch (err) {
        push({ kind: 'error', message: `${failMessage}${describeStorageError(err)}` });
        return false;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [push],
  );

  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const create = useCallback<EventsApi['create']>(
    async (draft) => {
      const ev = createEvent(draft);
      const ok = await persist(() => repo.saveEvent(ev), '予定を保存できませんでした。');
      if (!ok) return null;
      setEvents((list) => [...list, ev]);
      return ev;
    },
    [persist],
  );

  const update = useCallback<EventsApi['update']>(
    async (id, draft) => {
      const prev = eventsRef.current.find((e) => e.id === id);
      if (!prev) {
        push({ kind: 'error', message: 'この予定は見つかりませんでした。すでに削除された可能性があります。' });
        return null;
      }
      const next = applyDraft(prev, draft);
      const ok = await persist(() => repo.saveEvent(next), '変更を保存できませんでした。');
      if (!ok) return null;
      setEvents((list) => list.map((e) => (e.id === id ? next : e)));
      return next;
    },
    [persist, push],
  );

  const commit = useCallback<EventsApi['commit']>(
    async (updated) => {
      const ok = await persist(() => repo.saveEvents(updated), '変更を保存できませんでした。');
      if (!ok) return false;
      const map = new Map(updated.map((e) => [e.id, e]));
      setEvents((list) => list.map((e) => map.get(e.id) ?? e));
      return true;
    },
    [persist],
  );

  const remove = useCallback<EventsApi['remove']>(
    async (id) => {
      const prev = eventsRef.current.find((e) => e.id === id) ?? null;
      const ok = await persist(() => repo.deleteEvent(id), '予定を削除できませんでした。');
      if (!ok) return null;
      setEvents((list) => list.filter((e) => e.id !== id));
      return prev;
    },
    [persist],
  );

  const restore = useCallback<EventsApi['restore']>(
    async (restored) => {
      const ok = await persist(() => repo.saveEvents(restored), '元に戻せませんでした。');
      if (!ok) return false;
      const map = new Map(restored.map((e) => [e.id, e]));
      setEvents((list) => [...list.filter((e) => !map.has(e.id)), ...restored]);
      return true;
    },
    [persist],
  );

  const updateSettings = useCallback<EventsApi['updateSettings']>(
    async (s) => {
      const ok = await persist(() => repo.saveSettings(s), '設定を保存できませんでした。');
      if (ok) setSettings(s);
      return ok;
    },
    [persist],
  );

  const clearSamples = useCallback(async () => {
    const ids = eventsRef.current.filter((e) => e.isSample).map((e) => e.id);
    const ok = await persist(() => repo.deleteEvents(ids), '見本データを消去できませんでした。');
    if (ok) setEvents((list) => list.filter((e) => !e.isSample));
    return ok;
  }, [persist]);

  const clearAll = useCallback(async () => {
    const ok = await persist(() => repo.clearAllEvents(), 'データを消去できませんでした。');
    if (ok) setEvents([]);
    return ok;
  }, [persist]);

  const loadSamples = useCallback(async () => {
    const samples = buildSampleEvents(todayKey());
    const oldIds = eventsRef.current.filter((e) => e.isSample).map((e) => e.id);
    const ok = await persist(async () => {
      await repo.deleteEvents(oldIds);
      await repo.saveEvents(samples);
    }, '見本データを読み込めませんでした。');
    if (ok) setEvents((list) => [...list.filter((e) => !e.isSample), ...samples]);
    return ok;
  }, [persist]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  const api = useMemo<EventsApi>(
    () => ({
      status,
      storageProblem,
      memoryOnly,
      events,
      settings,
      saving: pending > 0,
      hasSamples: events.some((e) => e.isSample),
      create,
      update,
      commit,
      remove,
      restore,
      updateSettings,
      clearSamples,
      clearAll,
      loadSamples,
      retry,
    }),
    [status, storageProblem, memoryOnly, events, settings, pending, create, update, commit, remove, restore, updateSettings, clearSamples, clearAll, loadSamples, retry],
  );

  return <EventsContext.Provider value={api}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsApi {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('EventsProvider の内側で使ってください');
  return ctx;
}
