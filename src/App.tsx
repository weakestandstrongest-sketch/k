/**
 * アプリの骨組み
 * Provider（状態）→ Shell（ナビゲーション・画面・重ねて表示するパネル）
 */
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Chamber } from './components/Chamber';
import { DailyReview } from './components/DailyReview';
import { Navigation, NAV_ITEMS } from './components/Navigation';
import { OpeningSequence } from './components/OpeningSequence';
import { StatusNotices } from './components/StatusNotices';
import { Toasts } from './components/Toasts';
import { emptyDraft } from './data/eventModel';
import { minutesOfDay, todayKey } from './lib/date';
import { snapMinutes } from './lib/schedule';
import { ease } from './motion/tokens';
import { Chronicle } from './screens/Chronicle';
import { Settings } from './screens/Settings';
import { GrandHall } from './screens/GrandHall';
import { Orrery } from './screens/Orrery';
import { AppProvider, useApp, type Point, type Route } from './state/AppContext';
import { rememberAppearance, useTone } from './state/useTone';
import { ConfirmProvider } from './state/ConfirmContext';
import { EventsProvider, useEvents } from './state/EventsContext';
import { MoveProvider } from './state/MoveContext';
import { instancesOn } from './lib/recurrence';
import { ToastProvider } from './state/ToastContext';

const INTRO_KEY = 'chronos:intro-played';

const THEME_COLOR: Record<string, string> = {
  light: '#eef0f3',
  dark: '#0d0d10',
  night: '#050507',
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
  const { events, status, settings } = useEvents();
  const tone = useTone();
  const [intro, setIntro] = useState<IntroState>(() => (readIntroPlayed() || reduce ? 'done' : 'playing'));

  // 画面・状況に合わせてページ全体のテーマ（ナビゲーションの色など）を切り替える
  const rootTheme = reviewDate ? 'night' : tone;
  useEffect(() => {
    document.documentElement.dataset.theme = rootTheme;
    document.documentElement.dataset.screen = route;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[rootTheme] ?? '#eef0f3');
  }, [rootTheme, route]);
  useEffect(() => {
    if (status !== 'loading') rememberAppearance(settings.appearance);
  }, [status, settings.appearance]);

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
      const date = route === 'orrery' ? focusDate : today;
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

  const todayCount = status === 'loading' ? null : instancesOn(events, todayKey()).length;
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

// ---------- 画面の転換（押した場所から波紋のように広がる） ----------

type Origin = Point & { r: number };

const irisVariants: Variants = {
  enter: (o: Origin) => ({ clipPath: `circle(0px at ${o.x}px ${o.y}px)`, zIndex: 2 }),
  center: (o: Origin) => ({
    clipPath: `circle(${o.r}px at ${o.x}px ${o.y}px)`,
    zIndex: 2,
    scale: 1,
    opacity: 1,
    transition: { duration: 0.66, ease: ease.regal },
    transitionEnd: { clipPath: 'none' },
  }),
  exit: { zIndex: 1, scale: 0.97, opacity: 0.4, transition: { duration: 0.66, ease: ease.regal } },
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
  const tone = useTone();
  const stageRef = useRef<HTMLDivElement>(null);
  // 最初の表示では波紋を出さず、画面を移ったときだけ出す
  const [lastRoute, setLastRoute] = useState(route);
  const [moved, setMoved] = useState(false);
  if (route !== lastRoute) {
    setLastRoute(route);
    setMoved(true);
  }
  // 押したボタンの位置から開く（ステージ内の座標に変換）
  // 新しい画面の最初の描画に間に合うよう、描画中に計算する
  const origin = useMemo<Origin>(() => {
    const el = stageRef.current;
    const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const o = irisOrigin ?? { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const x = Math.round(o.x - r.left);
    const y = Math.round(o.y - r.top);
    // いちばん遠い角までの距離（波紋がちょうど画面を覆う半径）
    const radius = Math.ceil(Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))) + 8;
    return { x, y, r: radius };
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
          data-theme={tone}
          data-screen={route}
          custom={origin}
          variants={reduce ? fadeVariants : irisVariants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          <ScreenFor route={route} entranceDelay={entranceDelay} />
        </motion.main>
      </AnimatePresence>
      {/* 波紋の輪：画面が開くのに合わせて、細い線が外へ広がって消える */}
      {!reduce && moved && (
        <div className="ripple" key={`ripple-${route}`} aria-hidden="true" style={{ left: origin.x, top: origin.y }}>
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              className={`ripple__ring ripple__ring--${i}`}
              style={{ width: origin.r * 2, height: origin.r * 2 }}
              initial={{ scale: 0, opacity: i === 0 ? 0.9 : 0.5 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 0.9 + i * 0.25, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenFor({ route, entranceDelay }: { route: Route; entranceDelay: number }): ReactNode {
  switch (route) {
    case 'hall':
      return <GrandHall entranceDelay={entranceDelay} />;
    case 'orrery':
      return <Orrery />;
    case 'settings':
      return <Settings />;
    case 'chronicle':
      return <Chronicle />;
  }
}
