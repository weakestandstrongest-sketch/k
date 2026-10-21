/**
 * 24時間の天文時計（予定を円弧で表示）
 *
 * - 外周: 24時間の目盛りと数字（正午が真上）
 * - 帯: 活動時間帯と、残りの空き時間（光る線）
 * - 円弧: 予定（重なる予定は内側の軌道へ）。点線は移動・準備の余白
 * - 針: 現在時刻（今日を表示しているときのみ）
 */
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { categoryOf } from '../data/categories';
import type { CalendarEvent } from '../data/types';
import { formatTimeRange } from '../lib/date';
import { arcPath, continuousAngle, minuteToAngle, polar } from '../lib/geometry';
import { assignLanes, type ConflictKind, type FreeSlot } from '../lib/schedule';
import { ease } from '../motion/tokens';
import { useNow } from '../state/useNow';
import './ClockFace.css';

interface Props {
  events: CalendarEvent[];
  dateKey: string;
  /** 今日を表示中なら現在の分。それ以外は null（針を隠す） */
  nowMin: number | null;
  /** 外周を回る秒の点を表示する（今日のみ） */
  liveSeconds?: boolean;
  windowStart: number;
  windowEnd: number;
  conflicts?: Map<string, ConflictKind>;
  free?: FreeSlot[];
  selectedId?: string | null;
  onSelect?: (event: CalendarEvent) => void;
  /** 初回の演出（目盛りが一周して現れる） */
  intro?: boolean;
  introDelay?: number;
  variant?: 'grand' | 'compact';
  centerLabel?: string;
  centerValue?: string;
  centerNote?: string;
  ariaLabel: string;
}

const LANE_R = [342, 302, 262];
const LANE_W = 30;

