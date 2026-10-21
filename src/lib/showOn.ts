import type { CalendarEvent } from '../data/types';

/**
 * 画面ごとに出す予定を分ける（ひび手帳のタイムライン／カレンダーと同じ）
 * - ホームと「日」：ひび手帳のタイムラインの予定（show が 'range' のものは出さない）
 * - 「週」と「月」：ひび手帳のカレンダーの予定（show が 'day' のものは出さない）
 */
export const onDayScreens = (events: CalendarEvent[]): CalendarEvent[] => events.filter((e) => e.show !== 'range');
export const onRangeScreens = (events: CalendarEvent[]): CalendarEvent[] => events.filter((e) => e.show !== 'day');
