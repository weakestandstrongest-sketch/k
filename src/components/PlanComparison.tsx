/**
 * 「現在」と「提案」の2本の時間軸を並べ、動く予定を線で結んで見せる。
 * 予定を動かして他の予定と重なったときの「再編成の確認」で使います。
 */
import { motion, useReducedMotion } from 'motion/react';
import { categoryOf } from '../data/categories';
import type { CalendarEvent } from '../data/types';
import { formatDuration, formatMinutes, formatTimeRange } from '../lib/date';
import type { PlanResult } from '../lib/planner';
import { assignLanes, bufferedInterval } from '../lib/schedule';
import { ease } from '../motion/tokens';
import './PlanComparison.css';

interface Props {
  before: CalendarEvent[];
  result: PlanResult;
  windowStart: number;
  windowEnd: number;
  /** 利用者が直接動かした予定 */
  primaryId?: string;
}

export function PlanComparison({ before, result, windowStart, windowEnd, primaryId }: Props) {
  const reduce = useReducedMotion();
  const all = [...before, ...result.events];
  const rangeStart = Math.max(0, Math.floor(Math.min(windowStart, ...all.map((e) => bufferedInterval(e).start)) / 60) * 60);
  const rangeEnd = Math.min(1440, Math.ceil(Math.max(windowEnd, ...all.map((e) => bufferedInterval(e).end)) / 60) * 60);
  const span = Math.max(60, rangeEnd - rangeStart);
  const x = (min: number) => ((min - rangeStart) / span) * 100;
  const changed = new Map(result.changes.map((c) => [c.id, c]));
  const hours: number[] = [];
  for (let h = rangeStart; h <= rangeEnd; h += 60) hours.push(h);
  const step = span > 12 * 60 ? 3 : span > 6 * 60 ? 2 : 1;

  const row = (list: CalendarEvent[], which: 'before' | 'after') => {
    const lanes = assignLanes(list);
    return list.map((e) => {
      const lane = lanes.get(e.id) ?? { lane: 0, lanes: 1 };
      const cat = categoryOf(e.category);
      const c = changed.get(e.id);
      const moving = !!c;
      const unplaced = which === 'after' && result.unplaced.some((u) => u.id === e.id);
      return (
        <div
          key={e.id}
          className={`pc__block ${moving ? 'is-moving' : ''} ${e.id === primaryId ? 'is-primary' : ''} ${unplaced ? 'is-unplaced' : ''} ${e.fixed ? 'is-fixed' : ''}`}
          style={{
            left: `${x(e.startMin)}%`,
            width: `${Math.max(0.8, x(e.endMin) - x(e.startMin))}%`,
            top: `${(lane.lane / lane.lanes) * 100}%`,
            height: `${100 / lane.lanes}%`,
            ['--cat' as string]: cat.color,
          }}
          title={`${formatTimeRange(e.startMin, e.endMin)} ${e.title}`}
        >
          <span className="pc__block-label">{e.title}</span>
        </div>
      );
    });
  };

  return (
    <div className="pc">
      <div className="pc__track-wrap">
        <div className="pc__hours" aria-hidden="true">
          {hours.map((h, i) =>
            i % step === 0 ? (
              <span key={h} style={{ left: `${x(h)}%` }}>
                {h / 60}
              </span>
            ) : null,
          )}
        </div>
        <div className="pc__row" aria-hidden="true">
          <span className="pc__row-label">現在</span>
          <div className="pc__track">{row(before, 'before')}</div>
        </div>
        <svg className="pc__links" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          {result.changes.map((c, i) => {
            const x1 = x((c.fromStart + c.fromEnd) / 2);
            const x2 = x((c.toStart + c.toEnd) / 2);
            return (
              <motion.path
                key={c.id}
                d={`M ${x1} 0 C ${x1} 22, ${x2} 18, ${x2} 40`}
                className={c.id === primaryId ? 'is-primary' : ''}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: ease.glide, delay: 0.15 + i * 0.08 }}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        <div className="pc__row" aria-hidden="true">
          <span className="pc__row-label">提案</span>
          <div className="pc__track">{row(result.events, 'after')}</div>
        </div>
      </div>

      <div className="pc__summary">
        <p className="pc__counts">
          重なり <strong className="num">{result.conflictsBefore}</strong> 件 → <strong className="num">{result.conflictsAfter}</strong> 件
        </p>
        {result.changes.length === 0 ? (
          <p className="muted">動かす予定はありません。</p>
        ) : (
          <ol className="pc__changes">
            {result.changes.map((c) => {
              const delta = c.toStart - c.fromStart;
              return (
                <li key={c.id} className={c.id === primaryId ? 'is-primary' : ''}>
                  <span className="pc__change-title">{c.title}</span>
                  <span className="pc__change-time num">
                    {formatMinutes(c.fromStart)} → {formatMinutes(c.toStart)}
                  </span>
                  <span className="pc__change-delta">
                    {delta > 0 ? '+' : ''}
                    {formatDuration(delta)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {result.unplaced.length > 0 && (
          <p className="pc__warn" role="note">
            活動時間帯に収まらないため動かせない予定があります：
            {result.unplaced.map((u) => `「${u.title}」`).join('')}
            。重なりはそのまま残ります。
          </p>
        )}
      </div>
    </div>
  );
}
