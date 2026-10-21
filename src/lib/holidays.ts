/**
 * 日本の祝日（「国民の祝日に関する法律」に基づく計算）
 *
 * - 固定の祝日、ハッピーマンデー（第n月曜）、春分・秋分（天文計算の近似式）
 * - 振替休日（祝日が日曜なら、その後の最初の平日）
 * - 国民の休日（祝日に挟まれた平日）
 * - 2020・2021 年の東京五輪に伴う移動
 * 対象は 2000〜2099 年。将来の法改正や、一度きりの臨時の祝日は反映されません。
 */
import { addDays, daysInMonth, makeDateKey, parseDateKey, weekdayOf, type DateKey } from './date';

/** その月の第 n 月曜日 */
function nthMonday(year: number, month: number, n: number): DateKey {
  const first = makeDateKey(year, month, 1);
  const offset = (1 - weekdayOf(first) + 7) % 7;
  return makeDateKey(year, month, 1 + offset + (n - 1) * 7);
}

/** 春分日・秋分日（1980〜2099 年で有効な近似式） */
function equinoxDay(year: number, kind: 'spring' | 'autumn'): number {
  const base = kind === 'spring' ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function baseHolidays(year: number): Map<DateKey, string> {
  const m = new Map<DateKey, string>();
  const add = (key: DateKey, name: string) => m.set(key, name);
  add(makeDateKey(year, 1, 1), '元日');
  add(nthMonday(year, 1, 2), '成人の日');
  add(makeDateKey(year, 2, 11), '建国記念の日');
  if (year >= 2020) add(makeDateKey(year, 2, 23), '天皇誕生日');
  else if (year <= 2018) add(makeDateKey(year, 12, 23), '天皇誕生日');
  add(makeDateKey(year, 3, equinoxDay(year, 'spring')), '春分の日');
  add(makeDateKey(year, 4, 29), year >= 2007 ? '昭和の日' : 'みどりの日');
  add(makeDateKey(year, 5, 3), '憲法記念日');
  if (year >= 2007) add(makeDateKey(year, 5, 4), 'みどりの日');
  add(makeDateKey(year, 5, 5), 'こどもの日');
  // 海の日・山の日・スポーツの日（2020・2021 年は五輪のため移動）
  if (year === 2020) {
    add('2020-07-23', '海の日');
    add('2020-07-24', 'スポーツの日');
    add('2020-08-10', '山の日');
  } else if (year === 2021) {
    add('2021-07-22', '海の日');
    add('2021-07-23', 'スポーツの日');
    add('2021-08-08', '山の日');
  } else {
    add(nthMonday(year, 7, 3), '海の日');
    if (year >= 2016) add(makeDateKey(year, 8, 11), '山の日');
    add(nthMonday(year, 10, 2), year >= 2020 ? 'スポーツの日' : '体育の日');
  }
  add(nthMonday(year, 9, 3), '敬老の日');
  add(makeDateKey(year, 9, equinoxDay(year, 'autumn')), '秋分の日');
  add(makeDateKey(year, 11, 3), '文化の日');
  add(makeDateKey(year, 11, 23), '勤労感謝の日');
  return m;
}

const cache = new Map<number, Map<DateKey, string>>();

/** その年の祝日の一覧（日付 → 名前） */
export function holidaysOf(year: number): Map<DateKey, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const m = baseHolidays(year);
  const fixed = [...m.keys()].sort();
  // 国民の休日：前後が祝日の平日（日曜以外）
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const key = makeDateKey(year, month, day);
      if (m.has(key) || weekdayOf(key) === 0) continue;
      if (m.has(addDays(key, -1)) && m.has(addDays(key, 1))) m.set(key, '国民の休日');
    }
  }
  // 振替休日：日曜の祝日のあと、最初の祝日でない日
  for (const key of fixed) {
    if (weekdayOf(key) !== 0) continue;
    let d = addDays(key, 1);
    while (m.has(d)) d = addDays(d, 1);
    if (parseDateKey(d).year === year) m.set(d, '振替休日');
  }
  cache.set(year, m);
  return m;
}

/** 祝日の名前（祝日でなければ null） */
export function holidayName(date: DateKey): string | null {
  const { year } = parseDateKey(date);
  if (year < 2000 || year > 2099) return null;
  return holidaysOf(year).get(date) ?? null;
}
