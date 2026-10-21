/**
 * 週表示
 * - デスクトップ：7列の時間軸
 * - スマートフォン：横スクロールなしの縦の一覧（各日に小さな時間の帯）
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { EventRow } from '../../components/EventRow';
import { Icon } from '../../components/Icon';
import { categoryOf } from '../../data/categories';
import { emptyDraft } from '../../data/eventModel';
import type { CalendarEvent } from '../../data/types';
import { formatDuration, minutesOfDay, parseDateKey, todayKey, weekdayOf, weekKeys, WEEKDAYS_JA, type DateKey } from '../../lib/date';
import { holidayName } from '../../lib/holidays';
import { allDayOn, expandRange, timeLabel, type EventInstance } from '../../lib/recurrence';
import { assignLanes, conflictingIds, eventsOnDate, totalFree } from '../../lib/schedule';
import { tickContainer, tickItem, tickItemReduced } from '../../motion/tokens';
import { useApp } from '../../state/AppContext';
import { useEvents } from '../../state/EventsContext';
import { useIsMobile } from '../../state/useMediaQuery';
import { useNow } from '../../state/useNow';
import { fadeOnly, slideVariants } from './DayView';

export function WeekView() {
  const { focusDate, dateDirection, setFocusDate, setCalView, openChamber } = useApp();
  const { events, settings } = useEvents();
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();
  const now = useNow(60_000);
  const today = todayKey(now);
  const keys = weekKeys(focusDate, settings.weekStartsOn);
  const weekId = keys[0];

  const byDay = useMemo(() => keys.map((k) => ({ date: k, list: eventsOnDate(events, k), allDay: allDayOn(events, k) })), [events, weekId]); // eslint-disable-line react-hooks/exhaustive-deps
  const bars = useMemo(() => allDayBars(expandRange(events, keys[0], keys[6]), keys), [events, weekId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDay = (d: DateKey) => {
    setFocusDate(d);
    setCalView('day');
  };
  const open = (e: CalendarEvent, layoutKey?: string) => openChamber({ mode: 'view', id: e.id, layoutKey });

  return (
    <div className="weekview">
      <AnimatePresence mode="popLayout" initial={false} custom={dateDirection}>
        <motion.div key={weekId} custom={dateDirection} variants={reduce ? fadeOnly : slideVariants} initial="enter" animate="center" exit="exit">
          {isMobile ? (
            <WeekAgenda byDay={byDay} today={today} focusDate={focusDate} onOpenDay={openDay} onOpen={open} />
          ) : (
            <WeekGrid byDay={byDay} bars={bars} today={today} nowMin={minutesOfDay(now)} onOpenDay={openDay} onOpen={open} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

interface DayList {
  date: DateKey;
  list: CalendarEvent[];
  allDay: EventInstance[];
}

interface AllDayBar {
  event: EventInstance;
  /** 週の中の開始列・終了列（0〜6） */
  from: number;
  to: number;
  row: number;
}

/** 終日（と日をまたぐ予定の途中）を、週をまたぐ横長の帯にまとめて段を割り当てる */
function allDayBars(list: EventInstance[], keys: DateKey[]): AllDayBar[] {
  const groups = new Map<string, { event: EventInstance; from: number; to: number }>();
  for (const e of list) {
    if (!e.allDay) continue;
    const col = keys.indexOf(e.date);
    if (col < 0) continue;
    const key = `${e.baseId}@${e.occurrence}`;
    const g = groups.get(key);
    if (g) g.to = Math.max(g.to, col);
    else groups.set(key, { event: e, from: col, to: col });
  }
  const rows: number[][] = [];
  const out: AllDayBar[] = [];
  for (const g of [...groups.values()].sort((a, b) => a.from - b.from || b.to - b.from - (a.to - a.from))) {
    let row = rows.findIndex((cols) => cols.every((c) => c < g.from || c > g.to));
    if (row < 0) row = rows.push([]) - 1;
    for (let c = g.from; c <= g.to; c++) rows[row].push(c);
    out.push({ ...g, row });
  }
  return out;
}

