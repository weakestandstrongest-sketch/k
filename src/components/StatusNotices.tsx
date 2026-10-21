/**
 * 保存領域・接続状態・PWA の状態のお知らせ
 * - IndexedDB が使えないとき：保存されないことを常に表示
 * - オフライン：端末内のデータで動作中であることを表示
 */
import { useEffect, useState } from 'react';
import type { PwaEvent } from '../pwa';
import { useEvents } from '../state/EventsContext';
import { useToast } from '../state/ToastContext';
import { Icon } from './Icon';
import './StatusNotices.css';

export function StatusNotices() {
  const { memoryOnly, storageProblem, retry } = useEvents();
  const { push } = useToast();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      push({ kind: 'info', message: 'インターネットに再接続しました。' });
    };
    const off = () => {
      setOnline(false);
      push({ kind: 'info', message: 'オフラインになりました。予定の閲覧・編集は端末内でそのまま続けられます。' });
    };
    const pwa = (e: Event) => {
      const detail = (e as CustomEvent<PwaEvent>).detail;
      if (detail.type === 'offline-ready') push({ kind: 'success', message: 'オフラインでも使える準備が整いました。' });
      if (detail.type === 'updated') push({ kind: 'info', message: '新しい版に更新しました。次回の起動から反映されます。' });
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('chronos:pwa', pwa);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('chronos:pwa', pwa);
    };
  }, [push]);

  return (
    <div className="notices" aria-live="polite">
      {memoryOnly && (
        <div className="notice notice--danger" role="alert">
          <Icon name="warn" size={18} />
          <p>
            <strong>予定は保存されません。</strong>
            {storageProblem} 表示中の予定は見本で、ページを閉じると変更は失われます。
          </p>
          <button type="button" className="btn btn--small" onClick={retry}>
            再試行
          </button>
        </div>
      )}
      {!online && (
        <div className="notice notice--quiet">
          <span className="notice__dot" aria-hidden="true" />
          オフライン ― 端末内のデータで動作中
        </div>
      )}
    </div>
  );
}
