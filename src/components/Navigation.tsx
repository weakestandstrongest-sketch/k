/**
 * 画面の切り替え
 * - デスクトップ: iPad のようなサイドバー（選択中は丸い面で示す）
 * - スマートフォン: 浮かんだすりガラスのタブバー（右端に丸い「新しい予定」）
 */
import { motion } from 'motion/react';
import type { MouseEvent } from 'react';
import { useApp, type Route } from '../state/AppContext';
import { useEvents } from '../state/EventsContext';
import { t } from '../motion/tokens';
import { Icon, type IconName } from './Icon';
import { HibiButton } from './HibiButton';
import './Navigation.css';

export const NAV_ITEMS: { route: Route; label: string; word: string; icon: IconName }[] = [
  { route: 'hall', label: 'ホーム', word: 'HOME', icon: 'hall' },
  { route: 'orrery', label: 'カレンダー', word: 'CALENDAR', icon: 'orrery' },
  { route: 'chronicle', label: '振り返り', word: 'ARCHIVE', icon: 'chronicle' },
  { route: 'settings', label: '設定', word: 'SETTINGS', icon: 'gear' },
];

function originOf(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function Navigation({ onCreate }: { onCreate: () => void }) {
  const { route, navigate } = useApp();
  const { saving } = useEvents();

  return (
    <>
      <nav className="rail" aria-label="主要な画面">
        <div className="rail__brand" aria-hidden="true">
          <span className="rail__sigil" />
          <span className="rail__brand-word">CHRONOS</span>
        </div>
        <ul className="rail__list">
          {NAV_ITEMS.map((item) => {
            const active = route === item.route;
            return (
              <li key={item.route}>
                <button
                  type="button"
                  className={`rail__item ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => navigate(item.route, originOf(e))}
                >
                  {active && <motion.span layoutId="rail-pill" className="rail__pill" transition={t.chamber} aria-hidden="true" />}
                  <Icon name={item.icon} size={20} className="rail__icon" />
                  <span className="rail__text">
                    <span className="rail__label">{item.label}</span>
                    <span className="rail__word" aria-hidden="true">
                      {item.word}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="rail__foot">
          <button type="button" className="rail__create" onClick={onCreate} aria-label="新しい予定を作成">
            <Icon name="plus" size={20} />
            <span className="rail__text">新しい予定</span>
          </button>
          <HibiButton className="rail__item rail__hibi" withLabel />
          <span className={`rail__saving ${saving ? 'is-on' : ''}`} role="status" aria-live="polite">
            {saving ? '保存中…' : ''}
          </span>
        </div>
      </nav>

      {/* iOS のように浮かんだ、すりガラスの丸いタブバー。右端に丸い「＋」 */}
      <div className="dock">
        <nav className="dock__bar" aria-label="主要な画面">
          {NAV_ITEMS.map((item) => (
            <DockItem key={item.route} item={item} active={route === item.route} onClick={(e) => navigate(item.route, originOf(e))} />
          ))}
        </nav>
        <button type="button" className="dock__create" onClick={onCreate} aria-label="新しい予定を作成">
          <Icon name="plus" size={26} />
        </button>
      </div>
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
      {active && <motion.span layoutId="dock-pill" className="dock__pill" transition={{ type: 'spring', stiffness: 520, damping: 40 }} aria-hidden="true" />}
      <Icon name={item.icon} size={22} />
      <span className="dock__label">{item.label}</span>
    </button>
  );
}
