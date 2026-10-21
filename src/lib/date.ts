/**
 * 日付ユーティリティ
 *
 * 予定は「ローカルの暦日（DateKey: 'YYYY-MM-DD'）」と「その日の0時からの分数」で保存します。
 * Date オブジェクトを UTC に変換して保存しないので、タイムゾーンや夏時間による
 * 日付ずれが起きません。日付の計算は Date.UTC を使った「暦の上の計算」で行います。
 */

/** ローカル暦日を表す文字列 'YYYY-MM-DD' */
export type DateKey = string;

export const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;
export const WEEKDAYS_JA_LONG = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'] as const;
export const MINUTES_PER_DAY = 1440;
const MS_PER_DAY = 86_400_000;

const pad2 = (n: number) => String(n).padStart(2, '0');

export function makeDateKey(year: number, month: number, day: number): DateKey {
  // 範囲外（例: 13月、32日）は暦上で繰り上げる
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Date をローカル時刻の暦日に変換 */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

export function isValidDateKey(key: string): key is DateKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { year, month, day } = parseDateKey(key);
  return makeDateKey(year, month, day) === key;
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function toUtcMs(key: DateKey): number {
  const { year, month, day } = parseDateKey(key);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  return makeDateKey(year, month, day + days);
}

/** 月を加算。日が存在しない場合は月末に丸める（1/31 + 1か月 → 2/28） */
export function addMonths(key: DateKey, months: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth() + 1;
  return makeDateKey(ty, tm, Math.min(day, daysInMonth(ty, tm)));
}

/** b - a の日数 */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = 日曜 … 6 = 土曜 */
export function weekdayOf(key: DateKey): number {
  return new Date(toUtcMs(key)).getUTCDay();
}

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const wd = weekdayOf(key);
  const offset = (wd - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function startOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, 1);
}

export function endOfMonth(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key);
  return makeDateKey(year, month, daysInMonth(year, month));
}

export function rangeKeys(start: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function weekKeys(key: DateKey, weekStartsOn: 0 | 1): DateKey[] {
  return rangeKeys(startOfWeek(key, weekStartsOn), 7);
}

/** 月表示用の 6 週 × 7 日のグリッド */
export function monthGridKeys(key: DateKey, weekStartsOn: 0 | 1): DateKey[] {
  return rangeKeys(startOfWeek(startOfMonth(key), weekStartsOn), 42);
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 曜日の並び（週の始まりに合わせる） */
export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

// ---------- 時刻（分） ----------

/** ローカルの壁時計での「0時からの分数」 */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** 540 → '09:00'、1440 → '24:00' */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** '09:30' → 570。不正な値は null */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** input[type=time] 用。24:00 は 00:00 として表す */
export function toTimeInputValue(min: number): string {
  return formatMinutes(min % MINUTES_PER_DAY);
}

/** 90 → '1時間30分'、45 → '45分'、0 → '0分' */
export function formatDuration(totalMin: number): string {
  const sign = totalMin < 0 ? '−' : '';
  const abs = Math.abs(Math.round(totalMin));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}分`;
  if (m === 0) return `${sign}${h}時間`;
  return `${sign}${h}時間${m}分`;
}

export function formatTimeRange(startMin: number, endMin: number): string {
  return `${formatMinutes(startMin)}〜${formatMinutes(endMin)}`;
}

// ---------- 日本語表記 ----------

export function formatDateJa(key: DateKey, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const { year, month, day } = parseDateKey(key);
  const y = opts.year ? `${year}年` : '';
  const w = opts.weekday === false ? '' : `（${WEEKDAYS_JA[weekdayOf(key)]}）`;
  return `${y}${month}月${day}日${w}`;
}

export function formatMonthJa(key: DateKey): string {
  const { year, month } = parseDateKey(key);
  return `${year}年${month}月`;
}

export function formatWeekRangeJa(keys: DateKey[]): string {
  const first = keys[0];
  const last = keys[keys.length - 1];
  const a = parseDateKey(first);
  const b = parseDateKey(last);
  if (a.year !== b.year) return `${formatDateJa(first, { year: true, weekday: false })} 〜 ${formatDateJa(last, { year: true, weekday: false })}`;
  if (a.month !== b.month) return `${a.year}年${a.month}月${a.day}日 〜 ${b.month}月${b.day}日`;
  return `${a.year}年${a.month}月${a.day}日 〜 ${b.day}日`;
}

/** 今日を基準にした相対的な呼び方 */
export function relativeDayLabel(key: DateKey, today: DateKey): string | null {
  const d = diffDays(today, key);
  if (d === 0) return '今日';
  if (d === 1) return '明日';
  if (d === -1) return '昨日';
  if (d === 2) return '明後日';
  return null;
}

const KANJI_MONTHS = ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走'];
/** 和風月名（装飾用） */
export function wafuMonthName(key: DateKey): string {
  return KANJI_MONTHS[parseDateKey(key).month - 1];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function romanMonth(key: DateKey): string {
  return ROMAN[parseDateKey(key).month - 1];
}
