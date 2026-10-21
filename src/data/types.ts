import type { DateKey } from '../lib/date';

export type CategoryId = 'work' | 'meeting' | 'study' | 'health' | 'personal' | 'travel' | 'social' | 'other';

/**
 * 予定の状態
 * - planned: 予定のまま（完了したかどうか記録されていない）
 * - completed: 利用者が「完了」と記録した
 * - missed: 利用者が「実施しなかった」と記録した
 */
export type EventStatus = 'planned' | 'completed' | 'missed';

export interface PrepTask {
  id: string;
  label: string;
  done: boolean;
}

export type AuditKind = 'created' | 'edited' | 'moved' | 'status' | 'plan' | 'restored';

/** 変更履歴（いつ、何が変わったか） */
export interface AuditEntry {
  at: string; // ISO 8601（記録時刻。表示専用）
  kind: AuditKind;
  detail: string;
}

export interface CalendarEvent {
  /** 変わらない一意の ID */
  id: string;
  title: string;
  /** ローカル暦日 */
  date: DateKey;
  /** 0時からの分（0〜1439） */
  startMin: number;
  /** 0時からの分（1〜1440）。startMin より大きい。同日内のみ */
  endMin: number;
  category: CategoryId;
  location: string;
  notes: string;
  prepTasks: PrepTask[];
  status: EventStatus;
  /** 実際にかかった時間（分）。利用者が記録した場合のみ */
  actualMinutes: number | null;
  /** 移動・準備のための前後の余白（分） */
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** true の場合、時間設計の提案で動かさない */
  fixed: boolean;
  /** サンプル（見本）データかどうか */
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  history: AuditEntry[];
}

/** 編集フォームで扱う値（ID や履歴を除いたもの） */
export type EventDraft = Pick<
  CalendarEvent,
  | 'title'
  | 'date'
  | 'startMin'
  | 'endMin'
  | 'category'
  | 'location'
  | 'notes'
  | 'prepTasks'
  | 'status'
  | 'actualMinutes'
  | 'bufferBeforeMin'
  | 'bufferAfterMin'
  | 'fixed'
>;

export interface Settings {
  weekStartsOn: 0 | 1;
  /** 活動時間帯（空き時間の計算に使う） */
  dayStartMin: number;
  dayEndMin: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 0,
  dayStartMin: 7 * 60,
  dayEndMin: 23 * 60,
};
