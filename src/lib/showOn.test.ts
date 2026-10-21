import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../data/types';
import { onDayScreens, onRangeScreens } from './showOn';

const ev = (id: string, show: CalendarEvent['show']) => ({ id, show }) as CalendarEvent;

describe('表示する場所', () => {
  const list = [ev('a', 'both'), ev('b', 'day'), ev('c', 'range')];
  it('ホームと「日」は、タイムラインの予定（range 以外）', () => {
    expect(onDayScreens(list).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('「週」と「月」は、カレンダーの予定（day 以外）', () => {
    expect(onRangeScreens(list).map((e) => e.id)).toEqual(['a', 'c']);
  });
});
