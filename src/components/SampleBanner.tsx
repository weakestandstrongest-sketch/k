/** 見本データを表示中であることを知らせ、消去・保持を選べるようにする */
import { useState } from 'react';
import { useConfirm } from '../state/ConfirmContext';
import { useEvents } from '../state/EventsContext';
import { useToast } from '../state/ToastContext';
import './SampleBanner.css';

const HIDE_KEY = 'chronos:sample-banner-hidden';

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function SampleBanner() {
  const { hasSamples, clearSamples } = useEvents();
  const confirm = useConfirm();
  const { push } = useToast();
  const [hidden, setHidden] = useState(readHidden);
  if (!hasSamples || hidden) return null;

  const clear = async () => {
    const ok = await confirm({
      title: '見本の予定を消去しますか？',
      message: '「見本」と表示されている予定をすべて削除し、白紙のカレンダーから始めます。あなたが作成した予定は残ります。',
      confirmLabel: '見本を消去する',
      danger: true,
    });
    if (!ok) return;
    if (await clearSamples()) push({ kind: 'success', message: '見本の予定を消去しました。白紙のカレンダーから始められます。' });
  };

  const keep = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* 表示の好みだけなので無視 */
    }
  };

  return (
    <aside className="sample-banner" aria-label="見本データについて">
      <p className="sample-banner__text">
        <strong>見本の予定を表示しています。</strong>
        「見本」と記された予定は操作を試すためのもので、過去の完了記録も見本です。設定からいつでも消去できます。
      </p>
      <div className="sample-banner__actions">
        <button type="button" className="btn btn--small" onClick={clear}>
          見本を消去して白紙から始める
        </button>
        <button type="button" className="btn btn--small btn--ghost" onClick={keep}>
          このまま試す
        </button>
      </div>
    </aside>
  );
}
