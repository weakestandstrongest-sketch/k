/**
 * 右下のガイド：いまの画面でできることを一行で示し、使えるキーを添える（デスクトップのみ）
 */
import { AnimatePresence, motion } from 'motion/react';
import { useApp, type Route } from '../state/AppContext';
import { ease } from '../motion/tokens';
import './GuideBar.css';

const GUIDE: Record<Route, { text: string; keys: [string, string][] }> = {
  hall: { text: '今日はどう過ごす？', keys: [['N', '新しい予定']] },
  orrery: { text: '予定を確認・調整する', keys: [['←→', '移動'], ['T', '今日'], ['D/W/M', '表示'], ['N', '新規']] },
  equation: { text: '空き時間と重なりを整える', keys: [['N', '新しい予定']] },
  chronicle: { text: 'これまでの時間を振り返る', keys: [['N', '新しい予定']] },
};

export function GuideBar() {
  const { route, chamber, reviewDate } = useApp();
  const g = chamber
    ? { text: chamber.mode === 'view' ? 'この予定をどうする？' : '予定を書き込む', keys: [['Esc', '戻る']] as [string, string][] }
    : reviewDate
      ? { text: '今日をどう過ごした？', keys: [['Esc', '戻る']] as [string, string][] }
      : GUIDE[route];
  const key = chamber ? `c-${chamber.mode}` : reviewDate ? 'review' : route;

  return (
    <div className="guide" aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          className="guide__inner"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: ease.escapement }}
        >
          <p className="guide__text">{g.text}</p>
          <p className="guide__rule">
            <span>Guide</span>
          </p>
          <p className="guide__keys">
            {g.keys.map(([k, label]) => (
              <span key={k}>
                <kbd>{k}</kbd>
                {label}
              </span>
            ))}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
