/**
 * 画面の切り替え
 * - デスクトップ: 左の柱（縦書きの見出し）
 * - スマートフォン: 下部のバー（中央に「新しい予定」）
 */
import { motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { useApp, type Route } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { t } from '../motion/tokens';
import { Icon, type IconName } from './Icon';
import './Navigation.css';

export const NAV_ITEMS: { route: Route; label: string; numeral: string; brand: string; icon: IconName }[] = [
  { route: 'hall', label: 'ホーム', numeral: 'I', brand: 'THE GRAND HALL', icon: 'hall' },
  { route: 'orrery', label: 'カレンダー', numeral: 'II', brand: 'THE ORRERY', icon: 'orrery' },
  { route: 'equation', label: '時間設計', numeral: 'III', brand: 'THE EQUATION', icon: 'equation' },
  { route: 'chronicle', label: '振り返り', numeral: 'IV', brand: 'THE CHRONICLE', icon: 'chronicle' },
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
          <span className="rail__brand-mark">C</span>
          <span className="rail__brand-word">CHRONOS</span>
        </div>
        <ul className="rail__list">
          {NAV_ITEMS.map((item) => (
            <li key={item.route}>
              <button
                type="button"
                className={`rail__item ${route === item.route ? 'is-active' : ''}`}
                aria-current={route === item.route ? 'page' : undefined}
                onClick={(e) => navigate(item.route, originOf(e))}
              >
                {route === item.route && <motion.span layoutId="rail-pendulum" className="rail__pendulum" transition={t.chamber} />}
                <span className="rail__numeral" aria-hidden="true">
                  {item.numeral}
                </span>
                <span className="rail__label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="rail__foot">
          <button type="button" className="rail__create" onClick={onCreate} aria-label="新しい予定を作成">
            <Icon name="plus" size={22} />
          </button>
          <button type="button" className="rail__gear" onClick={() => setSettingsOpen(true)} aria-label="設定">
            <Icon name="gear" size={20} />
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
          <span className="dock__create-ring" aria-hidden="true" />
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
      {active && <motion.span layoutId="dock-jewel" className="dock__jewel" transition={t.chamber} />}
      <Icon name={item.icon} size={22} />
      <span className="dock__label">{item.label}</span>
    </button>
  );
}
