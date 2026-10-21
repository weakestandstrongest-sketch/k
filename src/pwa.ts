/**
 * PWA（ホーム画面に追加・オフライン対応）の登録
 * 状態の変化は 'chronos:pwa' イベントで画面に知らせます。
 */
import { registerSW } from 'virtual:pwa-register';

export type PwaEvent = { type: 'offline-ready' } | { type: 'updated' } | { type: 'error' };

function emit(detail: PwaEvent) {
  window.dispatchEvent(new CustomEvent<PwaEvent>('chronos:pwa', { detail }));
}

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  // 開発中（npm run dev）は登録しない
  if (import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onOfflineReady: () => emit({ type: 'offline-ready' }),
    onNeedRefresh: () => emit({ type: 'updated' }),
    onRegisterError: () => emit({ type: 'error' }),
  });
}
