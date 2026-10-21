/**
 * Screen 5: THE CHRONICLE（年代記 / 振り返り）
 *
 * 「予定時間」（登録された長さ）と「実績」（利用者が記録したもの）を厳密に分けて表示します。
 * 記録のない完了や実績時間を推測で作ることはありません。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Backdrop } from '../components/Backdrop';
import { DateStepper } from '../components/DateStepper';
import { Icon } from '../components/Icon';
import { categoryOf } from '../data/categories';
import { STATUS_LABEL } from '../data/eventModel';
import type { CalendarEvent } from '../data/types';
import { dayRecords, eventsInRange, summarize, type PeriodSummary } from '../lib/analytics';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatDateJa,
  formatDuration,
  formatMonthJa,
  formatTimeRange,
  formatWeekRangeJa,
  parseDateKey,
  rangeKeys,
  diffDays,
  startOfMonth,
  todayKey,
  weekdayOf,
  weekKeys,
  WEEKDAYS_JA,
  type DateKey,
} from '../lib/date';
import { ease, t, tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { useNow } from '../state/useNow';
import './Chronicle.css';

type Period = 'day' | 'week' | 'month';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'week', label: '週' },
  { id: 'month', label: '月' },
];

export function Chronicle() {
  const { events, settings } = useEvents();
  const { setReviewDate, openChamber, setFocusDate, setCalView, navigate } = useApp();
  const reduce = useReducedMotion();
  const today = todayKey(useNow(60_000));
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<DateKey>(today);
  const [dir, setDir] = useState<1 | -1>(1);
  const item = reduce ? tickItemReduced : tickItem;

  const range = useMemo(() => {
    if (period === 'day') return { start: anchor, end: anchor };
    if (period === 'week') {
      const keys = weekKeys(anchor, settings.weekStartsOn);
      return { start: keys[0], end: keys[6] };
    }
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }, [period, anchor, settings.weekStartsOn]);

  const summary = useMemo(() => summarize(events, range.start, range.end, today), [events, range, today]);
  const days = rangeKeys(range.start, diffDays(range.start, range.end) + 1);
  const history = useMemo(() => dayRecords(events, addDays(today, -90), today), [events, today]);

  const move = (d: 1 | -1) => {
    setDir(d);
    setAnchor((a) => (period === 'day' ? addDays(a, d) : period === 'week' ? addDays(a, d * 7) : addMonths(a, d)));
  };
  const label = period === 'day' ? formatDateJa(anchor) : period === 'week' ? formatWeekRangeJa(weekKeys(anchor, settings.weekStartsOn)).replace(/^\d+年/, '') : formatMonthJa(anchor);
  const containsToday = range.start <= today && today <= range.end;
  const open = (e: CalendarEvent) => openChamber({ mode: 'view', id: e.id });

  return (
    <div className="screen__inner chronicle">
      <Backdrop kind="chronicle" intro />
      <motion.div className="chr" variants={tickContainer(0.06, 0.1)} initial="hidden" animate="show">
        <motion.header className="chr__head" variants={item}>
          <div>
            <p className="kicker">THE CHRONICLE · 年代記</p>
            <h1 className="heading">振り返り</h1>
          </div>
          <div className="chr__controls">
            <div className="chr__periods" role="tablist" aria-label="集計の期間">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={period === p.id} className={period === p.id ? 'is-on' : ''} onClick={() => setPeriod(p.id)}>
                  {period === p.id && <motion.span layoutId="chr-period" className="chr__period-jewel" transition={t.chamber} />}
                  <span className="chr__period-label">{p.label}</span>
                </button>
              ))}
            </div>
            <DateStepper
              label={label}
              srLabel={`${formatDateJa(range.start, { year: true })}から${formatDateJa(range.end, { year: true })}`}
              direction={dir}
              onPrev={() => move(-1)}
              onNext={() => move(1)}
              onToday={() => {
                setDir(anchor < today ? 1 : -1);
                setAnchor(today);
              }}
              isToday={containsToday}
              prevLabel="前の期間"
              nextLabel="次の期間"
            />
          </div>
        </motion.header>

        <motion.p className="chr__notice" variants={item}>
          <Icon name="chronicle" size={16} />
          <span>
            <strong>予定時間</strong>は登録された開始〜終了の長さ、<strong>完了</strong>と<strong>実績時間</strong>はあなたが記録したものだけを集計しています。
            {summary.sampleCount > 0 && ` この期間には見本の予定が${summary.sampleCount}件含まれます（見本の記録も見本です）。`}
          </span>
        </motion.p>

        <motion.section className="chr__kpis" variants={item} aria-label="期間の概要">
          <Kpi label="予定" value={`${summary.eventCount}`} unit="件" />
          <Kpi label="予定時間（計画）" value={formatDuration(summary.plannedMinutes)} />
          <Kpi label="完了の記録" value={`${summary.completedCount}`} unit="件" note={summary.missedCount > 0 ? `未実施 ${summary.missedCount}件` : undefined} />
          <Kpi
            label="実績時間（記録あり）"
            value={summary.withActual.length > 0 ? formatDuration(summary.actualMinutesTotal) : '—'}
            note={summary.withActual.length > 0 ? `${summary.withActual.length}件・同じ予定の計画は${formatDuration(summary.plannedMinutesOfActual)}` : '記録はまだありません'}
          />
          <Kpi label="記録なし" value={`${summary.unrecordedCount}`} unit="件" note="今日までの予定で未記録" />
        </motion.section>

        <div className="chr__grid">
          <motion.section className="chr__panel chr__orrery" variants={item} aria-labelledby="chr-cat">
            <h2 className="subheading" id="chr-cat">
              カテゴリー別の予定時間
            </h2>
            {summary.eventCount === 0 ? <Empty /> : <CategoryOrrery summary={summary} />}
          </motion.section>

          <motion.section className="chr__panel" variants={item} aria-labelledby="chr-actual">
            <h2 className="subheading" id="chr-actual">
              計画と実績
            </h2>
            <PlannedVsActual summary={summary} onOpen={open} />
          </motion.section>
        </div>

        <motion.section className="chr__panel" variants={item} aria-labelledby="chr-timeline">
          <div className="chr__panel-head">
            <h2 className="subheading" id="chr-timeline">
              時間の帯
            </h2>
            <p className="chr__legend faint" aria-hidden="true">
              <span><i className="chr-lg chr-lg--done" />完了</span>
              <span><i className="chr-lg chr-lg--planned" />記録なし</span>
              <span><i className="chr-lg chr-lg--missed" />未実施</span>
            </p>
          </div>
          <Ledger days={days} events={eventsInRange(events, range.start, range.end).filter((e) => !e.allDay)} today={today} windowStart={settings.dayStartMin} windowEnd={settings.dayEndMin} onOpenEvent={open} onReview={setReviewDate} />
        </motion.section>

        <motion.section className="chr__panel chr__archive" variants={item} aria-labelledby="chr-history">
          <h2 className="subheading" id="chr-history">
            記録の書庫（過去90日）
          </h2>
          {history.length === 0 ? (
            <p className="muted">過去の予定はまだありません。</p>
          ) : (
            <ol className="chr__history">
              {history.slice(0, 40).map((r) => {
                const wd = weekdayOf(r.date);
                return (
                  <li key={r.date}>
                    <span className="chr__history-date">
                      <span className="num">{parseDateKey(r.date).month}.{String(parseDateKey(r.date).day).padStart(2, '0')}</span>
                      <span className="faint">{WEEKDAYS_JA[wd]}</span>
                    </span>
                    <span className="chr__history-bar" aria-hidden="true">
                      <span style={{ width: `${(r.completedCount / r.events.length) * 100}%` }} className="is-done" />
                      <span style={{ width: `${((r.recordedCount - r.completedCount) / r.events.length) * 100}%` }} className="is-missed" />
                    </span>
                    <span className="chr__history-meta">
                      {r.events.length}件 · 完了 {r.completedCount} · 記録 {r.recordedCount}/{r.events.length}
                    </span>
                    <span className="chr__history-actions">
                      <button type="button" className="btn btn--small" onClick={() => setReviewDate(r.date)}>
                        振り返る
                      </button>
                      <button
                        type="button"
                        className="btn btn--small btn--ghost"
                        onClick={() => {
                          setFocusDate(r.date);
                          setCalView('day');
                          navigate('orrery');
                        }}
                        aria-label={`${formatDateJa(r.date)}をカレンダーで開く`}
                      >
                        <Icon name="orrery" size={16} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}

function Kpi({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="chr__kpi">
      <span className="chr__kpi-label">{label}</span>
      <span className="chr__kpi-value num">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {note && <span className="chr__kpi-note">{note}</span>}
    </div>
  );
}

function Empty() {
  return <p className="muted">この期間の予定はありません。</p>;
}

/** 二重の円環：外側＝予定時間の割合、内側＝そのうち完了と記録された予定の割合 */
function CategoryOrrery({ summary }: { summary: PeriodSummary }) {
  const reduce = useReducedMotion();
  const total = summary.plannedMinutes || 1;
  const R1 = 150;
  const R2 = 118;
  const C1 = 2 * Math.PI * R1;
  const C2 = 2 * Math.PI * R2;
  let acc = 0;
  const segs = summary.byCategory.map((c) => {
    const share = c.plannedMinutes / total;
    const seg = { c, start: acc, share };
    acc += share;
    return seg;
  });

  return (
    <div className="chr__orrery-body">
      <svg viewBox="-200 -200 400 400" className="chr__rings" role="img" aria-label={`予定時間の合計 ${formatDuration(summary.plannedMinutes)} のカテゴリー別の割合`}>
        <circle r={R1} className="chr__ring-track" />
        <circle r={R2} className="chr__ring-track chr__ring-track--inner" />
        {segs.map(({ c, start, share }, i) => (
          <motion.circle
            key={c.category}
            r={R1}
            className="chr__ring-seg"
            stroke={categoryOf(c.category).color}
            strokeDasharray={`${Math.max(0, share * C1 - 2)} ${C1}`}
            transform={`rotate(${start * 360 - 90})`}
            initial={reduce ? false : { opacity: 0, strokeDashoffset: share * C1 }}
            animate={{ opacity: 1, strokeDashoffset: 0 }}
            transition={{ duration: 0.8, ease: ease.glide, delay: 0.2 + i * 0.08 }}
          />
        ))}
        {segs.map(({ c, start, share }, i) => {
          const done = c.count > 0 ? c.completedCount / c.count : 0;
          return (
            <motion.circle
              key={`in-${c.category}`}
              r={R2}
              className="chr__ring-seg chr__ring-seg--inner"
              stroke={categoryOf(c.category).color}
              strokeDasharray={`${Math.max(0, share * done * C2 - 1)} ${C2}`}
              transform={`rotate(${start * 360 - 90})`}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 + i * 0.06 }}
            />
          );
        })}
        <text y={-14} textAnchor="middle" className="chr__rings-label">
          予定時間
        </text>
        <text y={30} textAnchor="middle" className="chr__rings-value">
          {formatDuration(summary.plannedMinutes)}
        </text>
      </svg>
      <ul className="chr__cats">
        {summary.byCategory.map((c) => {
          const cat = categoryOf(c.category);
          return (
            <li key={c.category} style={{ ['--cat' as string]: cat.color }}>
              <span className="dot" />
              <span className="chr__cat-name">{cat.label}</span>
              <span className="chr__cat-bar" aria-hidden="true">
                <span style={{ width: `${(c.plannedMinutes / total) * 100}%` }} />
              </span>
              <span className="chr__cat-value num">{formatDuration(c.plannedMinutes)}</span>
              <span className="chr__cat-done faint">
                完了 {c.completedCount}/{c.count}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="field__hint">外側の環：予定時間の割合／内側の環：各カテゴリーのうち「完了」と記録された件数の割合</p>
    </div>
  );
}

function PlannedVsActual({ summary, onOpen }: { summary: PeriodSummary; onOpen: (e: CalendarEvent) => void }) {
  if (summary.withActual.length === 0) {
    return (
      <div className="chr__pva-empty">
        <p className="muted">この期間に実績時間が記録された予定はありません。</p>
        <p className="field__hint">予定の詳細の「実際にかかった時間」に入力すると、ここで計画と比べられます。推測で補うことはしません。</p>
      </div>
    );
  }
  const max = Math.max(...summary.withActual.map((x) => Math.max(x.planned, x.actual)));
  const diff = summary.actualMinutesTotal - summary.plannedMinutesOfActual;
  return (
    <div className="chr__pva">
      <p className="chr__pva-total">
        記録のある{summary.withActual.length}件：計画 <strong className="num">{formatDuration(summary.plannedMinutesOfActual)}</strong> → 実績{' '}
        <strong className="num">{formatDuration(summary.actualMinutesTotal)}</strong>
        <span className={`chr__pva-diff ${diff > 0 ? 'is-over' : diff < 0 ? 'is-under' : ''}`}>
          （{diff > 0 ? '+' : ''}
          {formatDuration(diff)}）
        </span>
      </p>
      <ul className="chr__pva-list">
        {summary.withActual.slice(-12).map(({ event: e, planned, actual }) => (
          <li key={e.id} style={{ ['--cat' as string]: categoryOf(e.category).color }}>
            <button type="button" onClick={() => onOpen(e)} className="chr__pva-title">
              <span className="faint num">{parseDateKey(e.date).month}/{parseDateKey(e.date).day}</span> {e.title}
            </button>
            <span className="chr__pva-bars" aria-label={`計画${formatDuration(planned)}、実績${formatDuration(actual)}`}>
              <span className="chr__pva-planned" style={{ width: `${(planned / max) * 100}%` }} />
              <span className="chr__pva-actual" style={{ width: `${(actual / max) * 100}%` }} />
            </span>
            <span className="chr__pva-num num">
              {actual - planned > 0 ? '+' : ''}
              {formatDuration(actual - planned)}
            </span>
          </li>
        ))}
      </ul>
      <p className="chr__legend faint" aria-hidden="true">
        <span><i className="chr-lg chr-lg--planned" />計画</span>
        <span><i className="chr-lg chr-lg--done" />実績</span>
      </p>
    </div>
  );
}

function Ledger({
  days,
  events,
  today,
  windowStart,
  windowEnd,
  onOpenEvent,
  onReview,
}: {
  days: DateKey[];
  events: CalendarEvent[];
  today: DateKey;
  windowStart: number;
  windowEnd: number;
  onOpenEvent: (e: CalendarEvent) => void;
  onReview: (d: DateKey) => void;
}) {
  const reduce = useReducedMotion();
  const ws = Math.min(windowStart, ...events.map((e) => e.startMin));
  const we = Math.max(windowEnd, ...events.map((e) => e.endMin));
  const span = we - ws || 1;
  const x = (m: number) => ((m - ws) / span) * 100;
  const byDay = new Map<DateKey, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="chr__ledger">
      <div className="chr__ledger-scale" aria-hidden="true">
        {Array.from({ length: Math.floor(span / 120) + 1 }, (_, i) => Math.ceil(ws / 60) * 60 + i * 120)
          .filter((m) => m <= we)
          .map((m) => (
            <span key={m} style={{ left: `${x(m)}%` }}>
              {m / 60}
            </span>
          ))}
      </div>
      <ol className="chr__ledger-rows">
        {days.map((d, i) => {
          const list = (byDay.get(d) ?? []).sort((a, b) => a.startMin - b.startMin);
          const wd = weekdayOf(d);
          return (
            <li key={d} className={`${d === today ? 'is-today' : ''} ${d > today ? 'is-future' : ''}`}>
              <button type="button" className="chr__ledger-date" onClick={() => onReview(d)} aria-label={`${formatDateJa(d)}を振り返る`}>
                <span className="num">{parseDateKey(d).day}</span>
                <span className={wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : ''}>{WEEKDAYS_JA[wd]}</span>
              </button>
              <span className="chr__ledger-track">
                {list.map((e, j) => (
                  <motion.button
                    key={e.id}
                    type="button"
                    className={`chr__ledger-ev is-${e.status}`}
                    style={{ left: `${x(e.startMin)}%`, width: `${Math.max(0.8, x(e.endMin) - x(e.startMin))}%`, ['--cat' as string]: categoryOf(e.category).color }}
                    onClick={() => onOpenEvent(e)}
                    aria-label={`${formatTimeRange(e.startMin, e.endMin)} ${e.title}（${STATUS_LABEL[e.status]}）`}
                    title={`${formatTimeRange(e.startMin, e.endMin)} ${e.title}（${STATUS_LABEL[e.status]}）`}
                    initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: 0.4, ease: ease.glide, delay: Math.min(0.6, i * 0.03 + j * 0.02) }}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
