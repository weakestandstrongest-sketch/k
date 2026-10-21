import type { Appearance } from '../data/types';
import { useEvents } from './EventsContext';
import { useMediaQuery } from './useMediaQuery';

export type Tone = 'light' | 'dark';

/** 起動直後のちらつきを防ぐため、選んだ明暗を端末にも覚えておく */
export const APPEARANCE_KEY = 'chronos:appearance';

export function rememberAppearance(a: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, a);
  } catch {
    /* 保存できなくても動作に影響なし */
  }
}

/** 設定（白／黒／端末に合わせる）から、いま使う明暗を決める */
export function useTone(): Tone {
  const { settings, status } = useEvents();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  // 設定を読み込むまでは、前回端末に覚えた明暗を使う
  const appearance = status === 'loading' ? storedAppearance() : settings.appearance;
  if (appearance === 'system') return prefersDark ? 'dark' : 'light';
  return appearance;
}

function storedAppearance(): Appearance {
  try {
    const v = localStorage.getItem(APPEARANCE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* 読めなければ既定値 */
  }
  return 'light';
}
