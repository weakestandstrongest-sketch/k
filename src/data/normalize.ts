import { isValidDateKey } from '../lib/date';
import { isCategoryId } from './categories';
import type { AuditEntry, CalendarEvent, EventStatus, PrepTask } from './types';

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
  if (startMin < 0 || startMin >= 1440 || endMin <= startMin || endMin > 1440) return null;

  const category = str(r.category);
  const status = str(r.status) as EventStatus;
  const prep = Array.isArray(r.prepTasks) ? r.prepTasks : [];
  const history = Array.isArray(r.history) ? r.history : [];
  const now = new Date().toISOString();

  return {
    id,
    title: str(r.title, '（無題）') || '（無題）',
    date,
    startMin,
    endMin,
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
    isSample: r.isSample === true,
    createdAt: str(r.createdAt, now),
    updatedAt: str(r.updatedAt, now),
    history: history
      .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
      .map((h) => ({ at: str(h.at, now), kind: str(h.kind, 'edited') as AuditEntry['kind'], detail: str(h.detail) })),
  };
}
