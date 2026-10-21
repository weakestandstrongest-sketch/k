/**
 * 各画面の背景：霧のような光と、機械の図面のような細い線
 * - 右上に、目盛りの付いた大きな環（ゆっくり回る）と、深紅の短い弧
 * - 環を斜めに横切る一本の細線と、その上の小さな節（深紅の点）
 * - 小さな十字の印がいくつか
 * 純粋な装飾なので、支援技術からは隠しています。
 * 文字やカードより奥に置き、最初の一画面ぶんだけ。下へ向かって溶かします。
 */
import { motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { ease } from '../motion/tokens';
import './Backdrop.css';

export type BackdropKind = 'hall' | 'orrery' | 'equation' | 'chronicle';

/** 画面の端に縦に置く、字間の広い英字 */
const WORD: Record<BackdropKind, string> = {
  hall: 'TODAY',
  orrery: 'CALENDAR',
  equation: 'PLANNING',
  chronicle: 'ARCHIVE',
};

function BackdropImpl({ kind, intro = false, introDelay = 0 }: { kind: BackdropKind; intro?: boolean; introDelay?: number }) {
  const reduce = useReducedMotion();
  const draw = intro && !reduce;
  const line = (d: number) => ({
    initial: draw ? { pathLength: 0 } : false,
    animate: { pathLength: 1 },
    transition: { duration: 1.4, ease: ease.regal, delay: introDelay + d },
  });

  return (
    <div className={`backdrop backdrop--${kind}`} aria-hidden="true">
      <div className="backdrop__mist" />
      <svg className="backdrop__svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMin slice">
        {/* 半透明の刃 */}
        <g className="backdrop__blades">
          <polygon points="1180,-40 1230,-40 1080,1040 1040,1040" />
          <polygon points="180,1040 220,1040 520,-40 500,-40" />
        </g>

        {/* 目盛りの環（右上、画面の外にはみ出す大きな円） */}
        <motion.circle className="backdrop__ring" cx={RING.x} cy={RING.y} r={RING.r} {...line(0)} />
        <motion.circle className="backdrop__ring backdrop__ring--inner" cx={RING.x} cy={RING.y} r={RING.r - 46} {...line(0.1)} />
        <g className="backdrop__ticks">
          {TICKS.map((t) => (
            <line key={t.a} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.major ? 'is-major' : ''} />
          ))}
        </g>
        {/* 深紅の短い弧 */}
        <motion.path className="backdrop__arc" d={ARC} {...line(0.5)} />

        {/* 斜めの細線と、その上の節 */}
        <motion.path className="backdrop__hair" d="M 1500 -20 L 1150 1020" {...line(0.2)} />
        <motion.path className="backdrop__hair backdrop__hair--faint" d="M 1590 -20 L 1440 430" {...line(0.35)} />
        <motion.g
          initial={draw ? { opacity: 0, scale: 0.4 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: ease.glide, delay: introDelay + 0.9 }}
          style={{ transformOrigin: `${NODE.x}px ${NODE.y}px` }}
        >
          <circle className="backdrop__node-ring" cx={NODE.x} cy={NODE.y} r={11} />
          <circle className="backdrop__node" cx={NODE.x} cy={NODE.y} r={3.5} />
          <circle className="backdrop__node backdrop__node--end" cx={1440} cy={430} r={2.5} />
        </motion.g>

        {/* 小さな十字の印 */}
        <g className="backdrop__marks">
          {MARKS.map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M ${x - 7} ${y} H ${x + 7} M ${x} ${y - 7} V ${y + 7}`} />
          ))}
        </g>
      </svg>
      <span className="backdrop__word">{WORD[kind]}</span>
    </div>
  );
}

const RING = { x: 1560, y: 110, r: 310 };

/** 環の内側の目盛り（5° ごと、30° ごとに長く） */
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180;
  const major = i % 6 === 0;
  const r1 = RING.r - 8;
  const r2 = RING.r - (major ? 30 : 18);
  const p = (r: number) => [RING.x + r * Math.cos(a), RING.y + r * Math.sin(a)].map((v) => Math.round(v * 10) / 10);
  const [x1, y1] = p(r1);
  const [x2, y2] = p(r2);
  return { a: i, x1, y1, x2, y2, major };
});

/** 深紅の弧（環の左下、110°〜128°） */
const ARC = (() => {
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(RING.x + RING.r * Math.cos(a)).toFixed(1)} ${(RING.y + RING.r * Math.sin(a)).toFixed(1)}`;
  };
  return `M ${pt(110)} A ${RING.r} ${RING.r} 0 0 1 ${pt(128)}`;
})();

/** 斜めの細線の上の節（上端近く、文字に重ならない位置） */
const NODE = { x: 1500 - (350 * 90) / 1040, y: 70 };

const MARKS: [number, number][] = [
  [1235, 590],
  [1505, 720],
  [1330, 470],
];

export const Backdrop = memo(BackdropImpl);
