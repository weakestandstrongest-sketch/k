import { compareDateKeys, isValidDateKey } from '../lib/date';
import { isCategoryId } from './categories';
import type { AuditEntry, CalendarEvent, EventStatus, OccurrenceRecord, PrepTask, Repeat, RepeatFreq, RouteInfo, RouteStep } from './types';

const FREQS: RepeatFreq[] = ['daily', 'weekly', 'monthly', 'yearly'];

function normalizeRepeat(raw: unknown, date: string): Repeat | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const freq = r.freq as RepeatFreq;
  if (!FREQS.includes(freq)) return null;
  const interval = typeof r.interval === 'number' && r.interval >= 1 && r.interval <= 99 ? Math.round(r.interval) : 1;
  const weekdays = Array.isArray(r.weekdays) ? [...new Set(r.weekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  const until = typeof r.until === 'string' && isValidDateKey(r.until) && compareDateKeys(r.until, date) >= 0 ? r.until : null;
  return { freq, interval, weekdays, until };
}

const clip = (v: unknown, n = 80) => (typeof v === 'string' ? v.slice(0, n) : '');

/** 経路は見せるだけなので、決まった項目だけを残す（壊れていたら捨てる） */
export function normalizeRoute(raw: unknown): RouteInfo | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.steps) || r.steps.length === 0) return undefined;
  const steps: RouteStep[] = [];
  for (const x of r.steps.slice(0, 60)) {
    if (!x || typeof x !== 'object') continue;
    const s = x as Record<string, unknown>;
    if (s.k === 's') steps.push({ k: 's', name: clip(s.name), arr: clip(s.arr, 8), dep: clip(s.dep, 8) });
    else if (s.k === 'a')
      steps.push({ k: 'a', line: clip(s.line), dest: clip(s.dest), color: /^#[0-9a-fA-F]{3,8}$/.test(String(s.color)) ? String(s.color) : '', walk: s.walk === true, platform: clip(s.platform, 40), stops: clip(s.stops, 20) });
  }
  if (!steps.length) return undefined;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return { from: clip(r.from), to: clip(r.to), via: clip(r.via), dep: clip(r.dep, 8), arr: clip(r.arr, 8), duration: clip(r.duration, 30), transfers: num(r.transfers), fare: num(r.fare), fareNote: clip(r.fareNote, 10), steps };
}

const STATUSES: EventStatus[] = ['planned', 'completed', 'missed'];

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const int = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);

/**
 * 保存データを読み込むときの安全確認。
 * 将来フィールドが増えても、古いデータを壊さずに読めるようにします。
 * 復元できないほど壊れたデータは null を返します。
 */
export function normalizeEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const date = str(r.date);
  const startMin = int(r.startMin, -1);
  const endMin = int(r.endMin, -1);
  if (!id || !isValidDateKey(date)) return null;
  // 以前の版のデータには endDate がない → 同じ日として扱う
  const rawEnd = str(r.endDate);
  const endDate = isValidDateKey(rawEnd) && compareDateKeys(rawEnd, date) >= 0 ? rawEnd : date;
  const allDay = r.allDay === true;
  if (startMin < 0 || startMin >= 1440 || endMin <= 0 || endMin > 1440) return null;
  if (!allDay && endDate === date && endMin <= startMin) return null;
  const repeat = normalizeRepeat(r.repeat, date);
  const records: Record<string, OccurrenceRecord> = {};
  if (r.records && typeof r.records === 'object') {
    for (const [k, v] of Object.entries(r.records as Record<string, unknown>)) {
      if (!isValidDateKey(k) || !v || typeof v !== 'object') continue;
      const rec = v as Record<string, unknown>;
      const st = str(rec.status) as EventStatus;
      records[k] = {
        status: STATUSES.includes(st) ? st : 'planned',
        actualMinutes: typeof rec.actualMinutes === 'number' && rec.actualMinutes >= 0 ? Math.round(rec.actualMinutes) : null,
      };
    }
  }

  const category = str(r.category);
  const status = str(r.status) as EventStatus;
  const prep = Array.isArray(r.prepTasks) ? r.prepTasks : [];
  const history = Array.isArray(r.history) ? r.history : [];
  const now = new Date().toISOString();

  return {
    id,
    title: str(r.title, '（無題）') || '（無題）',
    date,
    endDate,
    allDay,
    startMin: allDay ? 0 : startMin,
    endMin: allDay ? 1440 : endMin,
    repeat,
    exceptions: Array.isArray(r.exceptions) ? r.exceptions.filter((d): d is string => typeof d === 'string' && isValidDateKey(d)) : [],
    records,
    category: isCategoryId(category) ? category : 'other',
    location: str(r.location),
    notes: str(r.notes),
    prepTasks: prep
      .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
      .map((t): PrepTask => ({ id: str(t.id) || `pt_${Math.random().toString(36).slice(2)}`, label: str(t.label), done: t.done === true }))
      .filter((t) => t.label.trim() !== ''),
    status: STATUSES.includes(status) ? status : 'planned',
    actualMinutes: typeof r.actualMinutes === 'number' && r.actualMinutes >= 0 ? Math.round(r.actualMinutes) : null,
    bufferBeforeMin: Math.max(0, int(r.bufferBeforeMin, 0)),
    bufferAfterMin: Math.max(0, int(r.bufferAfterMin, 0)),
    fixed: r.fixed === true,
    show: r.show === 'day' || r.show === 'range' ? r.show : 'both',
    ...(normalizeRoute(r.route) ? { route: normalizeRoute(r.route) } : {}),
    isSample: r.isSample === true,
    createdAt: str(r.createdAt, now),
    updatedAt: str(r.updatedAt, now),
    history: history
      .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
      .map((h) => ({ at: str(h.at, now), kind: str(h.kind, 'edited') as AuditEntry['kind'], detail: str(h.detail) })),
  };
}
