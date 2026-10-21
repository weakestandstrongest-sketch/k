/**
 * アプリの骨組み
 * Provider（状態）→ Shell（ナビゲーション・画面・重ねて表示するパネル）
 */
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chamber } from './components/Chamber';
import { DailyReview } from './components/DailyReview';
import { GuideBar } from './components/GuideBar';
import { Navigation, NAV_ITEMS } from './components/Navigation';
import { OpeningSequence } from './components/OpeningSequence';
import { SettingsDialog } from './components/SettingsDialog';
import { StatusNotices } from './components/StatusNotices';
import { Toasts } from './components/Toasts';
import { emptyDraft } from './data/eventModel';
import { minutesOfDay, todayKey } from './lib/date';
import { snapMinutes } from './lib/schedule';
import { ease } from './motion/tokens';
import { Chronicle } from './screens/Chronicle';
import { Equation } from './screens/Equation';
import { GrandHall } from './screens/GrandHall';
import { Orrery } from './screens/Orrery';
import { AppProvider, ROUTE_THEME, useApp, type Point, type Route } from './state/AppContext';
import { ConfirmProvider } from './state/ConfirmContext';
import { EventsProvider, useEvents } from './state/EventsContext';
import { MoveProvider } from './state/MoveContext';
import { ToastProvider } from './state/ToastContext';

const INTRO_KEY = 'chronos:intro-played';

const THEME_COLOR: Record<string, string> = {
  hall: '#0b0a09',
  orrery: '#ece5d6',
  chamber: '#120707',
  equation: '#070c18',
  chronicle: '#15100a',
  night: '#05060d',
};

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <ConfirmProvider>
          <EventsProvider>
            <AppProvider>
              <MoveProvider>
                <Shell />
              </MoveProvider>
            </AppProvider>
          </EventsProvider>
        </ConfirmProvider>
      </ToastProvider>
    </MotionConfig>
  );
}

type IntroState = 'playing' | 'revealing' | 'done';

function readIntroPlayed(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return true;
  }
}

function Shell() {
  const reduce = useReducedMotion();
  const { route, chamber, reviewDate, openChamber, focusDate } = useApp();
  const { events, status } = useEvents();
  const [intro, setIntro] = useState<IntroState>(() => (readIntroPlayed() || reduce ? 'done' : 'playing'));

  // 画面・状況に合わせてページ全体のテーマ（ナビゲーションの色など）を切り替える
  const rootTheme = chamber ? 'chamber' : reviewDate ? 'night' : ROUTE_THEME[route];
  useEffect(() => {
    document.documentElement.dataset.theme = rootTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[rootTheme] ?? '#0b0a09');
  }, [rootTheme]);

  const markIntroPlayed = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* 保存できなくても動作に影響なし */
    }
  }, []);

  const create = useCallback(
    () => {
      const today = todayKey();
      const date = route === 'orrery' || route === 'equation' ? focusDate : today;
      const nowMin = minutesOfDay(new Date());
      const start = date === today ? Math.min(snapMinutes(nowMin + 30, 30), 23 * 60) : 9 * 60;
      openChamber({ mode: 'new', draft: emptyDraft(date, start) });
    },
    [route, focusDate, openChamber],
  );

  // キーボード：N で新しい予定（入力中やパネル表示中は無効）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (chamber || reviewDate || document.querySelector('.dialog-layer, .opening')) return;
      e.preventDefault();
      create();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [create, chamber, reviewDate]);

  const todayCount = status === 'loading' ? null : events.filter((e) => e.date === todayKey()).length;
  const showUi = intro !== 'playing';

  return (
    <div className="app">
      {showUi && (
        <motion.div
          initial={intro === 'revealing' ? { opacity: 0, x: -20 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: ease.glide, delay: 0.5 }}
        >
          <Navigation onCreate={create} />
        </motion.div>
      )}
      {showUi && <ScreenStage entranceDelay={intro === 'revealing' ? 0.2 : 0} />}

      <AnimatePresence>{chamber && <Chamber key="chamber" />}</AnimatePresence>
      <AnimatePresence>{reviewDate && <DailyReview key={`review-${reviewDate}`} date={reviewDate} />}</AnimatePresence>
      {showUi && <GuideBar />}
      <SettingsDialog />
      <StatusNotices />
      <Toasts />

      {intro !== 'done' && (
        <OpeningSequence
          eventCount={todayCount}
          onReveal={() => {
            markIntroPlayed();
            setIntro('revealing');
          }}
          onDone={() => setIntro('done')}
        />
      )}
    </div>
  );
}

// ---------- 画面の転換（斜めに切り裂くように、新しい画面が左から差し込む） ----------

const irisVariants: Variants = {
  enter: { clipPath: 'polygon(0% 0%, 0% 0%, -30% 100%, -30% 100%)', zIndex: 2 },
  center: {
    clipPath: 'polygon(0% 0%, 160% 0%, 130% 100%, -30% 100%)',
    zIndex: 2,
    x: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: ease.regal },
    transitionEnd: { clipPath: 'none' },
  },
  exit: { zIndex: 1, x: -60, opacity: 0.4, transition: { duration: 0.5, ease: ease.regal } },
};

const fadeVariants: Variants = {
  enter: { opacity: 0, zIndex: 2 },
  center: { opacity: 1, zIndex: 2, transition: { duration: 0.18 } },
  exit: { opacity: 0, zIndex: 1, transition: { duration: 0.12 } },
};

const SCREEN_LABEL: Record<Route, string> = Object.fromEntries(NAV_ITEMS.map((n) => [n.route, `${n.label}画面`])) as Record<Route, string>;

function ScreenStage({ entranceDelay }: { entranceDelay: number }) {
  const { route, irisOrigin } = useApp();
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  // 押したボタンの位置から開く（ステージ内の座標に変換）
  // 新しい画面の最初の描画に間に合うよう、描画中に計算する
  const origin = useMemo<Point>(() => {
    const el = stageRef.current;
    const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const o = irisOrigin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return { x: Math.round(o.x - r.left), y: Math.round(o.y - r.top) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, irisOrigin]);

  return (
    <div className="stage" ref={stageRef}>
      <p className="sr-only" aria-live="polite">
        {SCREEN_LABEL[route]}
      </p>
      <AnimatePresence initial={false} custom={origin}>
        <motion.main
          key={route}
          className="screen"
          data-theme={ROUTE_THEME[route]}
          custom={origin}
          variants={reduce ? fadeVariants : irisVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <ScreenFor route={route} entranceDelay={entranceDelay} />
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

function ScreenFor({ route, entranceDelay }: { route: Route; entranceDelay: number }): ReactNode {
  switch (route) {
    case 'hall':
      return <GrandHall entranceDelay={entranceDelay} />;
    case 'orrery':
      return <Orrery />;
    case 'equation':
      return <Equation />;
    case 'chronicle':
      return <Chronicle />;
  }
}
