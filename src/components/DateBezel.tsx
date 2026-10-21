/**
 * 日付のベゼル（回転する円環）
 * 外周の月環が回り、内側の針がその月の何日目かを指します。
 * 日付を移動すると、機械仕掛けのように回転して現在地を示します。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { daysInMonth, parseDateKey, weekdayOf, WEEKDAYS_JA, type DateKey } from '../lib/date';
import { continuousAngle, polar } from '../lib/geometry';
import { t } from '../motion/tokens';
import './DateBezel.css';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function DateBezel({ date, size = 112 }: { date: DateKey; size?: number }) {
  const reduce = useReducedMotion();
  const { year, month, day } = parseDateKey(date);
  const dim = daysInMonth(year, month);

  const monthTarget = -((month - 1) * 30);
  const dayTarget = ((day - 1) / dim) * 360;
  const monthRef = useRef(monthTarget);
  const dayRef = useRef(dayTarget);
  monthRef.current = continuousAngle(monthRef.current, monthTarget);
  dayRef.current = continuousAngle(dayRef.current, dayTarget);

  const transition = reduce ? { duration: 0 } : t.hand;

  return (
    <svg className="bezel" width={size} height={size} viewBox="-100 -100 200 200" aria-hidden="true">
      <circle r={97} className="bezel__rim" />
      <motion.g animate={{ rotate: monthRef.current }} transition={transition}>
        <circle r={100} fill="none" stroke="none" />
        {ROMAN.map((r, i) => {
          const p = polar(84, i * 30);
          return (
            <text key={r} x={p.x} y={p.y} className={`bezel__month ${i === month - 1 ? 'is-current' : ''}`} textAnchor="middle" dominantBaseline="central" transform={`rotate(${i * 30} ${p.x} ${p.y})`}>
              {r}
            </text>
          );
        })}
      </motion.g>
      <circle r={70} className="bezel__ring" />
      {Array.from({ length: dim }, (_, i) => {
        const a = (i / dim) * 360;
        const p1 = polar(66, a);
        const p2 = polar(i % 5 === 0 ? 56 : 61, a);
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className={`bezel__tick ${i + 1 === day ? 'is-current' : ''}`} />;
      })}
      <motion.g animate={{ rotate: dayRef.current }} transition={transition}>
        <circle r={100} fill="none" stroke="none" />
        <line x1={0} y1={8} x2={0} y2={-60} className="bezel__hand" />
        <circle cy={-62} r={4} className="bezel__hand-tip" />
      </motion.g>
      <path d="M -5 -100 L 5 -100 L 0 -91 Z" className="bezel__index" />
      <circle r={30} className="bezel__core" />
      <text y={1} textAnchor="middle" dominantBaseline="central" className="bezel__weekday">
        {WEEKDAYS_JA[weekdayOf(date)]}
      </text>
    </svg>
  );
}
