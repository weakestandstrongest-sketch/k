/**
 * 機械式時計の「日付窓」のように、文字が一桁ずつ回転して入れ替わる表示。
 * 変わった桁だけが動き、移動の向き（未来・過去）で回る方向が変わります。
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ease } from '../motion/tokens';
import './RollingText.css';

interface Props {
  text: string;
  direction?: 1 | -1;
  className?: string;
  /** 桁ごとの時間差（秒） */
  stagger?: number;
  /** 'roll' は縦回転（数字向け）、'flip' は奥行きのある反転（漢字向け） */
  mode?: 'roll' | 'flip';
}

export function RollingText({ text, direction = 1, className = '', stagger = 0.035, mode = 'roll' }: Props) {
  const reduce = useReducedMotion();
  const chars = Array.from(text);
  return (
    <span className={`rolling ${className}`}>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => (
        <span className="rolling__slot" key={`${i}-${chars.length}`} aria-hidden="true">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.span
              key={ch}
              className="rolling__char"
              custom={direction}
              variants={reduce ? fadeVariants : mode === 'roll' ? rollVariants : flipVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.42, ease: ease.escapement, delay: reduce ? 0 : i * stagger }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

const rollVariants = {
  enter: (dir: number) => ({ y: dir > 0 ? '105%' : '-105%', opacity: 0.2 }),
  center: { y: '0%', opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? '-105%' : '105%', opacity: 0.2 }),
};

const flipVariants = {
  enter: (dir: number) => ({ rotateX: dir > 0 ? -90 : 90, opacity: 0 }),
  center: { rotateX: 0, opacity: 1 },
  exit: (dir: number) => ({ rotateX: dir > 0 ? 90 : -90, opacity: 0 }),
};

const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};
