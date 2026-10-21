/**
 * Screen 1: THE GRAND HALL（大広間 / ホーム）
 * 今日の日付・現在時刻・次の予定・残りの予定・空き時間を一目で。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { Backdrop } from '../components/Backdrop';
import { ClockFace } from '../components/ClockFace';
import { EventRow } from '../components/EventRow';
import { Icon } from '../components/Icon';
import { RollingText } from '../components/RollingText';
import { SampleBanner } from '../components/SampleBanner';
import { categoryOf } from '../data/categories';
import { emptyDraft } from '../data/eventModel';
import type { CalendarEvent } from '../data/types';
import {
  formatDuration,
  formatMinutes,
  formatTimeRange,
  minutesOfDay,
  parseDateKey,
  todayKey,
  wafuMonthName,
  weekdayOf,
  WEEKDAYS_JA_LONG,
} from '../lib/date';
import { nextEvent, snapMinutes } from '../lib/schedule';
import { tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { useDayData } from '../state/useDayData';
import { useNow } from '../state/useNow';
import './GrandHall.css';

export function GrandHall({ entranceDelay = 0 }: { entranceDelay?: number }) {
  // 画面全体は 15 秒ごと、時刻の表示（LiveTime）だけ毎秒更新
  const now = useNow(15_000);
  const reduce = useReducedMotion();
  const { events, settings, status } = useEvents();
  const { openChamber, navigate, setReviewDate, setFocusDate, setCalView, setSettingsOpen } = useApp();
  const today = todayKey(now);
  const nowMin = minutesOfDay(now);
  const data = useDayData(events, today, settings, nowMin);
  const { year, month, day } = parseDateKey(today);
  const next = useMemo(() => nextEvent(data.day, nowMin), [data.day, nowMin]);
  const remaining = data.day.filter((e) => e.endMin > nowMin);
  const done = data.day.length - remaining.length;
  const item = reduce ? tickItemReduced : tickItem;
  const d0 = entranceDelay;

  const open = (e: CalendarEvent, layoutKey?: string) => openChamber({ mode: 'view', id: e.id, layoutKey });
  const create = () => openChamber({ mode: 'new', draft: emptyDraft(today, Math.min(snapMinutes(nowMin + 30, 30), 1380)) });


  return (
    <div className="screen__inner hall">
      <Backdrop kind="hall" intro introDelay={d0} />

      <motion.div className="hall__grid" variants={tickContainer(0.07, d0 + 0.15)} initial="hidden" animate="show">
        <motion.header className="hall__head" variants={item}>
          {/* 左上の小さな白い札：今日の残りの予定 */}
          <div className="hall__pocket">
            <span className="hall__pocket-value num">{remaining.length}</span>
            <span className="hall__pocket-unit">件</span>
            <span className="hall__pocket-label">
              本日の残りの予定
              <small>events remaining today</small>
            </span>
          </div>
          <button type="button" className="btn btn--icon btn--ghost hall__gear" onClick={() => setSettingsOpen(true)} aria-label="設定">
            <Icon name="gear" />
          </button>
        </motion.header>

        <section className="hall__date" aria-label="今日の日付と時刻">
          <motion.div className="hall__numeral num" variants={item} aria-hidden="true">
            <RollingText text={String(day)} />
          </motion.div>
          <motion.div className="hall__date-side" variants={item}>
            <p className="hall__month-en">{MONTHS_EN[month - 1]}</p>
            <p className="hall__month">
              {year}年 {month}月 <span className="hall__wafu">{wafuMonthName(today)}</span>
            </p>
            <h1 className="hall__weekday">{WEEKDAYS_JA_LONG[weekdayOf(today)]}</h1>
            <p className="hall__weekday-en" aria-hidden="true">
              {WEEKDAYS_EN[weekdayOf(today)]}
            </p>
            <p className="sr-only">
              {year}年{month}月{day}日 {WEEKDAYS_JA_LONG[weekdayOf(today)]}
            </p>
          </motion.div>
          <motion.div className="hall__time" variants={item}>
            <LiveTime />
            <span className="hall__time-label">現在時刻</span>
          </motion.div>
        </section>

        <motion.section className="hall__dial" variants={item} aria-label="今日の予定の時計盤">
          <ClockFace
            events={data.day}
            dateKey={today}
            nowMin={nowMin}
            liveSeconds
            windowStart={settings.dayStartMin}
            windowEnd={settings.dayEndMin}
            conflicts={data.conflictMap}
            free={data.free}
            onSelect={(e) => open(e)}
            intro
            introDelay={d0 + 0.1}
            centerLabel="残りの空き時間"
            centerValue={formatDuration(data.freeMinutes)}
            centerNote={`${formatMinutes(settings.dayStartMin)}〜${formatMinutes(settings.dayEndMin)} のうち`}
            ariaLabel={`今日の予定 ${data.day.length}件。残りの空き時間 ${formatDuration(data.freeMinutes)}。円弧を選ぶと詳細を開きます。`}
          />
          <p className="hall__dial-legend" aria-hidden="true">
            <span><i className="lg lg--arc" />予定</span>
            <span><i className="lg lg--buffer" />移動・準備</span>
            <span><i className="lg lg--free" />残りの空き</span>
            <span><i className="lg lg--window" />活動時間帯</span>
          </p>
        </motion.section>

        <motion.section className="hall__next" variants={item} aria-labelledby="hall-next-title">
          <p className="kicker" id="hall-next-title">
            {next?.ongoing ? 'NOW · 進行中' : 'NEXT · 次の予定'}
          </p>
          {status === 'loading' ? (
            <p className="muted">読み込み中…</p>
          ) : next ? (
            <NextCard event={next.event} ongoing={next.ongoing} nowMin={nowMin} onOpen={() => open(next.event)} />
          ) : (
            <div className="hall__next-empty">
              <p className="hall__next-title">{data.day.length === 0 ? '今日の予定はまだありません' : '今日の予定はこれで終わりです'}</p>
              <p className="muted">{data.day.length === 0 ? '「新しい予定」から最初の予定を加えましょう。' : '残りの時間は自由に使えます。'}</p>
            </div>
          )}
          <div className="hall__actions">
            <button type="button" className="btn btn--primary" onClick={create}>
              <Icon name="plus" size={18} />
              新しい予定
            </button>
            <button type="button" className="btn" onClick={() => setReviewDate(today)}>
              <Icon name="star" size={18} />
              一日を閉じる
            </button>
          </div>
        </motion.section>

        <motion.section className="hall__stats" variants={item} aria-label="今日の概要">
          <Stat label="本日の予定" value={`${data.day.length}`} unit="件" note={done > 0 ? `うち${done}件は終了` : undefined} />
          <Stat label="残りの空き" value={formatDuration(data.freeMinutes)} note="移動・準備の余白も差し引き済み" />
          <Stat
            label="重複"
            value={`${data.overlapCount}`}
            unit="件"
            tone={data.overlapCount > 0 ? 'danger' : undefined}
            note={data.bufferCount > 0 ? `余白の重なり ${data.bufferCount}件` : '問題ありません'}
            action={data.overlapCount + data.bufferCount > 0 ? { label: '時間設計で確認', onClick: () => navigate('equation') } : undefined}
          />
        </motion.section>

        <motion.section className="hall__agenda" variants={item} aria-labelledby="hall-agenda-title">
          <div className="hall__agenda-head">
            <h2 className="subheading" id="hall-agenda-title">
              本日の残りの予定
            </h2>
            <button
              type="button"
              className="btn btn--small btn--ghost"
              onClick={() => {
                setFocusDate(today);
                setCalView('day');
                navigate('orrery');
              }}
            >
              カレンダーで開く
              <Icon name="next" size={14} />
            </button>
          </div>
          {remaining.length === 0 ? (
            <p className="hall__empty muted">{data.day.length === 0 ? '今日の予定はまだありません。「新しい予定」から追加できます。' : '残りの予定はありません。'}</p>
          ) : (
            <motion.ul className="evrow-list" variants={tickContainer(0.05)} initial="hidden" animate="show">
              {remaining.map((e) => (
                <EventRow key={e.id} event={e} scope="hall" conflict={data.conflictMap.get(e.id)} onOpen={open} variants={item} />
              ))}
            </motion.ul>
          )}
        </motion.section>

        <motion.div className="hall__banner" variants={item}>
          <SampleBanner />
        </motion.div>
      </motion.div>

    </div>
  );
}

