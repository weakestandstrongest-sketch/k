/** 設定：週の始まり・活動時間帯・見本データ・全データの消去・起動演出 */
import { useEffect, useState } from 'react';
import type { Settings } from '../data/types';
import { formatMinutes, parseTime } from '../lib/date';
import { useApp } from '../state/AppContext';
import { useConfirm } from '../state/ConfirmContext';
import { useEvents } from '../state/EventsContext';
import { useToast } from '../state/ToastContext';
import { Dialog } from './Dialog';
import './SettingsDialog.css';

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useApp();
  return (
    <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} title="設定" kicker="ATELIER SETTINGS" width={620}>
      <SettingsBody onClose={() => setSettingsOpen(false)} />
    </Dialog>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, hasSamples, clearSamples, loadSamples, clearAll, events, memoryOnly } = useEvents();
  const confirm = useConfirm();
  const { push } = useToast();
  const [start, setStart] = useState(formatMinutes(settings.dayStartMin));
  const [end, setEnd] = useState(formatMinutes(settings.dayEndMin));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStart(formatMinutes(settings.dayStartMin));
    setEnd(formatMinutes(settings.dayEndMin));
  }, [settings.dayStartMin, settings.dayEndMin]);

  const save = async (next: Settings) => {
    if (await updateSettings(next)) push({ kind: 'success', message: '設定を保存しました。' });
  };

  const saveWindow = async () => {
    const s = parseTime(start);
    let e = parseTime(end);
    if (e === 0) e = 1440;
    if (s == null || e == null) return setError('時刻を正しく入力してください。');
    if (e <= s) return setError('終わりの時刻は始まりより後にしてください。');
    if (e - s < 60) return setError('活動時間帯は1時間以上にしてください。');
    setError(null);
    await save({ ...settings, dayStartMin: s, dayEndMin: e });
  };

  const userCount = events.filter((e) => !e.isSample).length;

  return (
    <div className="settings">
      <section className="settings__group">
        <h3 className="settings__title">週の始まり</h3>
        <div className="settings__seg" role="radiogroup" aria-label="週の始まり">
          {([0, 1] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={settings.weekStartsOn === v}
              className={`settings__seg-btn ${settings.weekStartsOn === v ? 'is-on' : ''}`}
              onClick={() => save({ ...settings, weekStartsOn: v })}
            >
              {v === 0 ? '日曜日' : '月曜日'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__group">
        <h3 className="settings__title">活動時間帯</h3>
        <p className="settings__desc">空き時間の計算と、予定の再編成で使う時間帯です。</p>
        <div className="settings__row">
          <label className="field">
            <span className="field__label">始まり</span>
            <input className="field__control" type="time" value={start} step={900} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">終わり（0:00 は深夜0時）</span>
            <input className="field__control" type="time" value={end === '24:00' ? '00:00' : end} step={900} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button type="button" className="btn" onClick={saveWindow}>
            保存
          </button>
        </div>
        {error && <p className="field__error">{error}</p>}
      </section>

      <section className="settings__group">
        <h3 className="settings__title">見本データ</h3>
        <p className="settings__desc">
          {hasSamples ? '見本の予定が入っています。' : '見本の予定は入っていません。'} あなたが作成した予定（{userCount}件）は、見本の操作では変わりません。
        </p>
        <div className="settings__actions">
          {hasSamples && (
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const ok = await confirm({ title: '見本の予定を消去しますか？', message: '「見本」と表示された予定をすべて削除します。', confirmLabel: '消去する', danger: true });
                if (ok && (await clearSamples())) push({ kind: 'success', message: '見本の予定を消去しました。' });
              }}
            >
              見本を消去
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={async () => {
              if (await loadSamples()) push({ kind: 'success', message: '見本の予定を読み込みました。' });
            }}
          >
            {hasSamples ? '見本を今日の日付で作り直す' : '見本を読み込む'}
          </button>
        </div>
      </section>

      <section className="settings__group">
        <h3 className="settings__title">すべてのデータ</h3>
        <p className="settings__desc">
          予定はこの端末のブラウザ内（IndexedDB）にだけ保存されます。{memoryOnly ? '現在は保存領域が使えないため、保存されていません。' : ''}
          ブラウザのデータを消去すると予定も消えます。
        </p>
        <button
          type="button"
          className="btn btn--danger"
          onClick={async () => {
            const ok = await confirm({
              title: 'すべての予定を消去しますか？',
              message: `見本を含むすべての予定（${events.length}件）を削除します。この操作は取り消せません。`,
              confirmLabel: 'すべて消去する',
              danger: true,
            });
            if (ok && (await clearAll())) {
              push({ kind: 'success', message: 'すべての予定を消去しました。' });
              onClose();
            }
          }}
        >
          すべての予定を消去
        </button>
      </section>

      <section className="settings__group">
        <h3 className="settings__title">起動時の演出</h3>
        <p className="settings__desc">起動時の演出は、ブラウザのタブ（セッション）ごとに一度だけ再生されます。</p>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            try {
              sessionStorage.removeItem('chronos:intro-played');
            } catch {
              /* 無視 */
            }
            window.location.reload();
          }}
        >
          もう一度再生する（再読み込み）
        </button>
      </section>

      <section className="settings__group settings__about">
        <h3 className="settings__title">この版でできないこと</h3>
        <ul>
          <li>通知・アラーム（バックグラウンドでの通知は行いません）</li>
          <li>iPhone の「カレンダー」や他サービスとの同期</li>
          <li>終日の予定・日をまたぐ予定・繰り返しの予定</li>
          <li>祝日の表示</li>
          <li>移動時間の自動予測（余白は手入力です）</li>
        </ul>
      </section>
    </div>
  );
}
