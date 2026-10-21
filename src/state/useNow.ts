import { useEffect, useState } from 'react';

/**
 * 現在時刻を返すフック。指定した間隔（ミリ秒）の区切りに合わせて更新します。
 * 例: useNow(1000) は毎秒、useNow(60_000) は毎分 0 秒に更新。
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      const delay = intervalMs - (Date.now() % intervalMs) + 5;
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };
    schedule();
    // スリープ復帰・タブ復帰時にすぐ更新
    const onVisible = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}
