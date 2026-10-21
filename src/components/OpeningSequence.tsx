/**
 * 起動時の演出（1セッションにつき1回）
 *  1. 暗い建築の背景が現れる
 *  2. 装飾の枠線が描かれる
 *  3. 文字盤が一周して現れ、針が現在時刻へ
 *  4. 今日の日付と予定の件数が浮かび上がる
 *  5. 宮殿の扉のように左右へ開き、ホーム画面へ
 * クリック・キー操作でいつでも飛ばせます。
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { formatDateJa, minutesOfDay, parseDateKey, todayKey, wafuMonthName } from '../lib/date';
import { minuteToAngle, polar } from '../lib/geometry';
import { ease } from '../motion/tokens';
import './OpeningSequence.css';

interface Props {
  eventCount: number | null;
  /** 扉が開き始めたとき（後ろの画面を表示する合図） */
  onReveal: () => void;
  /** 演出が完全に終わったとき */
  onDone: () => void;
}

const HOLD_MS = 2300; // 扉が開き始めるまで
const OPEN_S = 0.85;

export function OpeningSequence({ eventCount, onReveal, onDone }: Props) {
  const [opening, setOpening] = useState(false);
  const revealed = useRef(false);
  const now = useRef(new Date()).current;
  const today = todayKey(now);
  const { year, day } = parseDateKey(today);

  const reveal = () => {
    if (revealed.current) return;
    revealed.current = true;
    setOpening(true);
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

  const handAngle = minuteToAngle(minutesOfDay(now));
  const content = (
    <div className="opening__content">
      <svg className="opening__frame" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        {/* 建築の枠 */}
        {[
          'M 40 40 L 960 40 L 960 960 L 40 960 Z',
          'M 60 60 L 940 60 L 940 940 L 60 940 Z',
          'M 500 40 L 500 120',
          'M 500 880 L 500 960',
          'M 40 500 L 120 500',
          'M 880 500 L 960 500',
        ].map((d, i) => (
          <motion.path
            key={i}
            d={d}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: ease.regal, delay: 0.1 + i * 0.06 }}
          />
        ))}
      </svg>

      <div className="opening__center">
        <svg className="opening__dial" viewBox="-200 -200 400 400" aria-hidden="true">
          <motion.circle
            r={180}
            className="opening__ring"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: ease.regal, delay: 0.35 }}
            transform="rotate(-90)"
          />
          <motion.circle
            r={164}
            className="opening__ring opening__ring--thin"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: ease.regal, delay: 0.5 }}
            transform="rotate(-90)"
          />
          {Array.from({ length: 24 }, (_, i) => {
            const a = i * 15;
            const p1 = polar(176, a);
            const p2 = polar(i % 6 === 0 ? 150 : 162, a);
            return (
              <motion.line
                key={i}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                className={i % 6 === 0 ? 'opening__tick opening__tick--major' : 'opening__tick'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.55 + i * 0.03 }}
              />
            );
          })}
          <motion.g
            initial={{ rotate: handAngle - 360, opacity: 0 }}
            animate={{ rotate: handAngle, opacity: 1 }}
            transition={{ rotate: { duration: 1.5, ease: ease.glide, delay: 0.7 }, opacity: { duration: 0.3, delay: 0.7 } }}
          >
            <circle r={200} fill="none" stroke="none" />
            <line x1={0} y1={20} x2={0} y2={-170} className="opening__hand" />
            <circle cy={-176} r={6} className="opening__sun" />
          </motion.g>
          <circle r={7} className="opening__pin" />
        </svg>

        <motion.p
          className="opening__brand"
          initial={{ opacity: 0, letterSpacing: '1.4em' }}
          animate={{ opacity: 1, letterSpacing: '0.6em' }}
          transition={{ duration: 1.4, ease: ease.glide, delay: 0.3 }}
        >
          CHRONOS ATELIER
        </motion.p>
        <div className="opening__date">
          <motion.span
            className="opening__day"
            initial={{ opacity: 0, y: 30, clipPath: 'inset(100% 0 0 0)' }}
            animate={{ opacity: 1, y: 0, clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 0.8, ease: ease.glide, delay: 1.15 }}
          >
            {day}
          </motion.span>
          <motion.span
            className="opening__date-text"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: ease.glide, delay: 1.35 }}
          >
            <span>
              {year}年 {wafuMonthName(today)}
            </span>
            <span className="opening__date-full">{formatDateJa(today)}</span>
          </motion.span>
        </div>
        <motion.p
          className="opening__schedule"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.6 }}
        >
          {eventCount == null ? '時を整えています…' : eventCount === 0 ? '本日の予定はありません' : `本日の予定 ${eventCount}件`}
        </motion.p>
      </div>
    </div>
  );

  return (
    <div className="opening" role="presentation" onClick={reveal}>
      <p className="sr-only" role="status">
        CHRONOS ATELIER を起動しています
      </p>
      {/* 左右の扉。同じ中身を左右半分ずつ切り取り、外側へ開く */}
      {(['left', 'right'] as const).map((side) => (
        <motion.div
          key={side}
          className={`opening__door opening__door--${side}`}
          animate={opening ? { x: side === 'left' ? '-52%' : '52%', opacity: 0.0 } : { x: '0%', opacity: 1 }}
          transition={{ x: { duration: OPEN_S, ease: ease.regal }, opacity: { duration: OPEN_S * 0.9, ease: [0.6, 0, 1, 1] } }}
          onAnimationComplete={() => {
            if (opening && side === 'right') onDone();
          }}
        >
          {content}
        </motion.div>
      ))}
      {!opening && (
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
    </div>
  );
}
