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

/** 繰り返しの頻度 */
export type RepeatFreq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Repeat {
  freq: RepeatFreq;
  /** 何日・何週・何か月・何年ごとか（1〜99） */
  interval: number;
  /** 毎週の場合の曜日（0 = 日曜 … 6 = 土曜） */
  weekdays: number[];
  /** この日まで繰り返す（含む）。null なら終わりなし */
  until: DateKey | null;
}

/** 繰り返し予定の、各回ごとの実施記録 */
export interface OccurrenceRecord {
  status: EventStatus;
  actualMinutes: number | null;
}

/**
 * どの画面に出すか（ひび手帳のタイムライン／カレンダーと同じ分け方）
 * - both: どこにも出す
 * - day: ホームと「日」だけ（ひび手帳のタイムラインにだけ出る予定）
 * - range: 「週」と「月」だけ（ひび手帳のカレンダーにだけ出る予定）
 */
export type ShowOn = 'both' | 'day' | 'range';

export interface CalendarEvent {
  /** 変わらない一意の ID */
  id: string;
  title: string;
  /** 開始日（ローカル暦日） */
  date: DateKey;
  /** 終了日（日をまたぐ予定のみ date より後。それ以外は date と同じ） */
  endDate: DateKey;
  /** 終日の予定（startMin = 0, endMin = 1440 として保存） */
  allDay: boolean;
  /** 開始日の 0 時からの分（0〜1439） */
  startMin: number;
  /** 終了日の 0 時からの分（1〜1440）。同じ日なら startMin より大きい */
  endMin: number;
  /** 繰り返し（なければ null） */
  repeat: Repeat | null;
  /** 繰り返しのうち、取り除いた回（開始日） */
  exceptions: DateKey[];
  /** 繰り返しの各回の記録（開始日ごと） */
  records: Record<DateKey, OccurrenceRecord>;
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
  /** true の場合、重なりの再編成で動かさない */
  fixed: boolean;
  /** どの画面に出すか */
  show: ShowOn;
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
  | 'endDate'
  | 'allDay'
  | 'startMin'
  | 'endMin'
  | 'repeat'
  | 'category'
  | 'location'
  | 'notes'
  | 'prepTasks'
  | 'status'
  | 'actualMinutes'
  | 'bufferBeforeMin'
  | 'bufferAfterMin'
  | 'fixed'
  | 'show'
>;

/** 見た目：白を基調／黒を基調／端末の設定に合わせる */
export type Appearance = 'light' | 'dark' | 'system';

export interface Settings {
  weekStartsOn: 0 | 1;
  appearance: Appearance;
  /** 活動時間帯（空き時間の計算に使う） */
  dayStartMin: number;
  dayEndMin: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 0,
  appearance: 'light',
  dayStartMin: 7 * 60,
  dayEndMin: 23 * 60,
};
