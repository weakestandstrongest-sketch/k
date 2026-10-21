/**
 * Screen 2: THE ORRERY（天球儀 / カレンダー）
 * 日・週・月の3つの構図。日付を移動するとベゼルが回り、数字が一桁ずつ回転します。
 */
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Backdrop } from '../components/Backdrop';
import { DateBezel } from '../components/DateBezel';
import { Icon } from '../components/Icon';
import { RollingText } from '../components/RollingText';
import {
  addDays,
  addMonths,
  formatMonthJa,
  parseDateKey,
  relativeDayLabel,
  todayKey,
  wafuMonthName,
  weekdayOf,
  weekKeys,
  WEEKDAYS_JA_LONG,
} from '../lib/date';
import { ease, t } from '../motion/tokens';
import { useApp, type CalendarView } from '../state/AppContext';
import { holidayName } from '../lib/holidays';
import { useEvents } from '../state/EventsContext';
import { useNow } from '../state/useNow';
import { DayView } from './orrery/DayView';
import { MonthView } from './orrery/MonthView';
import { WeekView } from './orrery/WeekView';
import './Orrery.css';

const VIEWS: { id: CalendarView; label: string; depth: number }[] = [
  { id: 'day', label: '日', depth: 2 },
  { id: 'week', label: '週', depth: 1 },
  { id: 'month', label: '月', depth: 0 },
];

/** 表示の切り替え：深い構図（日）へは「近づく」、浅い構図（月）へは「離れる」 */
const zoomVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, scale: dir > 0 ? 0.94 : 1.05 }),
  center: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: ease.glide } },
  exit: (dir: number) => ({ opacity: 0, scale: dir > 0 ? 1.05 : 0.94, transition: { duration: 0.2, ease: ease.escapement } }),
};

export function Orrery() {
  const { focusDate, setFocusDate, dateDirection, calView, setCalView } = useApp();
  const { settings } = useEvents();
  const reduce = useReducedMotion();
  const now = useNow(60_000);
  const today = todayKey(now);
  const prevDepth = useRef(VIEWS.find((v) => v.id === calView)!.depth);
  const depth = VIEWS.find((v) => v.id === calView)!.depth;
  const zoomDir = depth >= prevDepth.current ? 1 : -1;
  useEffect(() => {
    prevDepth.current = depth;
  }, [depth]);

  const step = (dir: 1 | -1) => {
    if (calView === 'day') setFocusDate(addDays(focusDate, dir));
    else if (calView === 'week') setFocusDate(addDays(focusDate, dir * 7));
    else setFocusDate(addMonths(focusDate, dir));
  };

  // キーボード操作：← → で移動、T で今日、D/W/M で表示切り替え
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [role="dialog"], [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.chamber-layer, .dialog-layer, .review')) return;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 't' || e.key === 'T') setFocusDate(today);
      else if (e.key === 'd') setCalView('day');
      else if (e.key === 'w') setCalView('week');
      else if (e.key === 'm') setCalView('month');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // スマートフォン：左右のスワイプで日付を移動
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  // 固定ヘッダーの高さを CSS 変数に（週表示の曜日行をその下に固定するため）
  const headRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const head = headRef.current;
    if (!head || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      head.parentElement?.style.setProperty('--orrery-head-h', `${head.offsetHeight - 8}px`);
    });
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  const { year, month, day } = parseDateKey(focusDate);
  const rel = relativeDayLabel(focusDate, today);
  const week = weekKeys(focusDate, settings.weekStartsOn);
  const wa = parseDateKey(week[0]);
  const wb = parseDateKey(week[6]);

  let main: string;
  let sub: string;
  let caption: string;
  if (calView === 'day') {
    main = String(day).padStart(2, '0');
    sub = `${month}月 ${WEEKDAYS_JA_LONG[weekdayOf(focusDate)]}`;
    const holiday = holidayName(focusDate);
    caption = holiday ? `${year}年 · ${holiday}` : `${year}年`;
  } else if (calView === 'week') {
    main = `${String(wa.day).padStart(2, '0')}–${String(wb.day).padStart(2, '0')}`;
    sub = wa.month === wb.month ? `${wa.month}月` : `${wa.month}月 〜 ${wb.month}月`;
    caption = `${wa.year}年`;
  } else {
    main = String(month).padStart(2, '0');
    sub = wafuMonthName(focusDate);
    caption = `${year}年`;
  }
  const srTitle =
    calView === 'day'
      ? `${year}年${month}月${day}日 ${WEEKDAYS_JA_LONG[weekdayOf(focusDate)]}`
      : calView === 'week'
        ? `${wa.year}年${wa.month}月${wa.day}日から${wb.month}月${wb.day}日の週`
        : formatMonthJa(focusDate);

  return (
    <div className="screen__inner orrery">
      <Backdrop kind="orrery" />
      <header className="orrery__head" ref={headRef}>
        <p className="kicker orrery__kicker">THE ORRERY · 天球儀</p>
        <div className="orrery__views" role="tablist" aria-label="表示の切り替え">
          {[...VIEWS].reverse().map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={calView === v.id}
              className={`orrery__view ${calView === v.id ? 'is-on' : ''}`}
              onClick={() => setCalView(v.id)}
            >
              {calView === v.id && <motion.span layoutId="orrery-view-jewel" className="orrery__view-jewel" transition={t.chamber} />}
              <span className="orrery__view-label">{v.label}</span>
            </button>
          ))}
        </div>
        <span className="orrery__rule" aria-hidden="true" />
        <div className="orrery__date-row">
          <DateBezel date={focusDate} />
          <h1 className="orrery__date" aria-live="polite">
            <span className="sr-only">{srTitle}</span>
            <span className="orrery__main num" aria-hidden="true">
              <RollingText text={main} direction={dateDirection} />
            </span>
            <span className="orrery__sub" aria-hidden="true">
              <span className="orrery__caption">
                {caption}
                {rel && calView === 'day' && <span className="orrery__rel">{rel}</span>}
              </span>
              <RollingText text={sub} direction={dateDirection} mode="flip" stagger={0.02} />
            </span>
          </h1>
        </div>
        <div className="orrery__nav">
          <button type="button" className="btn btn--icon" onClick={() => step(-1)} aria-label={calView === 'day' ? '前の日' : calView === 'week' ? '前の週' : '前の月'}>
            <Icon name="prev" />
          </button>
          <button type="button" className="btn orrery__today" onClick={() => setFocusDate(today)} disabled={calView === 'day' && focusDate === today}>
            今日
          </button>
          <button type="button" className="btn btn--icon" onClick={() => step(1)} aria-label={calView === 'day' ? '次の日' : calView === 'week' ? '次の週' : '次の月'}>
            <Icon name="next" />
          </button>
        </div>
      </header>

      <div
        className="orrery__body"
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > 70 && Math.abs(dy) < 50) step(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={zoomDir}>
          <motion.div
            key={calView}
            className="orrery__view-stage"
            custom={zoomDir}
            variants={reduce ? undefined : zoomVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {calView === 'day' && <DayView />}
            {calView === 'week' && <WeekView />}
            {calView === 'month' && <MonthView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
