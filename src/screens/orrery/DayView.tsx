/**
 * 日表示：縦の時間軸
 * - 予定のつまみ（⋮⋮）をドラッグ、またはキーボードの ↑↓ で時刻を動かせます
 * - 動かしている間：空く時間（点線）、移動先（帯）、ぶつかる予定（赤）を表示
 * - 空いている場所を押すと、その時刻で新しい予定を作成
 */
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ClockFace } from '../../components/ClockFace';
import { Icon } from '../../components/Icon';
import { categoryOf } from '../../data/categories';
import { emptyDraft } from '../../data/eventModel';
import type { CalendarEvent } from '../../data/types';
import { formatDuration, formatMinutes, formatTimeRange, minutesOfDay, todayKey, type DateKey } from '../../lib/date';
import { holidayName } from '../../lib/holidays';
import { canDrag, timeLabel } from '../../lib/recurrence';
import { assignLanes, conflictsFor, eventsOnDate, freeSlots, snapMinutes, type ConflictKind, type FreeSlot } from '../../lib/schedule';
import { ease } from '../../motion/tokens';
import { useApp } from '../../state/AppContext';
import { useEvents } from '../../state/EventsContext';
import { useRequestMove } from '../../state/MoveContext';
import { useIsMobile } from '../../state/useMediaQuery';
import { useDayData } from '../../state/useDayData';
import { useNow } from '../../state/useNow';

export const slideVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 48 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.36, ease: ease.escapement } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -48, transition: { duration: 0.24, ease: ease.escapement } }),
};

export const fadeOnly: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

