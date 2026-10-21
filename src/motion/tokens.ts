/**
 * モーションの語彙（CHRONOS ATELIER の動きのルール）
 *
 *  ESCAPEMENT（脱進機）… 素早く動き出し、カチリと止まる。日常の操作。
 *  GLIDE（滑走）       … 長く尾を引いて静かに止まる。大きな面の出入り。
 *  REGAL（儀式）       … 前後対称の荘厳な動き。画面の転換。
 *  IRIS（絞り）        … 円形に開く・閉じる。テーマ（色）の転換。
 *  ENGRAVE（彫刻）     … 線が描かれていく。装飾・図表の出現。
 *  TICK（刻み）        … 少しずつ時間差で並ぶ。一覧の出現。
 */
import type { Transition, Variants } from 'motion/react';

export const ease = {
  escapement: [0.7, 0, 0.2, 1] as const,
  glide: [0.22, 1, 0.36, 1] as const,
  regal: [0.65, 0, 0.35, 1] as const,
};

export const dur = {
  instant: 0.12,
  fast: 0.2,
  base: 0.32,
  slow: 0.5,
  grand: 0.8,
};

export const t = {
  fast: { duration: dur.fast, ease: ease.escapement } satisfies Transition,
  base: { duration: dur.base, ease: ease.escapement } satisfies Transition,
  glide: { duration: dur.slow, ease: ease.glide } satisfies Transition,
  regal: { duration: dur.slow, ease: ease.regal } satisfies Transition,
  /** 時計の針：重みのあるばね */
  hand: { type: 'spring', stiffness: 90, damping: 16, mass: 1 } satisfies Transition,
  /** 共有レイアウト（予定 → 私室） */
  chamber: { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 } satisfies Transition,
};

/** TICK：子要素を時間差で並べる */
export const tickContainer = (stagger = 0.04, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

export const tickItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.glide } },
};

/** 縮退モーション（OS の「視差効果を減らす」）用の一覧アニメーション */
export const tickItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.fast } },
};
