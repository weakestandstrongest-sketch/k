/**
 * 各画面の背景：霧のような光、鋭く細い斜線、半透明の刃のかたち、深紅の小さな環
 * 純粋な装飾なので、支援技術からは隠しています。
 * 線がカードの裏で途切れて見えないよう、装飾は最初の一画面ぶんだけに置き、下へ向かって溶かします。
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
    initial: draw ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 1.4, ease: ease.regal, delay: introDelay + d },
  });

  return (
    <>
      <div className={`backdrop backdrop--${kind}`} aria-hidden="true">
        <div className="backdrop__mist" />
        <svg className="backdrop__svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMin slice">
          {/* 半透明の刃 */}
          <g className="backdrop__blades">
            <polygon points="1180,-40 1230,-40 1080,1040 1040,1040" />
            <polygon points="1420,-40 1450,-40 1330,1040 1300,1040" />
            <polygon points="180,1040 220,1040 520,-40 500,-40" />
          </g>
          {/* 深紅の環と軸（刃に刻まれた印のような小さな意匠） */}
          <motion.g
            className="backdrop__sigil"
            initial={draw ? { opacity: 0, scale: 0.6 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: ease.glide, delay: introDelay + 0.8 }}
          >
            <circle cx="1166" cy="300" r="13" />
            <line x1="1162" y1="320" x2="1128" y2="470" />
          </motion.g>
        </svg>
        <span className="backdrop__word">{WORD[kind]}</span>
      </div>
      {/* 鋭い細線はカードの上に重ねる（カードの裏に隠れて途切れて見えないように） */}
      <div className="backdrop backdrop--lines" aria-hidden="true">
        <svg className="backdrop__svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMaxYMin slice">
          <motion.path className="backdrop__hair" d="M 1240 -20 L 980 1020" {...line(0)} />
          <motion.path className="backdrop__hair backdrop__hair--faint" d="M 1520 -20 L 1340 1020" {...line(0.15)} />
          <motion.path className="backdrop__hair backdrop__hair--accent" d="M 1300 -20 L 1050 1020" {...line(0.45)} />
        </svg>
      </div>
    </>
  );
}

export const Backdrop = memo(BackdropImpl);
