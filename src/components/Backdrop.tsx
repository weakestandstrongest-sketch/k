/**
 * 各画面の背景：霧のような光、ごく淡い細線、半透明の刃のかたち
 * 純粋な装飾なので、支援技術からは隠しています。
 * 装飾はいちばん後ろに置き、最初の一画面ぶんだけに。下へ向かって溶かします。
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
          <polygon points="1420,-40 1450,-40 1330,1040 1300,1040" />
          <polygon points="180,1040 220,1040 520,-40 500,-40" />
        </g>
        {/* しれっと一本だけ走る、ごく淡い細線 */}
        <motion.path className="backdrop__hair" d="M 1520 -20 L 1340 1020" {...line(0)} />
      </svg>
      <span className="backdrop__word">{WORD[kind]}</span>
    </div>
  );
}

export const Backdrop = memo(BackdropImpl);