const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function LiveTime() {
  const now = useNow(1000);
  return (
    <>
      <span className="hall__time-main num">
        <RollingText text={formatMinutes(minutesOfDay(now))} stagger={0.02} />
      </span>
      <span className="hall__time-sec num" aria-hidden="true">
        {String(now.getSeconds()).padStart(2, '0')}
      </span>
    </>
  );
}

function NextCard({ event: e, ongoing, nowMin, onOpen }: { event: CalendarEvent; ongoing: boolean; nowMin: number; onOpen: () => void }) {
  const cat = categoryOf(e.category);
  const until = ongoing ? e.endMin - nowMin : e.startMin - nowMin;
  const leaveIn = !ongoing && e.bufferBeforeMin > 0 ? e.startMin - e.bufferBeforeMin - nowMin : null;
  return (
    <button type="button" className="hall__next-card" style={{ ['--cat' as string]: cat.color }} onClick={onOpen}>
      <span className="hall__next-count num">
        <span className="hall__next-count-label">{ongoing ? '終了まで' : '開始まで'}</span>
        {formatDuration(until)}
      </span>
      <span className="hall__next-title">{e.title}</span>
      <span className="hall__next-meta">
        <span className="num">{formatTimeRange(e.startMin, e.endMin)}</span>
        <span className="dot" />
        <span>{cat.label}</span>
        {e.location && (
          <span className="hall__next-loc">
            <Icon name="pin" size={13} />
            {e.location}
          </span>
        )}
      </span>
      {leaveIn != null && (
        <span className={`hall__next-leave ${leaveIn <= 0 ? 'is-late' : ''}`}>
          {leaveIn > 0 ? `移動・準備の開始まで ${formatDuration(leaveIn)}（${formatMinutes(e.startMin - e.bufferBeforeMin)}）` : '移動・準備の時間に入っています'}
        </span>
      )}
      {e.prepTasks.length > 0 && (
        <span className="hall__next-prep">
          準備 {e.prepTasks.filter((t) => t.done).length}/{e.prepTasks.length}
        </span>
      )}
    </button>
  );
}

function Stat({
  label,
  value,
  unit,
  note,
  tone,
  action,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone?: 'danger';
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={`stat ${tone ? `stat--${tone}` : ''}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value num">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {note && <span className="stat__note">{note}</span>}
      {action && (
        <button type="button" className="stat__action" onClick={action.onClick}>
          {action.label}
          <Icon name="next" size={12} />
        </button>
      )}
    </div>
  );
}
