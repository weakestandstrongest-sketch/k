/**
 * 予定の作成・更新・検証（保存はしない純粋な関数）
 */
import { formatDateJa, formatTimeRange, isValidDateKey, type DateKey } from '../lib/date';
import { createId } from '../lib/ids';
import type { AuditEntry, AuditKind, CalendarEvent, EventDraft } from './types';

const MAX_HISTORY = 40;
export const MAX_BUFFER = 240;

export function emptyDraft(date: DateKey, startMin = 9 * 60, durationMin = 60): EventDraft {
  const start = Math.min(startMin, 1440 - 15);
  return {
    title: '',
    date,
    startMin: start,
    endMin: Math.min(1440, start + durationMin),
    category: 'work',
    location: '',
    notes: '',
    prepTasks: [],
    status: 'planned',
    actualMinutes: null,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    fixed: false,
  };
}

export function draftFromEvent(e: CalendarEvent): EventDraft {
  return {
    title: e.title,
    date: e.date,
    startMin: e.startMin,
    endMin: e.endMin,
    category: e.category,
    location: e.location,
    notes: e.notes,
    prepTasks: e.prepTasks.map((t) => ({ ...t })),
    status: e.status,
    actualMinutes: e.actualMinutes,
    bufferBeforeMin: e.bufferBeforeMin,
    bufferAfterMin: e.bufferAfterMin,
    fixed: e.fixed,
  };
}

export type DraftErrors = Partial<Record<'title' | 'date' | 'startMin' | 'endMin' | 'buffer' | 'actualMinutes', string>>;

/** 入力チェック（日本語のエラーメッセージを返す） */
export function validateDraft(d: EventDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (d.title.trim() === '') errors.title = 'タイトルを入力してください。';
  else if (d.title.trim().length > 120) errors.title = 'タイトルは120文字以内にしてください。';
  if (!isValidDateKey(d.date)) errors.date = '日付を正しく入力してください。';
  if (!Number.isInteger(d.startMin) || d.startMin < 0 || d.startMin >= 1440) errors.startMin = '開始時刻を正しく入力してください。';
  if (!Number.isInteger(d.endMin) || d.endMin <= 0 || d.endMin > 1440) errors.endMin = '終了時刻を正しく入力してください。';
  else if (!errors.startMin && d.endMin <= d.startMin) errors.endMin = '終了時刻は開始時刻より後にしてください。';
  const badBuffer = (n: number) => !Number.isInteger(n) || n < 0 || n > MAX_BUFFER;
  if (badBuffer(d.bufferBeforeMin) || badBuffer(d.bufferAfterMin)) errors.buffer = `余白は0〜${MAX_BUFFER}分で入力してください。`;
  if (d.actualMinutes != null && (!Number.isInteger(d.actualMinutes) || d.actualMinutes < 0 || d.actualMinutes > 1440)) {
    errors.actualMinutes = '実際の所要時間は0〜1440分で入力してください。';
  }
  return errors;
}

function audit(kind: AuditKind, detail: string, at: Date): AuditEntry {
  return { at: at.toISOString(), kind, detail };
}

function cleanDraft(d: EventDraft): EventDraft {
  return {
    ...d,
    title: d.title.trim(),
    location: d.location.trim(),
    prepTasks: d.prepTasks.filter((t) => t.label.trim() !== '').map((t) => ({ ...t, label: t.label.trim() })),
  };
}

export function createEvent(draft: EventDraft, now = new Date(), isSample = false): CalendarEvent {
  const d = cleanDraft(draft);
  const iso = now.toISOString();
  return {
    ...d,
    id: createId(),
    isSample,
    createdAt: iso,
    updatedAt: iso,
    history: [audit('created', `${formatDateJa(d.date)} ${formatTimeRange(d.startMin, d.endMin)} に作成`, now)],
  };
}

/** 変更点を要約した履歴を付けて更新後の予定を返す */
export function updateEvent(prev: CalendarEvent, draft: EventDraft, now = new Date(), kind?: AuditKind, note?: string): CalendarEvent {
  const d = cleanDraft(draft);
  const parts: string[] = [];
  const timeChanged = prev.date !== d.date || prev.startMin !== d.startMin || prev.endMin !== d.endMin;
  if (timeChanged) {
    parts.push(
      `${formatDateJa(prev.date)} ${formatTimeRange(prev.startMin, prev.endMin)} → ${formatDateJa(d.date)} ${formatTimeRange(d.startMin, d.endMin)}`,
    );
  }
  if (prev.title !== d.title) parts.push(`題名を「${d.title}」に変更`);
  if (prev.status !== d.status) parts.push(statusChangeLabel(d.status));
  if (prev.actualMinutes !== d.actualMinutes) parts.push(d.actualMinutes == null ? '実績時間を消去' : `実績時間を${d.actualMinutes}分と記録`);
  const otherChanged =
    prev.category !== d.category ||
    prev.location !== d.location ||
    prev.notes !== d.notes ||
    prev.bufferBeforeMin !== d.bufferBeforeMin ||
    prev.bufferAfterMin !== d.bufferAfterMin ||
    prev.fixed !== d.fixed ||
    JSON.stringify(prev.prepTasks) !== JSON.stringify(d.prepTasks);
  if (otherChanged && parts.length === 0) parts.push('詳細を編集');

  const resolvedKind: AuditKind = kind ?? (timeChanged ? 'moved' : prev.status !== d.status ? 'status' : 'edited');
  const detail = [note, ...parts].filter(Boolean).join('／') || '保存';
  return {
    ...prev,
    ...d,
    updatedAt: now.toISOString(),
    history: [...prev.history, audit(resolvedKind, detail, now)].slice(-MAX_HISTORY),
  };
}

export function statusChangeLabel(status: CalendarEvent['status']): string {
  if (status === 'completed') return '完了と記録';
  if (status === 'missed') return '未実施と記録';
  return '記録を取り消し';
}

export function moveEvent(prev: CalendarEvent, newStart: number, now = new Date(), note?: string): CalendarEvent {
  const dur = prev.endMin - prev.startMin;
  return updateEvent(prev, { ...draftFromEvent(prev), startMin: newStart, endMin: newStart + dur }, now, note ? 'plan' : 'moved', note);
}

export const STATUS_LABEL: Record<CalendarEvent['status'], string> = {
  planned: '未記録',
  completed: '完了',
  missed: '未実施',
};
