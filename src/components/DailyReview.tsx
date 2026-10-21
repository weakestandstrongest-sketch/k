/**
 * 一日を閉じる（任意の振り返り）
 *
 *  1. その日の予定ごとに「完了／未実施／未記録」と、必要なら実際の時間を記録
 *  2. 完了と記録した予定だけが星になり、時刻の順に光の線で結ばれる（星図）
 *
 *  利用者が記録していない予定を「完了」として扱うことはありません。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import { categoryOf } from '../data/categories';
import { STATUS_LABEL } from '../data/eventModel';
import type { CalendarEvent, EventStatus } from '../data/types';
import { formatDateJa, formatDuration, formatMinutes, formatTimeRange, todayKey, type DateKey } from '../lib/date';
import { minuteToAngle, polar } from '../lib/geometry';
import { instancesOn, type EventInstance } from '../lib/recurrence';
import { ease } from '../motion/tokens';
import { useApp } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { useFocusTrap } from '../state/useFocusTrap';
import { useToast } from '../state/ToastContext';
import { Icon } from './Icon';
import './DailyReview.css';

interface Entry {
  status: EventStatus;
  actual: string;
}

export function DailyReview({ date }: { date: DateKey }) {
  const { setReviewDate } = useApp();
  const { events, record, saving } = useEvents();
  const { push } = useToast();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // 日をまたぐ予定は、始まった日にだけ記録する
  const day = useMemo(() => instancesOn(events, date).filter((e) => e.segment === 'single' || e.segment === 'first'), [events, date]);
  const [step, setStep] = useState<'record' | 'stars'>('record');
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(day.map((e) => [e.id, { status: e.status, actual: e.actualMinutes == null ? '' : String(e.actualMinutes) }])),
  );
  const [error, setError] = useState<string | null>(null);
  const close = () => setReviewDate(null);
  useFocusTrap(ref, true, close);
  const isFuture = date > todayKey();

  const setEntry = (id: string, patch: Partial<Entry>) => setEntries((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const save = async () => {
    const changed: { instance: EventInstance; status: EventStatus; actualMinutes: number | null }[] = [];
    for (const e of day) {
      const en = entries[e.id];
      if (!en) continue;
      const actual = en.actual.trim() === '' ? null : Number(en.actual);
      if (actual != null && (!Number.isInteger(actual) || actual < 0 || actual > 1440)) {
        setError(`「${e.title}」の実際の時間は0〜1440の整数（分）で入力してください。`);
        return;
      }
      if (en.status !== e.status || actual !== e.actualMinutes) {
        changed.push({ instance: e, status: en.status, actualMinutes: actual });
      }
    }
    setError(null);
    if (changed.length > 0) {
      const ok = await record(changed, '一日の振り返りで記録');
      if (!ok) return;
      push({ kind: 'success', message: `${changed.length}件の記録を保存しました。` });
    }
    setStep('stars');
  };

  return (
    <motion.div
      ref={ref}
      className="review"
      data-theme="night"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-title"
      tabIndex={-1}
      initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)', transitionEnd: { clipPath: 'none' } }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, clipPath: 'circle(0% at 50% 50%)', transition: { duration: 0.45, ease: ease.regal } }}
      transition={{ duration: 0.7, ease: ease.regal }}
    >
      <div className="review__sky" aria-hidden="true" />
      <div className="review__inner">
        <header className="review__head">
          <button type="button" className="chamber__back review__back" onClick={close}>
            <Icon name="prev" size={18} />
            <span>戻る</span>
          </button>
          <div>
            <p className="kicker">CLOSING THE DAY</p>
            <h2 className="review__title" id="review-title">
              {formatDateJa(date, { year: true })} を閉じる
            </h2>
          </div>
        </header>

        {step === 'record' && (
          <div className="review__record">
            {day.length === 0 ? (
              <p className="muted">この日の予定はありません。</p>
            ) : (
              <>
                <p className="muted review__lead">
                  実際に行った予定を「完了」にしてください。記録しなかった予定は「未記録」のまま残り、星図には光りません。
                  {isFuture && ' この日はまだ来ていません。'}
                </p>
                <ol className="review__list">
                  {day.map((e) => {
                    const en = entries[e.id] ?? { status: e.status, actual: '' };
                    const cat = categoryOf(e.category);
                    return (
                      <li key={e.id} style={{ ['--cat' as string]: cat.color }}>
                        <div className="review__ev">
                          <span className="review__ev-time num">{e.allDay ? '終日' : e.segment === 'first' ? `${formatMinutes(e.startMin)}〜翌日` : formatTimeRange(e.startMin, e.endMin)}</span>
                          <span className="review__ev-title">
                            <span className="dot" />
                            {e.title}
                            {e.isSample && <span className="chip chip--sample">見本</span>}
                          </span>
                        </div>
                        <div className="review__controls">
                          <div className="review__seg" role="radiogroup" aria-label={`「${e.title}」の記録`}>
                            {(['completed', 'missed', 'planned'] as EventStatus[]).map((s) => (
                              <button key={s} type="button" role="radio" aria-checked={en.status === s} className={en.status === s ? 'is-on' : ''} onClick={() => setEntry(e.id, { status: s })}>
                                {s === 'completed' && <Icon name="star" size={13} />}
                                {STATUS_LABEL[s]}
                              </button>
                            ))}
                          </div>
                          <label className="review__actual">
                            <span className="sr-only">「{e.title}」の実際の時間（分）</span>
                            <input
                              className="field__control"
                              inputMode="numeric"
                              value={en.actual}
                              placeholder={e.allDay ? '' : `${e.endMin - e.startMin}`}
                              onChange={(ev) => setEntry(e.id, { actual: ev.target.value.replace(/[^\d]/g, '') })}
                            />
                            <span aria-hidden="true">分</span>
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <p className="field__hint">実際の時間は任意です。空欄なら実績は記録されません（予定の長さで補うことはしません）。</p>
              </>
            )}
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <div className="review__actions">
              <button type="button" className="btn btn--ghost" onClick={close}>
                閉じる
              </button>
              {day.length > 0 && (
                <button type="button" className="btn btn--primary" onClick={save} disabled={saving} data-autofocus>
                  <Icon name="star" size={16} />
                  記録して星図を描く
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'stars' && <Constellation day={day} onBack={() => setStep('record')} onClose={close} />}
      </div>
    </motion.div>
  );
}

function Constellation({ day, onBack, onClose }: { day: CalendarEvent[]; onBack: () => void; onClose: () => void }) {
  const reduce = useReducedMotion();
  const completed = day.filter((e) => e.status === 'completed');
  const missed = day.filter((e) => e.status === 'missed');
  const unrecorded = day.filter((e) => e.status === 'planned');
  const actualTotal = day.reduce((s, e) => s + (e.actualMinutes ?? 0), 0);
  const actualCount = day.filter((e) => e.actualMinutes != null).length;

  const place = (e: CalendarEvent) => {
    const mid = (e.startMin + e.endMin) / 2;
    const dur = e.endMin - e.startMin;
    const r = 150 + Math.min(1, dur / 180) * 150;
    return { ...polar(r, minuteToAngle(mid)), size: 5 + Math.min(1, dur / 120) * 9, angle: minuteToAngle(mid), r };
  };
  const stars = completed.map((e) => ({ e, ...place(e) }));
  const path = stars.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join(' ');
  const base = reduce ? 0 : 0.5;

  return (
    <div className="review__stars">
      <svg viewBox="-420 -420 840 840" className="review__svg" role="img" aria-label={`完了と記録された予定 ${completed.length}件の星図`}>
        <defs>
          <radialGradient id="star-glow">
            <stop offset="0%" stopColor="#fff8dc" />
            <stop offset="40%" stopColor="#f6e7b0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f6e7b0" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* 天球の目盛り */}
        {[150, 225, 300, 380].map((r, i) => (
          <motion.circle
            key={r}
            r={r}
            className="review__orbit"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: ease.regal, delay: i * 0.1 }}
          />
        ))}
        {Array.from({ length: 24 }, (_, h) => {
          const a = minuteToAngle(h * 60);
          const p1 = polar(380, a);
          const p2 = polar(h % 6 === 0 ? 360 : 372, a);
          const pt = polar(402, a);
          return (
            <g key={h}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="review__tick" />
              {h % 3 === 0 && (
                <text x={pt.x} y={pt.y} textAnchor="middle" dominantBaseline="central" className="review__hour">
                  {h === 0 ? 24 : h}
                </text>
              )}
            </g>
          );
        })}

        {/* 記録のない予定：淡い輪 */}
        {unrecorded.map((e, i) => {
          const p = place(e);
          return (
            <motion.circle
              key={e.id}
              cx={p.x}
              cy={p.y}
              r={p.size * 0.8}
              className="review__ghost"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: base + 0.2 + i * 0.05 }}
            />
          );
        })}
        {missed.map((e, i) => {
          const p = place(e);
          return (
            <motion.g key={e.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: base + 0.3 + i * 0.05 }}>
              <line x1={p.x - 6} y1={p.y - 6} x2={p.x + 6} y2={p.y + 6} className="review__missed" />
              <line x1={p.x - 6} y1={p.y + 6} x2={p.x + 6} y2={p.y - 6} className="review__missed" />
            </motion.g>
          );
        })}

        {/* 光の線（時刻の順） */}
        {stars.length > 1 && (
          <motion.path
            d={path}
            className="review__trail"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 + stars.length * 0.35, ease: ease.glide, delay: base + 0.5 }}
          />
        )}

        {/* 星 */}
        {stars.map((s, i) => (
          <motion.g
            key={s.e.id}
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14, delay: base + 0.5 + i * 0.35 }}
          >
            <circle cx={s.x} cy={s.y} r={s.size * 3.2} fill="url(#star-glow)" />
            <circle cx={s.x} cy={s.y} r={s.size * 0.55} className="review__star" style={{ ['--cat' as string]: categoryOf(s.e.category).color }} />
            <text x={s.x} y={s.y + (s.y > 0 ? 28 : -20)} textAnchor="middle" className="review__star-label">
              {s.e.title}
            </text>
          </motion.g>
        ))}
        <text y={-6} textAnchor="middle" className="review__center-value">
          {completed.length}
        </text>
        <text y={34} textAnchor="middle" className="review__center-label">
          完了と記録
        </text>
      </svg>

      <motion.div className="review__summary" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: base + 0.6 + stars.length * 0.3, duration: 0.5 }}>
        <dl>
          <div>
            <dt>完了</dt>
            <dd className="num">{completed.length}件</dd>
          </div>
          <div>
            <dt>未実施</dt>
            <dd className="num">{missed.length}件</dd>
          </div>
          <div>
            <dt>未記録</dt>
            <dd className="num">{unrecorded.length}件</dd>
          </div>
          <div>
            <dt>記録された実績</dt>
            <dd className="num">{actualCount > 0 ? `${formatDuration(actualTotal)}（${actualCount}件）` : '—'}</dd>
          </div>
        </dl>
        {completed.length === 0 && <p className="muted">完了と記録された予定がないため、星は灯っていません。</p>}
        {completed.length > 0 && (
          <ol className="review__timeline">
            {completed.map((e) => (
              <li key={e.id}>
                <span className="num">{formatMinutes(e.startMin)}</span> {e.title}
              </li>
            ))}
          </ol>
        )}
        <div className="review__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            記録に戻る
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose} data-autofocus>
            閉じる
          </button>
        </div>
      </motion.div>
    </div>
  );
}
