/**
 * 起動時の演出（1セッションにつき1回）
 *  1. 漆黒の画面に、鋭い白い斜線が走る
 *  2. 字間の広い題字と、小さな印（時ノ工房）が浮かぶ
 *  3. 今日の日付と予定の件数、「触れてはじめる」の帯が現れる
 *  4. 静かに溶けて、ホームへ
 * 画面に触れる・キーを押すと、すぐに先へ進みます。
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatDateJa, todayKey } from '../lib/date';
import { ease } from '../motion/tokens';
import './OpeningSequence.css';

interface Props {
  eventCount: number | null;
  /** 溶け始めたとき（後ろの画面を表示する合図） */
  onReveal: () => void;
  /** 演出が完全に終わったとき */
  onDone: () => void;
}

const HOLD_MS = 2800;
const FADE_S = 0.7;

/** 題字を切り裂く鋭い斜線（x, y は %、長さと角度） */
const SLASHES = [
  { x: 14, y: 70, len: 34, rot: -52, w: 3, d: 0.1 },
  { x: 33, y: 64, len: 22, rot: -38, w: 2, d: 0.22 },
  { x: 52, y: 30, len: 30, rot: 36, w: 2.5, d: 0.3 },
  { x: 63, y: 58, len: 18, rot: -64, w: 2, d: 0.38 },
  { x: 74, y: 40, len: 26, rot: -12, w: 1.5, d: 0.46 },
];

export function OpeningSequence({ eventCount, onReveal, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const revealed = useRef(false);
  const today = useRef(todayKey()).current;

  const reveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setLeaving(true);
    onReveal();
  };

  useEffect(() => {
    const id = window.setTimeout(reveal, HOLD_MS);
    const skip = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return;
      reveal();
    };
    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', skip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="opening"
      role="presentation"
      onClick={reveal}
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0, scale: 1.03, filter: 'blur(6px)' } : { opacity: 1 }}
      transition={{ duration: FADE_S, ease: ease.glide }}
      onAnimationComplete={() => leaving && onDone()}
    >
      <p className="sr-only" role="status">
        刻 を起動しています
      </p>
      <p className="opening__ver" aria-hidden="true">
        Ver 1.0
      </p>

      <div className="opening__mark" aria-hidden="true">
        {SLASHES.map((s, i) => (
          <motion.span
            key={i}
            className="opening__slash"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.len}%`, height: s.w, rotate: s.rot }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: ease.escapement, delay: s.d }}
          />
        ))}
        <motion.p
          className="opening__title opening__title--kanji"
          initial={{ opacity: 0, letterSpacing: '1.2em' }}
          animate={{ opacity: 1, letterSpacing: '0.62em' }}
          transition={{ duration: 1.4, ease: ease.glide, delay: 0.5 }}
        >
          刻
        </motion.p>
        <motion.p className="opening__subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.9 }}>
          K O K U
        </motion.p>
        <motion.span className="opening__seal" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: ease.glide, delay: 1.1 }}>
          時ノ
          <br />
          工房
        </motion.span>
      </div>

      <motion.div className="opening__band" initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.7, ease: ease.glide, delay: 1.4 }}>
        <motion.span animate={leaving ? undefined : { opacity: [1, 0.35, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}>
          画面に触れてはじめる
        </motion.span>
      </motion.div>

      <motion.p className="opening__today" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.6 }}>
        {formatDateJa(today, { year: true })}
        <span>{eventCount == null ? '時を整えています…' : eventCount === 0 ? '本日の予定はありません' : `本日の予定 ${eventCount}件`}</span>
      </motion.p>

      {!leaving && (
        <button
          type="button"
          className="opening__skip"
          onClick={(e) => {
            e.stopPropagation();
            reveal();
          }}
        >
          スキップ
        </button>
      )}
    </motion.div>
  );
}