function WeekGrid({
  byDay,
  bars,
  today,
  nowMin,
  onOpenDay,
  onOpen,
}: {
  byDay: DayList[];
  bars: AllDayBar[];
  today: DateKey;
  nowMin: number;
  onOpenDay: (d: DateKey) => void;
  onOpen: (e: CalendarEvent, layoutKey?: string) => void;
}) {
  const { settings } = useEvents();
  const { openChamber } = useApp();
  const hourPx = 44;
  const ppm = hourPx / 60;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const screen = body?.closest('.screen') as HTMLElement | null;
    if (!body || !screen) return;
    const offset = body.getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop;
    const head = (screen.querySelector('.orrery__head') as HTMLElement | null)?.offsetHeight ?? 0;
    screen.scrollTo({ top: Math.max(0, offset + ((settings.dayStartMin - 60) / 60) * hourPx - head - 90) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wgrid">
      <div className="wgrid__head">
        <span />
        {byDay.map(({ date, list, allDay }) => {
          const wd = weekdayOf(date);
          const conflicts = conflictingIds(list);
          const holiday = holidayName(date);
          const count = list.length + allDay.length;
          return (
            <button
              key={date}
              type="button"
              className={`wgrid__day ${date === today ? 'is-today' : ''} ${wd === 0 || holiday ? 'is-sun' : wd === 6 ? 'is-sat' : ''}`}
              onClick={() => onOpenDay(date)}
              aria-label={`${parseDateKey(date).month}月${parseDateKey(date).day}日（${WEEKDAYS_JA[wd]}）${holiday ? `、${holiday}` : ''}を日表示で開く、予定${count}件`}
            >
              <span className="wgrid__wd">{WEEKDAYS_JA[wd]}</span>
              <span className="wgrid__num num">{parseDateKey(date).day}</span>
              {holiday && <span className="wgrid__holiday">{holiday}</span>}
              <span className="wgrid__meta">
                {count > 0 ? `${count}件` : '—'}
                {[...conflicts.values()].includes('overlap') && <span className="wgrid__conflict" aria-hidden="true" />}
              </span>
            </button>
          );
        })}
        {bars.length > 0 && (
          <div className="wgrid__allday" style={{ gridTemplateRows: `repeat(${Math.max(...bars.map((b) => b.row)) + 1}, 26px)` }}>
            <span className="wgrid__allday-label" style={{ gridRow: `1 / -1` }}>
              終日
            </span>
            {bars.map(({ event: e, from, to, row }) => (
              <button
                key={`${e.baseId}@${e.occurrence}`}
                type="button"
                className="wgrid__bar"
                style={{ gridColumn: `${from + 2} / ${to + 3}`, gridRow: row + 1, ['--cat' as string]: categoryOf(e.category).color }}
                onClick={() => onOpen(e)}
              >
                {e.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="wgrid__body" ref={bodyRef} style={{ height: 24 * hourPx }}>
        <div className="wgrid__gutter" aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ top: h * hourPx }} className="num">
              {h}
            </span>
          ))}
        </div>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className={`wgrid__line ${h % 6 === 0 ? 'is-major' : ''}`} style={{ top: h * hourPx }} aria-hidden="true" />
        ))}
        <div className="wgrid__off" style={{ top: 0, height: settings.dayStartMin * ppm }} aria-hidden="true" />
        <div className="wgrid__off" style={{ top: settings.dayEndMin * ppm, height: (1440 - settings.dayEndMin) * ppm }} aria-hidden="true" />
        <div className="wgrid__cols">
          {byDay.map(({ date, list }) => {
            const lanes = assignLanes(list);
            const conflicts = conflictingIds(list);
            return (
              <div
                key={date}
                className={`wgrid__col ${date === today ? 'is-today' : ''}`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.wgrid__event')) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const min = Math.floor((e.clientY - r.top) / ppm / 30) * 30;
                  openChamber({ mode: 'new', draft: emptyDraft(date, Math.max(0, Math.min(1410, min))) });
                }}
              >
                {list.map((e) => {
                  const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
                  const cat = categoryOf(e.category);
                  const conflict = conflicts.get(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`wgrid__event ${conflict === 'overlap' ? 'is-overlap' : ''} ${e.status === 'completed' ? 'is-completed' : ''}`}
                      style={{
                        top: e.startMin * ppm,
                        height: Math.max(18, (e.endMin - e.startMin) * ppm - 2),
                        left: `${(lane.lane / lane.lanes) * 100}%`,
                        width: `calc(${100 / lane.lanes}% - 3px)`,
                        ['--cat' as string]: cat.color,
                      }}
                      onClick={() => onOpen(e, `week-${e.id}`)}
                      aria-label={`${timeLabel(e)} ${e.title}${conflict === 'overlap' ? '、重複あり' : ''}`}
                    >
                      <motion.span layoutId={`shell-week-${e.id}`} className="wgrid__shell" aria-hidden="true" />
                      <span className="wgrid__title">{e.title}</span>
                    </button>
                  );
                })}
                {date === today && <div className="wgrid__now" style={{ top: nowMin * ppm }} aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekAgenda({
  byDay,
  today,
  focusDate,
  onOpenDay,
  onOpen,
}: {
  byDay: DayList[];
  today: DateKey;
  focusDate: DateKey;
  onOpenDay: (d: DateKey) => void;
  onOpen: (e: CalendarEvent, layoutKey: string) => void;
}) {
  const { settings } = useEvents();
  const reduce = useReducedMotion();
  const item = reduce ? tickItemReduced : tickItem;
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    (listRef.current?.closest('.screen') as HTMLElement | null)?.scrollTo({ top: 0 });
  }, []);
  const ws = settings.dayStartMin;
  const we = settings.dayEndMin;
  const pct = (m: number) => ((Math.max(ws, Math.min(we, m)) - ws) / (we - ws)) * 100;

  return (
    <motion.ol ref={listRef} className="wagenda" variants={tickContainer(0.04)} initial="hidden" animate="show">
      {byDay.map(({ date, list, allDay }) => {
        const wd = weekdayOf(date);
        const conflicts = conflictingIds(list);
        const free = totalFree(list, { windowStart: ws, windowEnd: we, includeBuffers: true });
        const holiday = holidayName(date);
        const rows = [...allDay, ...list];
        return (
          <motion.li key={date} variants={item} className={`wagenda__day ${date === today ? 'is-today' : ''} ${date === focusDate ? 'is-focus' : ''}`}>
            <button type="button" className="wagenda__head" onClick={() => onOpenDay(date)} aria-label={`${parseDateKey(date).month}月${parseDateKey(date).day}日を日表示で開く`}>
              <span className={`wagenda__wd ${wd === 0 || holiday ? 'is-sun' : wd === 6 ? 'is-sat' : ''}`}>{WEEKDAYS_JA[wd]}</span>
              <span className="wagenda__num num">{parseDateKey(date).day}</span>
              <span className="wagenda__meta">
                {holiday && <span className="chip chip--holiday">{holiday}</span>}
                {rows.length}件 · 空き {formatDuration(free)}
                {[...conflicts.values()].includes('overlap') && <span className="chip chip--danger">重複</span>}
              </span>
              <Icon name="next" size={16} />
            </button>
            <div className="wagenda__bar" aria-hidden="true">
              {list.map((e) => (
                <span
                  key={e.id}
                  style={{ left: `${pct(e.startMin)}%`, width: `${Math.max(1, pct(e.endMin) - pct(e.startMin))}%`, ['--cat' as string]: categoryOf(e.category).color }}
                />
              ))}
            </div>
            {rows.length > 0 && (
              <ul className="evrow-list">
                {rows.map((e) => (
                  <EventRow key={e.id} event={e} scope={`wagenda-${date}`} conflict={conflicts.get(e.id)} onOpen={onOpen} compact />
                ))}
              </ul>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
