/**
 * 月表示：6週×7日の格子と、選んだ日の一覧（台帳）
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { EventRow } from '../../components/EventRow';
import { Icon } from '../../components/Icon';
import { categoryOf } from '../../data/categories';
import { emptyDraft } from '../../data/eventModel';
import type { CalendarEvent } from '../../data/types';
import { formatDateJa, formatDuration, isSameMonth, monthGridKeys, orderedWeekdays, parseDateKey, todayKey, weekdayOf, WEEKDAYS_JA, type DateKey } from '../../lib/date';
import { conflictingIds, eventsOnDate, totalFree } from '../../lib/schedule';
import { tickContainer, tickItem, tickItemReduced } from '../../motion/tokens';
import { useApp } from '../../state/AppContext';
import { useEvents } from '../../state/EventsContext';
import { useIsMobile } from '../../state/useMediaQuery';
import { useNow } from '../../state/useNow';
import { fadeOnly, slideVariants } from './DayView';

export function MonthView() {
  const { focusDate, dateDirection, setFocusDate, setCalView, openChamber } = useApp();
  const { events, settings } = useEvents();
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();
  const today = todayKey(useNow(60_000));
  const grid = monthGridKeys(focusDate, settings.weekStartsOn);
  const monthId = focusDate.slice(0, 7);
  const item = reduce ? tickItemReduced : tickItem;

  const byDate = useMemo(() => {
    const map = new Map<DateKey, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [events]);

  const selected = eventsOnDate(events, focusDate);
  const selectedConflicts = conflictingIds(selected);
  const maxChips = isMobile ? 0 : 3;

  // 表示を切り替えたときは先頭から
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (rootRef.current?.closest('.screen') as HTMLElement | null)?.scrollTo({ top: 0 });
  }, []);

  return (
    <div className="monthview" ref={rootRef}>
      <div className="monthview__calendar">
        <div className="mgrid__weekdays" aria-hidden="true">
          {orderedWeekdays(settings.weekStartsOn).map((wd) => (
            <span key={wd} className={wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : ''}>
              {WEEKDAYS_JA[wd]}
            </span>
          ))}
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={dateDirection}>
          <motion.div key={monthId} className="mgrid" role="grid" aria-label="月の予定" custom={dateDirection} variants={reduce ? fadeOnly : slideVariants} initial="enter" animate="center" exit="exit">
            {Array.from({ length: 6 }, (_, row) => (
              <div key={row} role="row" className="mgrid__row">
                {grid.slice(row * 7, row * 7 + 7).map((date) => {
                  const list = byDate.get(date) ?? [];
                  const inMonth = isSameMonth(date, focusDate);
                  const wd = weekdayOf(date);
                  const hasOverlap = [...conflictingIds(list).values()].includes('overlap');
                  const { day } = parseDateKey(date);
                  return (
                    <div key={date} role="gridcell" aria-selected={date === focusDate} className="mgrid__cell-wrap">
                      <button
                        type="button"
                        className={`mgrid__cell ${inMonth ? '' : 'is-outside'} ${date === today ? 'is-today' : ''} ${date === focusDate ? 'is-selected' : ''} ${wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : ''}`}
                        onClick={() => setFocusDate(date)}
                        onDoubleClick={() => setCalView('day')}
                        aria-label={`${formatDateJa(date)} 予定${list.length}件${hasOverlap ? '、重複あり' : ''}`}
                      >
                        {date === focusDate && <motion.span layoutId="mgrid-selection" className="mgrid__selection" transition={{ type: 'spring', stiffness: 420, damping: 36 }} aria-hidden="true" />}
                        <span className="mgrid__num num">{day}</span>
                        {hasOverlap && <span className="mgrid__conflict" aria-hidden="true" />}
                        {maxChips > 0 ? (
                          <span className="mgrid__chips" aria-hidden="true">
                            {list.slice(0, maxChips).map((e) => (
                              <span key={e.id} className={`mgrid__chip ${e.status === 'completed' ? 'is-completed' : ''}`} style={{ ['--cat' as string]: categoryOf(e.category).color }}>
                                {e.title}
                              </span>
                            ))}
                            {list.length > maxChips && <span className="mgrid__more">+{list.length - maxChips}件</span>}
                          </span>
                        ) : (
                          <span className="mgrid__dots" aria-hidden="true">
                            {list.slice(0, 4).map((e) => (
                              <span key={e.id} className="dot" style={{ ['--cat' as string]: categoryOf(e.category).color }} />
                            ))}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <section className="monthview__ledger" aria-labelledby="month-ledger-title">
        <div className="monthview__ledger-head">
          <p className="kicker">LEDGER</p>
          <h2 className="subheading" id="month-ledger-title">
            {formatDateJa(focusDate)}
          </h2>
          <p className="faint monthview__ledger-meta">
            予定 {selected.length}件 · 空き {formatDuration(totalFree(selected, { windowStart: settings.dayStartMin, windowEnd: settings.dayEndMin, includeBuffers: true }))}
          </p>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={focusDate} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {selected.length === 0 ? (
              <p className="muted monthview__empty">この日の予定はありません。</p>
            ) : (
              <motion.ul className="evrow-list" variants={tickContainer(0.04)} initial="hidden" animate="show">
                {selected.map((e) => (
                  <EventRow key={e.id} event={e} scope="month" conflict={selectedConflicts.get(e.id)} onOpen={(ev, k) => openChamber({ mode: 'view', id: ev.id, layoutKey: k })} variants={item} compact />
                ))}
              </motion.ul>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="monthview__ledger-actions">
          <button type="button" className="btn btn--small" onClick={() => setCalView('day')}>
            この日を日表示で開く
            <Icon name="next" size={14} />
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={() => openChamber({ mode: 'new', draft: emptyDraft(focusDate) })}>
            <Icon name="plus" size={14} />
            この日に予定を追加
          </button>
        </div>
      </section>
    </div>
  );
}
