/**
 * 起動時の演出（1セッションにつき1回）
 *  1. 深い青の部屋に、窓越しの大きな満月が昇る
 *  2. 窓枠が組み上がる
 *  3. 今日の日付が大きな文字で飛び込んでくる
 *  4. 今日の予定の件数が現れる
 *  5. 白い斜めの閃光とともに画面が切り裂かれ、ホームへ
 * 画面に触れる・キーを押すと、すぐに先へ進みます。
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { parseDateKey, todayKey, weekdayOf } from '../lib/date';
import { ease } from '../motion/tokens';
import './OpeningSequence.css';

interface Props {
  eventCount: number | null;
  /** 切り裂きが始まったとき（後ろの画面を表示する合図） */
  onReveal: () => void;
  /** 演出が完全に終わったとき */
  onDone: () => void;
}

const HOLD_MS = 2600;
const WIPE_S = 0.7;
const WEEK_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function OpeningSequence({ eventCount, onReveal, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const revealed = useRef(false);
  const today = useRef(todayKey()).current;
  const { month, day } = parseDateKey(today);

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

  const lines = [`${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`, WEEK_EN[weekdayOf(today)], 'TONIGHT'];

  return (
    <motion.div
      className="opening"
      role="presentation"
      onClick={reveal}
      initial={{ clipPath: 'polygon(0% 0%, 130% 0%, 130% 100%, -30% 100%)' }}
      animate={leaving ? { clipPath: 'polygon(160% 0%, 130% 0%, 130% 100%, 130% 100%)' } : undefined}
      transition={{ duration: WIPE_S, ease: ease.regal }}
      onAnimationComplete={() => leaving && onDone()}
    >
      <p className="sr-only" role="status">
        CHRONOS ATELIER を起動しています
      </p>

      {/* 月 */}
      <motion.div
        className="opening__moon"
        aria-hidden="true"
        initial={{ y: '18%', opacity: 0, scale: 0.92 }}
        animate={{ y: '0%', opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: ease.glide }}
      />
      {/* 雲 */}
      <motion.div className="opening__clouds" aria-hidden="true" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 2, ease: ease.glide, delay: 0.2 }} />
      {/* 窓枠 */}
      <div className="opening__window" aria-hidden="true">
        {['v1', 'v2', 'v3', 'h1', 'h2'].map((k, i) => (
          <motion.span
            key={k}
            className={`opening__bar opening__bar--${k}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.6, ease: ease.escapement, delay: 0.35 + i * 0.07 }}
          />
        ))}
      </div>
      <motion.div className="opening__curtain" aria-hidden="true" initial={{ x: '40%' }} animate={{ x: '0%' }} transition={{ duration: 1.2, ease: ease.glide, delay: 0.2 }} />

      {/* 左の青い柱と大きな文字 */}
      <motion.span className="opening__pillar" aria-hidden="true" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.5, ease: ease.escapement, delay: 0.6 }} />
      <div className="opening__type" aria-hidden="true">
        <motion.p className="opening__brand" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: ease.glide, delay: 0.7 }}>
          CHRONOS ATELIER
        </motion.p>
        {lines.map((text, i) => (
          <motion.p
            key={text}
            className="opening__line"
            initial={{ opacity: 0, x: -120, skewX: -20 }}
            animate={{ opacity: 1, x: 0, skewX: 0 }}
            transition={{ duration: 0.45, ease: ease.escapement, delay: 0.85 + i * 0.12 }}
          >
            {text}
          </motion.p>
        ))}
        <motion.p className="opening__count" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 1.4 }}>
          {eventCount == null ? '時を整えています…' : eventCount === 0 ? '本日の予定はありません' : `本日の予定 ${eventCount}件`}
        </motion.p>
      </div>

      {!leaving && (
        <motion.p className="opening__hint" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.3, 1] }} transition={{ duration: 2, delay: 1.6, repeat: Infinity, repeatType: 'mirror' }}>
          画面に触れると始まります
        </motion.p>
      )}

      {/* 切り裂く白い閃光 */}
      {leaving && (
        <motion.span
          className="opening__slash"
          aria-hidden="true"
          initial={{ x: '-40vw' }}
          animate={{ x: '140vw' }}
          transition={{ duration: WIPE_S, ease: ease.regal }}
        />
      )}
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
