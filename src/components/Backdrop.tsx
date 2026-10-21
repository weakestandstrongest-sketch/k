/**
 * 各画面の背景：水面の揺らめき・漂う欠片・画面の端の巨大な縦文字
 * 純粋な装飾なので、支援技術からは隠しています。
 */
import { motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { ease } from '../motion/tokens';
import './Backdrop.css';

export type BackdropKind = 'hall' | 'orrery' | 'equation' | 'chronicle';

/** 画面の端に縦に置く大きな英字 */
const WORD: Record<BackdropKind, string> = {
  hall: 'TODAY',
  orrery: 'CALENDAR',
  equation: 'PLANNING',
  chronicle: 'ARCHIVE',
};

/** 漂う欠片（位置・大きさ・色・回転・動きの遅れ） */
const SHARDS: { x: number; y: number; w: number; h: number; c: string; r: number; d: number }[] = [
  { x: 8, y: 22, w: 18, h: 26, c: 'var(--shard-a)', r: 18, d: 0 },
  { x: 22, y: 64, w: 12, h: 18, c: 'var(--shard-b)', r: -24, d: 1.2 },
  { x: 41, y: 12, w: 10, h: 14, c: 'var(--shard-c)', r: 40, d: 2.1 },
  { x: 57, y: 78, w: 22, h: 30, c: 'var(--shard-a)', r: -12, d: 0.6 },
  { x: 68, y: 36, w: 9, h: 12, c: 'var(--shard-b)', r: 30, d: 1.8 },
  { x: 83, y: 58, w: 16, h: 22, c: 'var(--shard-c)', r: -36, d: 0.3 },
  { x: 91, y: 18, w: 11, h: 16, c: 'var(--shard-a)', r: 12, d: 2.6 },
  { x: 35, y: 88, w: 14, h: 10, c: 'var(--shard-b)', r: 52, d: 1.5 },
];

function BackdropImpl({ kind, intro = false, introDelay = 0 }: { kind: BackdropKind; intro?: boolean; introDelay?: number }) {
  const reduce = useReducedMotion();
  const animate = intro && !reduce;

  return (
    <div className={`backdrop backdrop--${kind}`} aria-hidden="true">
      <div className="backdrop__water" />
      <div className="backdrop__vignette" />
      <motion.div
        className="backdrop__word-wrap"
        initial={animate ? { opacity: 0, x: 80 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: ease.glide, delay: introDelay }}
      >
        <span className="backdrop__word">{WORD[kind]}</span>
      </motion.div>
      {SHARDS.map((s, i) => (
        <span
          key={i}
          className="backdrop__shard"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.w, height: s.h, background: s.c, ['--r' as string]: `${s.r}deg`, animationDelay: `${-s.d * 3}s` }}
        />
      ))}
    </div>
  );
}

export const Backdrop = memo(BackdropImpl);
