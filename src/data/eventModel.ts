/**
 * 予定の作成・更新・検証（保存はしない純粋な関数）
 */
import { addDays, compareDateKeys, diffDays, formatDateJa, formatMinutes, formatTimeRange, isValidDateKey, weekdayOf, WEEKDAYS_JA, type DateKey } from '../lib/date';
import { createId } from '../lib/ids';
import type { AuditEntry, AuditKind, CalendarEvent, EventDraft, Repeat } from './types';

const MAX_HISTORY = 40;
export const MAX_BUFFER = 240;
/** 日をまたぐ予定の最長日数 */
export const MAX_SPAN_DAYS = 31;

export function emptyDraft(date: DateKey, startMin = 9 * 60, durationMin = 60): EventDraft {
  const start = Math.min(startMin, 1440 - 15);
  return {
    title: '',
    date,
    endDate: date,
    allDay: false,
    startMin: start,
    endMin: Math.min(1440, start + durationMin),
    repeat: null,
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
    endDate: e.endDate,
    allDay: e.allDay,
    startMin: e.startMin,
    endMin: e.endMin,
    repeat: e.repeat ? { ...e.repeat, weekdays: [...e.repeat.weekdays] } : null,
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

/** 予定の長さ（分）。日をまたぐ場合も通しで数える */
export function spanMinutes(d: Pick<EventDraft, 'date' | 'endDate' | 'startMin' | 'endMin'>): number {
  return diffDays(d.date, d.endDate) * 1440 + d.endMin - d.startMin;
}

/** 開始を動かしたとき、長さを保ったまま終了（日付も含む）をずらす */
export function shiftKeepingSpan<T extends Pick<EventDraft, 'date' | 'endDate' | 'startMin' | 'endMin'>>(d: T, newDate: DateKey, newStart: number): T {
  const span = Math.max(5, spanMinutes(d));
  const total = newStart + span;
  let days = Math.floor(total / 1440);
  let endMin = total % 1440;
  if (endMin === 0 && days > 0) {
    days -= 1;
    endMin = 1440;
  }
  return { ...d, date: newDate, startMin: newStart, endDate: addDays(newDate, days), endMin };
}

export type DraftErrors = Partial<Record<'title' | 'date' | 'endDate' | 'startMin' | 'endMin' | 'buffer' | 'actualMinutes' | 'repeat', string>>;

/** 入力チェック（日本語のエラーメッセージを返す） */
export function validateDraft(d: EventDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (d.title.trim() === '') errors.title = 'タイトルを入力してください。';
  else if (d.title.trim().length > 120) errors.title = 'タイトルは120文字以内にしてください。';
  if (!isValidDateKey(d.date)) errors.date = '日付を正しく入力してください。';
  if (!isValidDateKey(d.endDate)) errors.endDate = '終了日を正しく入力してください。';
  else if (!errors.date && compareDateKeys(d.endDate, d.date) < 0) errors.endDate = '終了日は開始日と同じか、それより後にしてください。';
  else if (!errors.date && diffDays(d.date, d.endDate) > MAX_SPAN_DAYS) errors.endDate = `日をまたぐ予定は${MAX_SPAN_DAYS}日以内にしてください。`;
  if (!d.allDay) {
    if (!Number.isInteger(d.startMin) || d.startMin < 0 || d.startMin >= 1440) errors.startMin = '開始時刻を正しく入力してください。';
    if (!Number.isInteger(d.endMin) || d.endMin <= 0 || d.endMin > 1440) errors.endMin = '終了時刻を正しく入力してください。';
    else if (!errors.startMin && !errors.endDate && !errors.date && d.endDate === d.date && d.endMin <= d.startMin) {
      errors.endMin = '終了時刻は開始時刻より後にしてください。翌日に終わる場合は終了日を変えてください。';
    }
  }
  const badBuffer = (n: number) => !Number.isInteger(n) || n < 0 || n > MAX_BUFFER;
  if (badBuffer(d.bufferBeforeMin) || badBuffer(d.bufferAfterMin)) errors.buffer = `余白は0〜${MAX_BUFFER}分で入力してください。`;
  if (d.actualMinutes != null && (!Number.isInteger(d.actualMinutes) || d.actualMinutes < 0 || d.actualMinutes > 1440)) {
    errors.actualMinutes = '実際の所要時間は0〜1440分で入力してください。';
  }
  if (d.repeat) {
    const r = d.repeat;
    if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 99) errors.repeat = '繰り返しの間隔は1〜99で入力してください。';
    else if (r.freq === 'weekly' && r.weekdays.length === 0) errors.repeat = '繰り返す曜日を1つ以上選んでください。';
    else if (r.until && (!isValidDateKey(r.until) || compareDateKeys(r.until, d.date) < 0)) errors.repeat = '繰り返しの終了日は開始日より後にしてください。';
  }
  return errors;
}

function audit(kind: AuditKind, detail: string, at: Date): AuditEntry {
  return { at: at.toISOString(), kind, detail };
}

function cleanDraft(d: EventDraft): EventDraft {
  let { startMin, endMin, endDate } = d;
  if (d.allDay) {
    startMin = 0;
    endMin = 1440;
  } else if (endDate !== d.date && endMin === 0) {
    // 翌日 0:00 終了は「前日の 24:00 終了」にそろえる
    endDate = addDays(endDate, -1);
    endMin = 1440;
  }
  if (compareDateKeys(endDate, d.date) < 0) endDate = d.date;
  let repeat: Repeat | null = d.repeat;
  if (repeat) {
    repeat = {
      ...repeat,
      weekdays: repeat.freq === 'weekly' ? [...new Set(repeat.weekdays)].sort() : [],
      until: repeat.until || null,
    };
  }
  return {
    ...d,
    startMin,
    endMin,
    endDate,
    repeat,
    title: d.title.trim(),
    location: d.location.trim(),
    prepTasks: d.prepTasks.filter((t) => t.label.trim() !== '').map((t) => ({ ...t, label: t.label.trim() })),
  };
}

/** 予定の日時を一行で（例：10月21日（水） 09:00〜10:00、10月21日（水）23:00 〜 10月22日（木）06:30、終日） */
export function describeWhen(d: Pick<EventDraft, 'date' | 'endDate' | 'allDay' | 'startMin' | 'endMin'>): string {
  const multi = d.endDate !== d.date;
  if (d.allDay) return multi ? `${formatDateJa(d.date)} 〜 ${formatDateJa(d.endDate)}（終日）` : `${formatDateJa(d.date)} 終日`;
  if (multi) return `${formatDateJa(d.date)} ${formatMinutes(d.startMin)} 〜 ${formatDateJa(d.endDate)} ${formatMinutes(d.endMin)}`;
  return `${formatDateJa(d.date)} ${formatTimeRange(d.startMin, d.endMin)}`;
}

const FREQ_UNIT: Record<Repeat['freq'], string> = { daily: '日', weekly: '週', monthly: 'か月', yearly: '年' };
const FREQ_EVERY: Record<Repeat['freq'], string> = { daily: '毎日', weekly: '毎週', monthly: '毎月', yearly: '毎年' };

/** 繰り返しの説明（例：毎週 月・水、2週ごと 金、毎月21日、毎年10月21日） */
export function describeRepeat(r: Repeat, date: DateKey): string {
  const head = r.interval === 1 ? FREQ_EVERY[r.freq] : `${r.interval}${FREQ_UNIT[r.freq]}ごと`;
  const [, m, day] = date.split('-').map(Number);
  let detail = '';
  if (r.freq === 'weekly') detail = ` ${(r.weekdays.length ? r.weekdays : [weekdayOf(date)]).map((w) => WEEKDAYS_JA[w]).join('・')}`;
  if (r.freq === 'monthly') detail = ` ${day}日`;
  if (r.freq === 'yearly') detail = ` ${m}月${day}日`;
  const until = r.until ? `（${formatDateJa(r.until, { year: true, weekday: false })}まで）` : '';
  return `${head}${detail}${until}`;
}

export function createEvent(draft: EventDraft, now = new Date(), isSample = false): CalendarEvent {
  const d = cleanDraft(draft);
  const iso = now.toISOString();
  return {
    ...d,
    id: createId(),
    exceptions: [],
    records: {},
    isSample,
    createdAt: iso,
    updatedAt: iso,
    history: [audit('created', `${describeWhen(d)} に作成`, now)],
  };
}

/** 変更点を要約した履歴を付けて更新後の予定を返す */
export function updateEvent(prev: CalendarEvent, draft: EventDraft, now = new Date(), kind?: AuditKind, note?: string): CalendarEvent {
  const d = cleanDraft(draft);
  const parts: string[] = [];
  const timeChanged =
    prev.date !== d.date || prev.endDate !== d.endDate || prev.allDay !== d.allDay || prev.startMin !== d.startMin || prev.endMin !== d.endMin;
  if (timeChanged) parts.push(`${describeWhen(prev)} → ${describeWhen(d)}`);
  if (JSON.stringify(prev.repeat) !== JSON.stringify(d.repeat)) parts.push(d.repeat ? `繰り返しを「${describeRepeat(d.repeat, d.date)}」に設定` : '繰り返しを解除');
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

/** 同じ日の中で開始時刻を動かす（長さは保つ） */
export function moveEvent(prev: CalendarEvent, newStart: number, now = new Date(), note?: string): CalendarEvent {
  const moved = shiftKeepingSpan(draftFromEvent(prev), prev.date, newStart);
  return updateEvent(prev, moved, now, note ? 'plan' : 'moved', note);
}

export const STATUS_LABEL: Record<CalendarEvent['status'], string> = {
  planned: '未記録',
  completed: '完了',
  missed: '未実施',
};
