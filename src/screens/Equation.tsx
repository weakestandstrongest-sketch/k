/**
 * Screen 4: THE EQUATION（均時差 / 時間設計）
 *
 *  活動時間 − 予定 − 余白 ＝ 空き  を、その日の実データから計算して示し、
 *  空き時間の計算・再編成の提案（適用前に比較）・空き時間の検索を行います。
 *  提案は決定的なルールに基づき、利用者が確認するまで何も変更しません。
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Backdrop } from '../components/Backdrop';
import { DateStepper } from '../components/DateStepper';
import { Icon } from '../components/Icon';
import { PlanComparison } from '../components/PlanComparison';
import { categoryOf } from '../data/categories';
import { emptyDraft, moveEvent } from '../data/eventModel';
import type { CalendarEvent } from '../data/types';
import { addDays, formatDateJa, formatDuration, formatMinutes, formatTimeRange, minutesOfDay, rangeKeys, relativeDayLabel, todayKey } from '../lib/date';
import { proposeResolution } from '../lib/planner';
import { bufferedInterval, eventsOnDate, freeSlots, timeBreakdown } from '../lib/schedule';
import { ease, tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import { useConfirm } from '../state/ConfirmContext';
import { useEvents } from '../state/EventsContext';
import { useNow } from '../state/useNow';
import { useToast } from '../state/ToastContext';
import './Equation.css';

const GAP_OPTIONS = [0, 5, 10, 15, 30];
const FIND_DURATIONS = [30, 60, 90, 120];

export function Equation() {
  const { focusDate, setFocusDate, dateDirection, openChamber } = useApp();
  const { events, settings, commit } = useEvents();
  const confirm = useConfirm();
  const { push } = useToast();
  const reduce = useReducedMotion();
  const now = useNow(60_000);
  const today = todayKey(now);
  const nowMin = focusDate === today ? minutesOfDay(now) : null;
  const item = reduce ? tickItemReduced : tickItem;

  const [respectBuffers, setRespectBuffers] = useState(true);
  const [minGap, setMinGap] = useState(0);
  const [findDur, setFindDur] = useState(60);

  const ws = settings.dayStartMin;
  const we = settings.dayEndMin;
  const day = useMemo(() => eventsOnDate(events, focusDate), [events, focusDate]);
  const breakdown = useMemo(() => timeBreakdown(day, ws, we), [day, ws, we]);
  const free = useMemo(() => freeSlots(day, { windowStart: ws, windowEnd: we, includeBuffers: true, minLength: 5 }), [day, ws, we]);
  const plan = useMemo(
    () => proposeResolution(day, { respectBuffers, minGap, windowEnd: we, nowMin }),
    [day, respectBuffers, minGap, we, nowMin],
  );
  const isPast = focusDate < today;

  const finder = useMemo(() => {
    return rangeKeys(focusDate, 7).map((date) => {
      const list = eventsOnDate(events, date);
      const from = date === today ? Math.ceil(minutesOfDay(now) / 5) * 5 : undefined;
      if (date < today) return { date, slots: [] };
      return { date, slots: freeSlots(list, { windowStart: ws, windowEnd: we, includeBuffers: true, from, minLength: findDur }).slice(0, 3) };
    });
  }, [events, focusDate, today, now, ws, we, findDur]);

  const applyPlan = async () => {
    if (plan.changes.length === 0) return;
    const ok = await confirm({
      title: 'この提案を適用しますか？',
      kicker: 'THE EQUATION',
      message: (
        <>
          <p style={{ margin: '0 0 8px' }}>{plan.changes.length}件の予定の時刻を変更します。</p>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            {plan.changes.map((c) => (
              <li key={c.id}>
                「{c.title}」 {formatMinutes(c.fromStart)} → {formatMinutes(c.toStart)}
              </li>
            ))}
          </ul>
        </>
      ),
      confirmLabel: '適用する',
    });
    if (!ok) return;
    const originals = day.filter((e) => plan.changes.some((c) => c.id === e.id));
    const updated = plan.changes.map((c) => moveEvent(originals.find((o) => o.id === c.id)!, c.toStart, new Date(), '時間設計の提案を適用'));
    if (await commit(updated)) {
      push({
        kind: 'success',
        message: `${updated.length}件の予定を再編成しました。`,
        action: {
          label: '元に戻す',
          onClick: async () => {
            if (await commit(originals)) push({ kind: 'info', message: '再編成を取り消しました。' });
          },
        },
      });
    }
  };

  const open = (e: CalendarEvent) => openChamber({ mode: 'view', id: e.id });
  const rel = relativeDayLabel(focusDate, today);
  const span = we - ws;
  const x = (m: number) => ((Math.max(ws, Math.min(we, m)) - ws) / span) * 100;

  return (
    <div className="screen__inner equation">
      <Backdrop kind="equation" intro />
      <motion.div className="eq" variants={tickContainer(0.06, 0.12)} initial="hidden" animate="show">
        <motion.header className="eq__head" variants={item}>
          <div>
            <p className="kicker">THE EQUATION · 均時差</p>
            <h1 className="heading">時間設計</h1>
            <p className="muted eq__lead">空き時間を計算し、組み替えの案を比べます。</p>
          </div>
          <DateStepper
            label={`${formatDateJa(focusDate)}${rel ? ` ${rel}` : ''}`}
            srLabel={formatDateJa(focusDate, { year: true })}
            direction={dateDirection}
            onPrev={() => setFocusDate(addDays(focusDate, -1))}
            onNext={() => setFocusDate(addDays(focusDate, 1))}
            onToday={() => setFocusDate(today)}
            isToday={focusDate === today}
            prevLabel="前の日"
            nextLabel="次の日"
          />
        </motion.header>

        {/* ---- 式 ---- */}
        <motion.section className="eq__formula" variants={item} aria-label="活動時間の内訳">
          <Term label="活動時間" value={breakdown.window} note={`${formatMinutes(ws)}〜${formatMinutes(we)}`} />
          <span className="eq__op" aria-hidden="true">−</span>
          <Term label="予定" value={breakdown.core} note={`${day.length}件・重なりは一度だけ数える`} />
          <span className="eq__op" aria-hidden="true">−</span>
          <Term label="移動・準備の余白" value={breakdown.bufferExtra} note="予定と重ならない部分" />
          <span className="eq__op" aria-hidden="true">＝</span>
          <Term label="空き時間" value={breakdown.free} note={`${free.length}つの空き`} accent />
          <p className="sr-only">
            活動時間{formatDuration(breakdown.window)}から、予定{formatDuration(breakdown.core)}と余白{formatDuration(breakdown.bufferExtra)}を引いた空き時間は{formatDuration(breakdown.free)}です。
          </p>
        </motion.section>

        {/* ---- 帯 ---- */}
        <motion.section className="eq__band-wrap" variants={item} aria-label="活動時間帯の帯グラフ">
          <div className="eq__band">
            {free.map((s) => (
              <button
                key={`f${s.start}`}
                type="button"
                className="eq__band-free"
                style={{ left: `${x(s.start)}%`, width: `${x(s.end) - x(s.start)}%` }}
                onClick={() => openChamber({ mode: 'new', draft: emptyDraft(focusDate, s.start, Math.min(60, s.minutes)) })}
                aria-label={`${formatTimeRange(s.start, s.end)}の空き（${formatDuration(s.minutes)}）に予定を作成`}
              >
                {s.minutes >= 45 && <span>{formatDuration(s.minutes)}</span>}
              </button>
            ))}
            {day.map((e) => {
              const b = bufferedInterval(e);
              return (
                <span
                  key={`b${e.id}`}
                  className="eq__band-buffer"
                  style={{ left: `${x(b.start)}%`, width: `${x(b.end) - x(b.start)}%`, ['--cat' as string]: categoryOf(e.category).color }}
                  aria-hidden="true"
                />
              );
            })}
            {day.map((e) => (
              <button
                key={e.id}
                type="button"
                className="eq__band-event"
                style={{ left: `${x(e.startMin)}%`, width: `${Math.max(0.6, x(e.endMin) - x(e.startMin))}%`, ['--cat' as string]: categoryOf(e.category).color }}
                onClick={() => open(e)}
                aria-label={`${formatTimeRange(e.startMin, e.endMin)} ${e.title}`}
                title={`${formatTimeRange(e.startMin, e.endMin)} ${e.title}`}
              />
            ))}
            {nowMin != null && nowMin >= ws && nowMin <= we && <span className="eq__band-now" style={{ left: `${x(nowMin)}%` }} aria-hidden="true" />}
          </div>
          <div className="eq__band-scale" aria-hidden="true">
            {Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => ws + i * 60)
              .filter((m) => m <= we)
              .map((m, i) => (
                <span key={m} style={{ left: `${x(m)}%` }} className={i % 2 ? 'is-minor' : ''}>
                  {Math.floor(m / 60)}
                </span>
              ))}
          </div>
          <p className="eq__band-legend faint">
            <span><i className="eq-lg eq-lg--event" />予定</span>
            <span><i className="eq-lg eq-lg--buffer" />余白</span>
            <span><i className="eq-lg eq-lg--free" />空き（押すと予定を作成）</span>
          </p>
        </motion.section>

        <div className="eq__columns">
          {/* ---- 空きを探す ---- */}
          <motion.section className="eq__panel" variants={item} aria-labelledby="eq-finder">
            <h2 className="subheading" id="eq-finder">
              空きを探す
            </h2>
            <div className="eq__seg" role="radiogroup" aria-label="必要な長さ">
              {FIND_DURATIONS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={findDur === m} className={findDur === m ? 'is-on' : ''} onClick={() => setFindDur(m)}>
                  {formatDuration(m)}
                </button>
              ))}
            </div>
            <ol className="eq__finder">
              {finder.map(({ date, slots }) => (
                <li key={date}>
                  <span className="eq__finder-date">{formatDateJa(date)}</span>
                  {slots.length === 0 ? (
                    <span className="faint">{date < today ? '過去の日' : '見つかりません'}</span>
                  ) : (
                    <span className="eq__finder-slots">
                      {slots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => openChamber({ mode: 'new', draft: emptyDraft(date, s.start, findDur) })}
                          aria-label={`${formatDateJa(date)} ${formatMinutes(s.start)}から${formatDuration(findDur)}の予定を作成`}
                        >
                          <span className="num">{formatMinutes(s.start)}〜</span>
                          <small>最大{formatDuration(s.minutes)}</small>
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="field__hint">移動・準備の余白も埋まっている時間として扱います。</p>
          </motion.section>
        </div>

        {/* ---- 提案 ---- */}
        <motion.section className="eq__panel eq__proposal" variants={item} aria-labelledby="eq-proposal">
          <div className="eq__proposal-head">
            <h2 className="subheading" id="eq-proposal">
              再編成の提案
            </h2>
            <div className="eq__options">
              <label className="check">
                <input type="checkbox" checked={respectBuffers} onChange={(e) => setRespectBuffers(e.target.checked)} />
                余白も重ならないようにする
              </label>
              <label className="eq__gap">
                <span>予定の間隔</span>
                <select className="field__control" value={minGap} onChange={(e) => setMinGap(Number(e.target.value))}>
                  {GAP_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g === 0 ? 'なし' : `${g}分`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${focusDate}-${respectBuffers}-${minGap}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: ease.escapement }}>
              {day.length === 0 ? (
                <p className="muted">この日には予定がありません。</p>
              ) : plan.changes.length === 0 && plan.conflictsBefore === 0 ? (
                <p className="muted">{respectBuffers ? '予定も余白も重なっていないため、組み替えは不要です。' : '予定は重なっていないため、組み替えは不要です。'}</p>
              ) : (
                <>
                  <PlanComparison before={day} result={plan} windowStart={ws} windowEnd={we} />
                  <div className="eq__apply">
                    {isPast && <p className="faint">過去の日付です。記録として残す場合は適用しないでください。</p>}
                    <button type="button" className="btn btn--primary" onClick={applyPlan} disabled={plan.changes.length === 0}>
                      <Icon name="check" size={16} />
                      この提案を適用する（{plan.changes.length}件）
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          <details className="eq__rules">
            <summary>提案のルール</summary>
            <ol>
              <li>「固定」の予定、完了・未実施を記録した予定、すでに始まった予定は動かしません。</li>
              <li>重なっている予定を開始の早い順に、元の時刻より後ろの最初の空きへ移します。前へは動かしません。</li>
              <li>活動時間帯（{formatMinutes(ws)}〜{formatMinutes(we)}）に収まらない予定は動かさず、その旨を表示します。</li>
              <li>移動時間は予測しません。各予定に入力された余白だけを使います。</li>
              <li>「適用する」を押すまで、予定は一切変更されません。適用後も「元に戻す」で戻せます。</li>
            </ol>
          </details>
        </motion.section>
      </motion.div>
    </div>
  );
}

function Term({ label, value, note, accent }: { label: string; value: number; note: string; accent?: boolean }) {
  return (
    <div className={`eq__term ${accent ? 'is-accent' : ''}`}>
      <span className="eq__term-label">{label}</span>
      <span className="eq__term-value num">{formatDuration(value)}</span>
      <span className="eq__term-note">{note}</span>
    </div>
  );
}
