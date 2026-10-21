/**
 * CHRONOS を開いているときに、ひび手帳を全画面で重ねて開く。
 * ひび手帳は開くときに両方の予定を合わせ、ひび手帳の「CHRONOS」ボタンで戻るときにもう一度合わせてから知らせてきます。
 * そのあと、CHRONOS は保存された予定を読み直します。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { hibiUrl, IN_HIBI } from '../lib/hibi';
import { useEvents } from '../state/EventsContext';
import { HibiIcon } from './HibiButton';
import './HibiSwitch.css';

export function HibiSwitch() {
  const { reload } = useEvents();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);
  const [bg, setBg] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (IN_HIBI) return;
    const onOpen = () => {
      setReady(false);
      setOpen(true);
      requestAnimationFrame(() => setShown(true));
    };
    window.addEventListener('chronos:open-hibi', onOpen);
    return () => window.removeEventListener('chronos:open-hibi', onOpen);
  }, []);

  const close = useCallback(() => {
    setShown(false);
    void reload();
    window.setTimeout(() => setOpen(false), 380);
  }, [reload]);

  useEffect(() => {
    if (!open) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { type?: string } | null)?.type === 'hibi:to-chronos') close();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, close]);

  // 枠の上下（ステータスバーやホームバーの場所）を、ひび手帳の背景の色にそろえる
  useEffect(() => {
    if (!open || !ready) return;
    const tint = () => {
      try {
        const doc = frame.current?.contentDocument;
        if (doc?.body) setBg(getComputedStyle(doc.body).backgroundColor);
      } catch {
        /* 読めなくても表示はできる */
      }
    };
    tint();
    const id = window.setInterval(tint, 600);
    return () => window.clearInterval(id);
  }, [open, ready]);

  if (!open) return null;
  return (
    <div className={`hibi-ov ${shown ? 'is-in' : ''} ${ready ? 'is-ready' : ''}`} style={bg ? { background: bg } : undefined} role="dialog" aria-label="ひび手帳">
      <div className="hibi-ov__load" aria-hidden={ready}>
        <HibiIcon size={64} />
        <p>ひび手帳に切り替えています…</p>
      </div>
      <iframe ref={frame} className="hibi-ov__frame" src={`${hibiUrl()}?from=chronos`} title="ひび手帳" onLoad={() => setReady(true)} />
    </div>
  );
}