export function DayView() {
  const { focusDate, dateDirection, openChamber } = useApp();
  const { events, settings } = useEvents();
  const isMobile = useIsMobile();
  const reduce = useReducedMotion();
  const now = useNow(60_000);
  const today = todayKey(now);
  const nowMin = focusDate === today ? minutesOfDay(now) : null;
  const data = useDayData(events, focusDate, settings, null);
  const hourPx = isMobile ? 52 : 60;
  const frameRef = useRef<HTMLDivElement>(null);

  // 表示したときに、活動の始まり（今日なら現在時刻の少し前）までスクロール
  useEffect(() => {
    const frame = frameRef.current;
    const screen = frame?.closest('.screen') as HTMLElement | null;
    if (!frame || !screen) return;
    const target = Math.max(0, (nowMin ?? settings.dayStartMin) - 60);
    const offset = frame.getBoundingClientRect().top - screen.getBoundingClientRect().top + screen.scrollTop;
    const head = (screen.querySelector('.orrery__head') as HTMLElement | null)?.offsetHeight ?? 0;
    screen.scrollTo({ top: Math.max(0, offset + (target / 60) * hourPx - head - 16), behavior: 'auto' });
    // 表示切り替え時のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createAt = (min: number) => openChamber({ mode: 'new', draft: emptyDraft(focusDate, Math.min(min, 1380)) });
  const holiday = holidayName(focusDate);

  return (
    <div className="dayview">
      <div className="dayview__main">
        <div className="dayview__chips" aria-label="この日の概要">
          {holiday && <span className="chip chip--holiday">{holiday}</span>}
          <span className="chip">予定 {data.day.length + data.allDay.length}件</span>
          <span className="chip">空き {formatDuration(data.freeAllDay)}</span>
          {data.overlapCount > 0 && <span className="chip chip--danger">重複 {data.overlapCount}件</span>}
          {data.bufferCount > 0 && <span className="chip chip--warn">余白の重なり {data.bufferCount}件</span>}
        </div>
        <p className="dayview__hint faint">空いている時間を押すと予定を作成。つまみ（⋮⋮）をドラッグすると時刻を動かせます。</p>
        {data.allDay.length > 0 && (
          <ul className="dayview__allday" aria-label="終日の予定">
            {data.allDay.map((e) => (
              <li key={e.id} style={{ ['--cat' as string]: categoryOf(e.category).color }}>
                <button type="button" onClick={() => openChamber({ mode: 'view', id: e.id })}>
                  <span className="dayview__allday-tag">{e.segment === 'single' ? '終日' : e.segment === 'first' ? '開始' : e.segment === 'last' ? '終了' : '期間中'}</span>
                  <span className="dayview__allday-title">{e.title}</span>
                  {e.recurring && <Icon name="repeat" size={12} />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="dayview__frame" ref={frameRef}>
          <AnimatePresence mode="popLayout" initial={false} custom={dateDirection}>
            <motion.div
              key={focusDate}
              className="dayview__slide"
              custom={dateDirection}
              variants={reduce ? fadeOnly : slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <DayTimeline
                date={focusDate}
                dayEvents={data.day}
                conflictMap={data.conflictMap}
                hourPx={hourPx}
                nowMin={nowMin}
                windowStart={settings.dayStartMin}
                windowEnd={settings.dayEndMin}
                onCreateAt={createAt}
                onOpen={(e) => openChamber({ mode: 'view', id: e.id, layoutKey: `day-${e.id}` })}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!isMobile && (
        <aside className="dayview__side" aria-label="この日の時間">
          <ClockFace
            key={focusDate}
            events={data.day}
            dateKey={focusDate}
            nowMin={nowMin}
            windowStart={settings.dayStartMin}
            windowEnd={settings.dayEndMin}
            conflicts={data.conflictMap}
            free={freeSlots(data.day, { windowStart: settings.dayStartMin, windowEnd: settings.dayEndMin, includeBuffers: true, minLength: 5 })}
            onSelect={(e) => openChamber({ mode: 'view', id: e.id, layoutKey: `day-${e.id}` })}
            variant="compact"
            centerLabel="空き時間"
            centerValue={formatDuration(data.freeAllDay)}
            ariaLabel={`この日の予定 ${data.day.length}件の時計盤`}
          />
          <dl className="dayview__facts">
            <div>
              <dt>予定</dt>
              <dd className="num">{data.day.length}件</dd>
            </div>
            <div>
              <dt>予定の合計</dt>
              <dd className="num">{formatDuration(data.plannedMinutes)}</dd>
            </div>
            <div>
              <dt>空き（活動時間内）</dt>
              <dd className="num">{formatDuration(data.freeAllDay)}</dd>
            </div>
            <div>
              <dt>重複</dt>
              <dd className={`num ${data.overlapCount ? 'text-danger' : ''}`}>{data.overlapCount}件</dd>
            </div>
          </dl>
          <SideFreeList date={focusDate} onCreate={(s) => createAt(s.start)} />
        </aside>
      )}
    </div>
  );
}

function SideFreeList({ date, onCreate }: { date: DateKey; onCreate: (s: FreeSlot) => void }) {
  const { events, settings } = useEvents();
  const slots = useMemo(
    () => freeSlots(eventsOnDate(events, date), { windowStart: settings.dayStartMin, windowEnd: settings.dayEndMin, includeBuffers: true, minLength: 30 }),
    [events, date, settings.dayStartMin, settings.dayEndMin],
  );
  if (slots.length === 0) return <p className="faint dayview__free-empty">30分以上の空きはありません。</p>;
  return (
    <div className="dayview__free">
      <p className="dayview__free-title">30分以上の空き</p>
      <ul>
        {slots.slice(0, 6).map((s) => (
          <li key={s.start}>
            <button type="button" onClick={() => onCreate(s)} aria-label={`${formatTimeRange(s.start, s.end)} の空きに予定を作成`}>
              <span className="num">{formatTimeRange(s.start, s.end)}</span>
              <span>{formatDuration(s.minutes)}</span>
              <Icon name="plus" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- 時間軸 ----------

interface TimelineProps {
  date: DateKey;
  dayEvents: CalendarEvent[];
  conflictMap: Map<string, ConflictKind>;
  hourPx: number;
  nowMin: number | null;
  windowStart: number;
  windowEnd: number;
  onCreateAt: (min: number) => void;
  onOpen: (e: CalendarEvent) => void;
}

interface DragState {
  id: string;
  start: number;
  mode: 'pointer' | 'keyboard';
}

function DayTimeline({ dayEvents, conflictMap, hourPx, nowMin, windowStart, windowEnd, onCreateAt, onOpen }: TimelineProps) {
  const requestMove = useRequestMove();
  const ppm = hourPx / 60;
  const lanes = useMemo(() => assignLanes(dayEvents), [dayEvents]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<{ id: string; startY: number; origStart: number; dur: number; scrollStart: number; screen: HTMLElement | null } | null>(null);
  const justDragged = useRef(false);

  const dragged = drag ? dayEvents.find((e) => e.id === drag.id) : undefined;
  const dragDur = dragged ? dragged.endMin - dragged.startMin : 0;
  const threatened = useMemo(() => {
    if (!drag || !dragged) return new Map<string, ConflictKind>();
    const hits = conflictsFor({ ...dragged, startMin: drag.start, endMin: drag.start + dragDur }, dayEvents);
    return new Map(hits.map((h) => [h.event.id, h.kind]));
  }, [drag, dragged, dragDur, dayEvents]);

  const free = useMemo(
    () => freeSlots(dayEvents, { windowStart, windowEnd, includeBuffers: true, minLength: 30 }),
    [dayEvents, windowStart, windowEnd],
  );

  // ---- ポインター（マウス・指）でのドラッグ ----
  const onHandleDown = (e: PointerEvent<HTMLButtonElement>, ev: CalendarEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const screen = e.currentTarget.closest('.screen') as HTMLElement | null;
    dragRef.current = { id: ev.id, startY: e.clientY, origStart: ev.startMin, dur: ev.endMin - ev.startMin, scrollStart: screen?.scrollTop ?? 0, screen };
    document.body.classList.add('is-dragging');
    setDrag({ id: ev.id, start: ev.startMin, mode: 'pointer' });
  };

  const onHandleMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const scroll = (d.screen?.scrollTop ?? 0) - d.scrollStart;
    const deltaMin = snapMinutes((e.clientY - d.startY + scroll) / ppm, 15);
    const start = Math.max(0, Math.min(1440 - d.dur, d.origStart + deltaMin));
    setDrag((prev) => (prev && prev.start === start ? prev : { id: d.id, start, mode: 'pointer' }));
    // 画面の端に近づいたら自動でスクロール
    if (d.screen) {
      const r = d.screen.getBoundingClientRect();
      if (e.clientY < r.top + 70) d.screen.scrollBy(0, -14);
      else if (e.clientY > r.bottom - 110) d.screen.scrollBy(0, 14);
    }
  };

  const finishDrag = (commit: boolean) => {
    const d = dragRef.current;
    const current = drag;
    dragRef.current = null;
    document.body.classList.remove('is-dragging');
    setDrag(null);
    if (!d || !current) return;
    if (current.start !== d.origStart) justDragged.current = true;
    if (commit && current.start !== d.origStart) {
      const ev = dayEvents.find((x) => x.id === d.id);
      if (ev) void requestMove(ev, current.start);
    }
  };

  // ---- キーボードでの移動 ----
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>, ev: CalendarEvent) => {
    const dur = ev.endMin - ev.startMin;
    const cur = drag?.id === ev.id ? drag.start : ev.startMin;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(0, Math.min(1440 - dur, cur + (e.key === 'ArrowUp' ? -15 : 15)));
      setDrag({ id: ev.id, start: next, mode: 'keyboard' });
    } else if (e.key === 'Enter' && drag?.id === ev.id) {
      e.preventDefault();
      setDrag(null);
      if (drag.start !== ev.startMin) void requestMove(ev, drag.start);
    } else if (e.key === 'Escape' && drag) {
      e.preventDefault();
      e.stopPropagation();
      setDrag(null);
    }
  };

  const onBackgroundClick = (e: MouseEvent<HTMLDivElement>) => {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest('.tl__event')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((e.clientY - rect.top) / ppm / 30) * 30;
    onCreateAt(Math.max(0, Math.min(1410, min)));
  };

  return (
    <div className={`tl ${drag ? 'is-dragging' : ''}`} style={{ height: 24 * hourPx }} onClick={onBackgroundClick}>
      {/* 時刻の目盛り */}
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} className={`tl__hour ${h % 6 === 0 ? 'is-major' : ''}`} style={{ top: h * hourPx, height: hourPx }} aria-hidden="true">
          <span className="tl__hour-label num">{h}</span>
        </div>
      ))}
      <div className="tl__off" style={{ top: 0, height: windowStart * ppm }} aria-hidden="true" />
      <div className="tl__off" style={{ top: windowEnd * ppm, height: (1440 - windowEnd) * ppm }} aria-hidden="true" />

      {/* 空き時間 */}
      {!drag &&
        free.map((s) => (
          <div key={s.start} className="tl__free" style={{ top: s.start * ppm, height: s.minutes * ppm }} aria-hidden="true">
            <span>空き {formatDuration(s.minutes)}</span>
          </div>
        ))}

      {/* 移動中：空く時間と移動先 */}
      {drag && dragged && (
        <>
          <div className="tl__vacated" style={{ top: dragged.startMin * ppm, height: dragDur * ppm }} aria-hidden="true">
            <span>空く時間 {formatTimeRange(dragged.startMin, dragged.endMin)}</span>
          </div>
          <div
            className={`tl__target ${threatened.size > 0 ? 'is-conflict' : ''}`}
            style={{ top: drag.start * ppm, height: dragDur * ppm }}
            aria-hidden="true"
          />
        </>
      )}

      {/* 現在時刻 */}
      {nowMin != null && (
        <div className="tl__now" style={{ top: nowMin * ppm }} aria-hidden="true">
          <span className="tl__now-label num">{formatMinutes(nowMin)}</span>
        </div>
      )}

      <div className="tl__lanes">
        {dayEvents.map((e) => {
          const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
          const cat = categoryOf(e.category);
          const height = Math.max(22, (e.endMin - e.startMin) * ppm - 2);
          const short = height < 44;
          const conflict = conflictMap.get(e.id);
          const threat = threatened.get(e.id);
          const isDragged = drag?.id === e.id;
          return (
            <motion.div
              key={e.id}
              layout="position"
              transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 } }}
              className={`tl__event ${short ? 'is-short' : ''} ${lane.lanes > 1 ? 'is-split' : ''} ${isDragged ? 'is-source' : ''} ${threat ? `is-threat-${threat}` : ''} ${conflict ? `is-${conflict}` : ''} ${e.status !== 'planned' ? `is-${e.status}` : ''}`}
              style={{
                top: e.startMin * ppm,
                height,
                left: `${(lane.lane / lane.lanes) * 100}%`,
                width: `calc(${100 / lane.lanes}% - 4px)`,
                ['--cat' as string]: cat.color,
              }}
            >
              {e.bufferBeforeMin > 0 && <span className="tl__buffer tl__buffer--before" style={{ height: e.bufferBeforeMin * ppm }} aria-hidden="true" />}
              {e.bufferAfterMin > 0 && <span className="tl__buffer tl__buffer--after" style={{ height: e.bufferAfterMin * ppm }} aria-hidden="true" />}
              <motion.span layoutId={`shell-day-${e.id}`} className="tl__shell" aria-hidden="true" />
              <button
                type="button"
                className="tl__open"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onOpen(e);
                }}
                aria-label={`${timeLabel(e)} ${e.title}、${cat.label}${conflict === 'overlap' ? '、重複あり' : ''}`}
              >
                <span className="tl__time num">{timeLabel(e)}</span>
                <span className="tl__title">
                  {e.status === 'completed' && <Icon name="check" size={12} />}
                  {e.repeat && <Icon name="repeat" size={11} />}
                  {e.title}
                </span>
                {!short && e.location && <span className="tl__loc">{e.location}</span>}
              </button>
              <span className="tl__flags" aria-hidden="true">
                {e.fixed && <Icon name="lock" size={12} />}
                {conflict === 'overlap' && <span className="tl__flag">重複</span>}
                {e.isSample && !short && <span className="tl__flag tl__flag--sample">見本</span>}
              </span>
              {canDrag(e) && (
              <button
                type="button"
                className="tl__grip"
                aria-label={`「${e.title}」の時刻を移動（上下キーで15分ずつ、Enterで確定、Escで取り消し）`}
                onPointerDown={(ev) => onHandleDown(ev, e)}
                onPointerMove={onHandleMove}
                onPointerUp={() => finishDrag(true)}
                onPointerCancel={() => finishDrag(false)}
                onLostPointerCapture={() => dragRef.current && finishDrag(true)}
                onKeyDown={(ev) => onHandleKey(ev, e)}
                onBlur={() => drag?.mode === 'keyboard' && drag.id === e.id && setDrag(null)}
                onClick={(ev) => ev.stopPropagation()}
              >
                <Icon name="grip" size={16} />
              </button>
              )}
            </motion.div>
          );
        })}

        {/* 移動先のゴースト */}
        {drag && dragged && (
          <div
            className={`tl__ghost ${threatened.size > 0 ? 'is-conflict' : ''}`}
            style={{ top: drag.start * ppm, height: Math.max(22, dragDur * ppm - 2), ['--cat' as string]: categoryOf(dragged.category).color }}
            aria-hidden="true"
          >
            <span className="tl__time num">{formatTimeRange(drag.start, drag.start + dragDur)}</span>
            <span className="tl__title">{dragged.title}</span>
            {threatened.size > 0 && <span className="tl__ghost-warn">{threatened.size}件と重なります</span>}
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="assertive">
        {drag && dragged ? `${formatTimeRange(drag.start, drag.start + dragDur)} へ移動${threatened.size > 0 ? `、${threatened.size}件と重なります` : ''}` : ''}
      </p>
    </div>
  );
}