function ClockFaceImpl({
  events,
  dateKey,
  nowMin,
  liveSeconds = false,
  windowStart,
  windowEnd,
  conflicts,
  free = [],
  selectedId,
  onSelect,
  intro = false,
  introDelay = 0,
  variant = 'grand',
  centerLabel,
  centerValue,
  centerNote,
  ariaLabel,
}: Props) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  const lanes = useMemo(() => assignLanes(events), [events]);
  const compact = variant === 'compact';
  const animateIntro = intro && !reduce;
  const d0 = introDelay;

  // 針の角度（0:00 をまたいでも逆回転しない連続角）
  const target = nowMin == null ? null : minuteToAngle(nowMin);
  const angleRef = useRef(animateIntro ? (target ?? 0) - 300 : (target ?? 0));
  const hand = useSpring(angleRef.current, reduce ? { stiffness: 1000, damping: 100 } : { stiffness: 60, damping: 18, mass: 1 });
  useEffect(() => {
    if (target == null) return;
    const next = continuousAngle(angleRef.current, target);
    angleRef.current = next;
    const id = window.setTimeout(() => hand.set(next), animateIntro ? (d0 + 0.5) * 1000 : 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; cls: string }[] = [];
    for (let i = 0; i < 288; i++) {
      const min = i * 5;
      const hour = min % 60 === 0;
      const major = min % 180 === 0;
      if (compact && !hour && min % 15 !== 0) continue;
      const len = major ? 34 : hour ? 22 : min % 15 === 0 ? 12 : 7;
      const a = minuteToAngle(min);
      const p1 = polar(470, a);
      const p2 = polar(470 - len, a);
      out.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, cls: major ? 'cf-tick cf-tick--major' : hour ? 'cf-tick cf-tick--hour' : 'cf-tick' });
    }
    return out;
  }, [compact]);

  const numerals = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => h)
        .filter((h) => !compact || h % 3 === 0)
        .map((h) => {
          const p = polar(compact ? 400 : 408, minuteToAngle(h * 60));
          return { h, x: p.x, y: p.y };
        }),
    [compact],
  );

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.startMin - b.startMin), [events]);

  return (
    <div className={`clockface clockface--${variant}`}>
      <svg viewBox="-500 -500 1000 1000" role="group" aria-label={ariaLabel} className="clockface__svg">
        <defs>
          <radialGradient id={`cf-face-${uid}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="var(--bg-raised)" />
            <stop offset="100%" stopColor="var(--bg)" />
          </radialGradient>
          <mask id={`cf-sweep-${uid}`} maskUnits="userSpaceOnUse" x="-500" y="-500" width="1000" height="1000">
            {animateIntro ? (
              <motion.circle
                r={250}
                cx={0}
                cy={0}
                fill="none"
                stroke="white"
                strokeWidth={520}
                transform="rotate(-90)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.1, ease: ease.regal, delay: d0 }}
              />
            ) : (
              <rect x={-500} y={-500} width={1000} height={1000} fill="white" />
            )}
          </mask>
          <filter id={`cf-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 文字盤の地 */}
        <motion.circle
          r={490}
          fill={`url(#cf-face-${uid})`}
          className="cf-rim"
          initial={animateIntro ? { opacity: 0, scale: 0.94 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: ease.glide, delay: d0 }}
        />

        {/* ギョーシェ彫り（中央の装飾） */}
        <g className="cf-guilloche" aria-hidden="true">
          {Array.from({ length: compact ? 12 : 18 }, (_, i) => (
            <motion.ellipse
              key={i}
              rx={200}
              ry={74}
              transform={`rotate(${(i * 180) / (compact ? 12 : 18)})`}
              initial={animateIntro ? { pathLength: 0, opacity: 0 } : false}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: ease.glide, delay: d0 + 0.3 + i * 0.03 }}
            />
          ))}
          <circle r={226} />
          <circle r={120} />
        </g>

        <g mask={`url(#cf-sweep-${uid})`} aria-hidden="true">
          <circle r={478} className="cf-ring" />
          <circle r={470} className="cf-ring cf-ring--thin" />
          <circle r={378} className="cf-ring cf-ring--thin" />
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.cls} />
          ))}
          {numerals.map(({ h, x, y }) => (
            <text key={h} x={x} y={y} className={`cf-numeral ${h % 6 === 0 ? 'cf-numeral--cardinal' : ''}`} textAnchor="middle" dominantBaseline="central">
              {h === 0 ? '24' : h}
            </text>
          ))}
          {/* 活動時間帯 */}
          <path d={arcPath(378, windowStart, windowEnd)} className="cf-window" />
          {[windowStart, windowEnd].map((m, i) => {
            const p1 = polar(370, minuteToAngle(m));
            const p2 = polar(386, minuteToAngle(m));
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="cf-window-cap" />;
          })}
          {/* 経過した時間（今日のみ） */}
          {nowMin != null && <path d={arcPath(484, 0, Math.max(1, nowMin))} className="cf-elapsed" />}
        </g>

        {/* 空き時間（光る線） */}
        <g filter={`url(#cf-glow-${uid})`} aria-hidden="true">
          {free.map((s) => (
            <motion.path
              key={`${dateKey}-${s.start}-${s.end}`}
              d={arcPath(378, s.start, s.end)}
              className="cf-free"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: ease.glide, delay: animateIntro ? d0 + 1.1 : 0.15 }}
            />
          ))}
        </g>

        {/* 予定の円弧 */}
        <g className="cf-events">
          {sortedEvents.map((e, i) => {
            const lane = Math.min(lanes.get(e.id)?.lane ?? 0, LANE_R.length - 1);
            const r = LANE_R[lane];
            const cat = categoryOf(e.category);
            const past = nowMin != null && e.endMin <= nowMin;
            const conflict = conflicts?.get(e.id);
            const label = `${formatTimeRange(e.startMin, e.endMin)} ${e.title}（${cat.label}）${conflict === 'overlap' ? '・重複あり' : ''}`;
            const delay = animateIntro ? d0 + 0.8 + i * 0.07 : i * 0.03;
            return (
              <g
                key={`${dateKey}-${e.id}`}
                className={`cf-event ${past ? 'is-past' : ''} ${selectedId === e.id ? 'is-selected' : ''} ${conflict ? `is-${conflict}` : ''}`}
                style={{ ['--cat' as string]: cat.color }}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={label}
                onClick={onSelect ? () => onSelect(e) : undefined}
                onKeyDown={
                  onSelect
                    ? (ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          onSelect(e);
                        }
                      }
                    : undefined
                }
              >
                <title>{label}</title>
                {e.bufferBeforeMin > 0 && (
                  <path d={arcPath(r, Math.max(0, e.startMin - e.bufferBeforeMin), e.startMin)} className="cf-buffer" />
                )}
                {e.bufferAfterMin > 0 && (
                  <path d={arcPath(r, e.endMin, Math.min(1440, e.endMin + e.bufferAfterMin))} className="cf-buffer" />
                )}
                <motion.path
                  d={arcPath(r, e.startMin, e.endMin)}
                  className="cf-arc"
                  strokeWidth={LANE_W}
                  initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: ease.glide, delay }}
                />
                {/* 押しやすいように太い透明の当たり判定 */}
                <path d={arcPath(r, e.startMin, e.endMin)} className="cf-hit" strokeWidth={LANE_W + 16} />
                {e.status === 'completed' && (
                  <circle
                    cx={polar(r, minuteToAngle((e.startMin + e.endMin) / 2)).x}
                    cy={polar(r, minuteToAngle((e.startMin + e.endMin) / 2)).y}
                    r={5}
                    className="cf-done"
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* 針 */}
        {target != null && (
          <motion.g
            className="cf-hand"
            style={{ rotate: hand }}
            initial={animateIntro ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: animateIntro ? d0 + 0.4 : 0 }}
            aria-hidden="true"
          >
            {/* 回転の中心を (0,0) にするための見えない円 */}
            <circle r={500} fill="none" stroke="none" />
            <line x1={0} y1={70} x2={0} y2={-452} className="cf-hand__line" />
            <path d="M -9 -300 L 0 -340 L 9 -300 L 0 -318 Z" className="cf-hand__tip" />
            <circle cy={-470} r={compact ? 12 : 9} className="cf-hand__sun" />
            <circle cy={-470} r={compact ? 22 : 18} className="cf-hand__halo" />
          </motion.g>
        )}
        {target != null && !reduce && liveSeconds && <SecondsOrbit />}
        <circle r={16} className="cf-pin" aria-hidden="true" />
        <circle r={6} className="cf-pin-inner" aria-hidden="true" />

        {/* 中央の文字 */}
        {(centerLabel || centerValue) && (
          <motion.g
            className="cf-center"
            initial={animateIntro ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.glide, delay: animateIntro ? d0 + 1.0 : 0 }}
            aria-hidden="true"
          >
            {centerLabel && (
              <text y={compact ? -100 : -92} textAnchor="middle" className="cf-center__label">
                {centerLabel}
              </text>
            )}
            {centerValue && (
              <text y={compact ? 44 : 40} textAnchor="middle" className={`cf-center__value ${centerValue.length > 4 ? 'cf-center__value--long' : ''}`}>
                {centerValue}
              </text>
            )}
            {centerNote && (
              <text y={compact ? 128 : 112} textAnchor="middle" className="cf-center__note">
                {centerNote}
              </text>
            )}
          </motion.g>
        )}
      </svg>
    </div>
  );
}

export const ClockFace = memo(ClockFaceImpl);

/** 秒の点だけを毎秒描き直す（文字盤全体は毎分だけ更新） */
function SecondsOrbit() {
  const sec = useNow(1000).getSeconds();
  return (
    <g className="cf-seconds" aria-hidden="true" transform={`rotate(${sec * 6})`}>
      <circle cy={-494} r={4} />
    </g>
  );
}
