/**
 * 画面の切り替え
 * - デスクトップ: 左に傾いた大きな英字のメニュー（選ぶと白い帯＋赤い影）
 * - スマートフォン: 下部の黒い帯（中央に「新しい予定」）
 */
import { motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { useApp, type Route } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { t } from '../motion/tokens';
import { Icon, type IconName } from './Icon';
import './Navigation.css';

export const NAV_ITEMS: { route: Route; label: string; word: string; short: string; icon: IconName }[] = [
  { route: 'hall', label: 'ホーム', word: 'HOME', short: 'HOME', icon: 'hall' },
  { route: 'orrery', label: 'カレンダー', word: 'CALENDAR', short: 'CAL', icon: 'orrery' },
  { route: 'equation', label: '時間設計', word: 'PLAN', short: 'PLAN', icon: 'equation' },
  { route: 'chronicle', label: '振り返り', word: 'REVIEW', short: 'REVIEW', icon: 'chronicle' },
];

function originOf(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function Navigation({ onCreate }: { onCreate: () => void }) {
  const { route, navigate, setSettingsOpen } = useApp();
  const { saving } = useEvents();

  return (
    <>
      <nav className="rail" aria-label="主要な画面">
        <div className="rail__brand" aria-hidden="true">
          CHRONOS
          <span>ATELIER</span>
        </div>
        <ul className="rail__list">
          {NAV_ITEMS.map((item, i) => {
            const active = route === item.route;
            return (
              <li key={item.route} style={{ ['--i' as string]: i }}>
                <button
                  type="button"
                  className={`rail__item ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  onClick={(e) => navigate(item.route, originOf(e))}
                >
                  {active && <motion.span layoutId="rail-plate" className="rail__plate" transition={t.chamber} aria-hidden="true" />}
                  <span className="rail__word" aria-hidden="true">
                    {item.word}
                  </span>
                  <span className="rail__label" aria-hidden="true">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rail__foot">
          <button type="button" className="rail__create" onClick={onCreate} aria-label="新しい予定を作成">
            <Icon name="plus" size={20} />
            <span>NEW</span>
          </button>
          <button type="button" className="rail__gear" onClick={() => setSettingsOpen(true)} aria-label="設定">
            <Icon name="gear" size={18} />
            <span>SYSTEM</span>
          </button>
          <span className={`rail__saving ${saving ? 'is-on' : ''}`} role="status" aria-live="polite">
            {saving ? '保存中' : ''}
          </span>
        </div>
      </nav>

      <nav className="dock" aria-label="主要な画面">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <DockItem key={item.route} item={item} active={route === item.route} onClick={(e) => navigate(item.route, originOf(e))} />
        ))}
        <button type="button" className="dock__create" onClick={onCreate} aria-label="新しい予定を作成">
          <Icon name="plus" size={26} />
        </button>
        {NAV_ITEMS.slice(2).map((item) => (
          <DockItem key={item.route} item={item} active={route === item.route} onClick={(e) => navigate(item.route, originOf(e))} />
        ))}
      </nav>
    </>
  );
}

function DockItem({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button type="button" className={`dock__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>
      {active && <motion.span layoutId="dock-plate" className="dock__plate" transition={t.chamber} aria-hidden="true" />}
      <span className="dock__word" aria-hidden="true">
        {item.short}
      </span>
      <span className="dock__label">{item.label}</span>
    </button>
  );
}
