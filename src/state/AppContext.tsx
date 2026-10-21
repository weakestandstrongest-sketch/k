/**
 * 画面遷移と「いまどの日付を見ているか」の状態
 * URL のハッシュ（#/calendar など）と同期するので、ブラウザの「戻る」も使えます。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EventDraft } from '../data/types';
import { compareDateKeys, todayKey, type DateKey } from '../lib/date';

export type Route = 'hall' | 'orrery' | 'equation' | 'chronicle';
export type CalendarView = 'day' | 'week' | 'month';

export type ChamberState =
  | { mode: 'view'; id: string; layoutKey?: string }
  | { mode: 'edit'; id: string; scope?: 'this' | 'all' }
  | { mode: 'new'; draft: EventDraft };

export interface Point {
  x: number;
  y: number;
}

const ROUTE_HASH: Record<Route, string> = {
  hall: '#/',
  orrery: '#/calendar',
  equation: '#/plan',
  chronicle: '#/review',
};

function routeFromHash(hash: string): Route {
  const found = (Object.entries(ROUTE_HASH) as [Route, string][]).find(([, h]) => h === hash);
  return found ? found[0] : 'hall';
}

const VIEW_KEY = 'chronos:view';
function readStoredView(): CalendarView {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'day' || v === 'week' || v === 'month') return v;
  } catch {
    /* 保存領域が使えない環境 */
  }
  return 'day';
}

interface AppApi {
  route: Route;
  /** 画面転換（絞り）の起点 */
  irisOrigin: Point | null;
  navigate: (route: Route, origin?: Point | null) => void;
  focusDate: DateKey;
  /** 直前の日付移動の向き（+1 未来へ / -1 過去へ） */
  dateDirection: 1 | -1;
  setFocusDate: (date: DateKey) => void;
  calView: CalendarView;
  setCalView: (v: CalendarView) => void;
  chamber: ChamberState | null;
  openChamber: (state: ChamberState) => void;
  closeChamber: () => void;
  reviewDate: DateKey | null;
  setReviewDate: (d: DateKey | null) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const AppContext = createContext<AppApi | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const [irisOrigin, setIrisOrigin] = useState<Point | null>(null);
  const [focusDate, setFocusDateState] = useState<DateKey>(() => todayKey());
  const [dateDirection, setDateDirection] = useState<1 | -1>(1);
  const [calView, setCalViewState] = useState<CalendarView>(readStoredView);
  const [chamber, setChamber] = useState<ChamberState | null>(null);
  const [reviewDate, setReviewDate] = useState<DateKey | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const focusRef = useRef(focusDate);

  useEffect(() => {
    const onHash = () => {
      setIrisOrigin(null);
      setRoute(routeFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Route, origin: Point | null = null) => {
    setIrisOrigin(origin);
    setRoute(next);
    const hash = ROUTE_HASH[next];
    if (window.location.hash !== hash) {
      // replaceState ではなく履歴に積むことで「戻る」で前の画面へ
      window.history.pushState(null, '', hash);
    }
  }, []);

  const setFocusDate = useCallback((date: DateKey) => {
    const cmp = compareDateKeys(date, focusRef.current);
    if (cmp !== 0) setDateDirection(cmp > 0 ? 1 : -1);
    focusRef.current = date;
    setFocusDateState(date);
  }, []);

  const setCalView = useCallback((v: CalendarView) => {
    setCalViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* 無視（表示の好みだけなので） */
    }
  }, []);

  const openChamber = useCallback((s: ChamberState) => setChamber(s), []);
  const closeChamber = useCallback(() => setChamber(null), []);

  const api = useMemo<AppApi>(
    () => ({
      route,
      irisOrigin,
      navigate,
      focusDate,
      dateDirection,
      setFocusDate,
      calView,
      setCalView,
      chamber,
      openChamber,
      closeChamber,
      reviewDate,
      setReviewDate,
      settingsOpen,
      setSettingsOpen,
    }),
    [route, irisOrigin, navigate, focusDate, dateDirection, setFocusDate, calView, setCalView, chamber, openChamber, closeChamber, reviewDate, settingsOpen],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppProvider の内側で使ってください');
  return ctx;
}

