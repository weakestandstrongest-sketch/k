/**
 * 予定の詳細（閲覧）
 * 情報は「題名 → 時刻 → 場所・余白 → 準備 → 記録 → 履歴」の順に現れます。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { categoryOf } from '../data/categories';
import { draftFromEvent, STATUS_LABEL } from '../data/eventModel';
import type { CalendarEvent, EventStatus } from '../data/types';
import { formatDateJa, formatDuration, formatMinutes, relativeDayLabel, todayKey } from '../lib/date';
import { conflictsFor } from '../lib/schedule';
import { tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useEvents } from '../state/EventsContext';
import { useToast } from '../state/ToastContext';
import { Icon } from './Icon';

interface Props {
  event: CalendarEvent;
  titleId: string;
  onOpenOther: (id: string) => void;
}

export function ChamberView({ event: e, titleId, onOpenOther }: Props) {
  const reduce = useReducedMotion();
  const { update, events, saving } = useEvents();
  const { push } = useToast();
  const cat = categoryOf(e.category);
  const item = reduce ? tickItemReduced : tickItem;
  const conflicts = conflictsFor(e, events);
  const [actual, setActual] = useState(e.actualMinutes == null ? '' : String(e.actualMinutes));
  const [showHistory, setShowHistory] = useState(false);
  const rel = relativeDayLabel(e.date, todayKey());
  const total = e.bufferBeforeMin + (e.endMin - e.startMin) + e.bufferAfterMin;

  const setStatus = async (status: EventStatus) => {
    if (status === e.status) return;
    const next = await update(e.id, { ...draftFromEvent(e), status });
    if (next) push({ kind: 'success', message: status === 'planned' ? '記録を取り消しました。' : `「${e.title}」を${STATUS_LABEL[status]}と記録しました。` });
  };

  const saveActual = async () => {
    const trimmed = actual.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value != null && (!Number.isInteger(value) || value < 0 || value > 1440)) {
      push({ kind: 'error', message: '実際の所要時間は0〜1440の整数（分）で入力してください。' });
      return;
    }
    if (value === e.actualMinutes) return;
    const next = await update(e.id, { ...draftFromEvent(e), actualMinutes: value });
    if (next) push({ kind: 'success', message: value == null ? '実績時間を消去しました。' : `実績時間を${formatDuration(value)}と記録しました。` });
  };

  const toggleTask = async (taskId: string) => {
    await update(e.id, { ...draftFromEvent(e), prepTasks: e.prepTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) });
  };

  return (
    <motion.div className="cview" variants={tickContainer(0.06, 0.32)} initial="hidden" animate="show">
      <motion.div className="cview__seal" variants={item} style={{ ['--cat' as string]: cat.color }}>
        <span className="cview__seal-dot" aria-hidden="true" />
        <span>{cat.label}</span>
        <span className="cview__enamel" aria-hidden="true">
          {cat.enamel}
        </span>
        {e.fixed && (
          <span className="chip">
            <Icon name="lock" size={12} />
            固定
          </span>
        )}
        {e.isSample && <span className="chip chip--sample">見本</span>}
        <span className={`chip cview__status cview__status--${e.status}`}>{STATUS_LABEL[e.status]}</span>
      </motion.div>

      <motion.h2 className="cview__title" id={titleId} variants={item}>
        {e.title}
      </motion.h2>

      <motion.div className="cview__time" variants={item}>
        <p className="cview__date">
          {formatDateJa(e.date, { year: true })}
          {rel && <span className="cview__rel">{rel}</span>}
        </p>
        <p className="cview__range num">
          <span>{formatMinutes(e.startMin)}</span>
          <span className="cview__dash" aria-hidden="true" />
          <span>{formatMinutes(e.endMin)}</span>
        </p>
        <p className="cview__dur">{formatDuration(e.endMin - e.startMin)}</p>
        {(e.bufferBeforeMin > 0 || e.bufferAfterMin > 0) && (
          <div className="cview__buffer" aria-label={`前の余白${e.bufferBeforeMin}分、後の余白${e.bufferAfterMin}分`}>
            <div className="cview__buffer-bar" aria-hidden="true">
              <span className="is-buffer" style={{ flexGrow: e.bufferBeforeMin }} />
              <span className="is-core" style={{ flexGrow: e.endMin - e.startMin, ['--cat' as string]: cat.color }} />
              <span className="is-buffer" style={{ flexGrow: e.bufferAfterMin }} />
            </div>
            <p className="cview__buffer-text">
              {e.bufferBeforeMin > 0 && <span>前 {e.bufferBeforeMin}分（{formatMinutes(e.startMin - e.bufferBeforeMin)}〜）</span>}
              {e.bufferAfterMin > 0 && <span>後 {e.bufferAfterMin}分（〜{formatMinutes(Math.min(1440, e.endMin + e.bufferAfterMin))}）</span>}
              <span>合計 {formatDuration(total)}</span>
            </p>
          </div>
        )}
      </motion.div>

      {conflicts.length > 0 && (
        <motion.div className="cview__conflicts" variants={item} role="note">
          <p className="cview__label">
            <Icon name="warn" size={14} /> 重なっている予定
          </p>
          <ul>
            {conflicts.map(({ event: o, kind }) => (
              <li key={o.id}>
                <button type="button" className="cview__link" onClick={() => onOpenOther(o.id)}>
                  {formatMinutes(o.startMin)}〜{formatMinutes(o.endMin)}「{o.title}」
                </button>
                <span className={`chip ${kind === 'overlap' ? 'chip--danger' : 'chip--warn'}`}>{kind === 'overlap' ? '時間が重複' : '余白が重複'}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {(e.location || e.notes) && (
        <motion.div className="cview__grid" variants={item}>
          {e.location && (
            <div>
              <p className="cview__label">場所</p>
              <p className="cview__value">
                <Icon name="pin" size={14} /> {e.location}
              </p>
            </div>
          )}
          {e.notes && (
            <div className="cview__notes">
              <p className="cview__label">メモ</p>
              <p className="cview__value cview__pre">{e.notes}</p>
            </div>
          )}
        </motion.div>
      )}

      {e.prepTasks.length > 0 && (
        <motion.div variants={item}>
          <p className="cview__label">
            準備すること（{e.prepTasks.filter((t) => t.done).length}/{e.prepTasks.length}）
          </p>
          <ul className="cview__tasks">
            {e.prepTasks.map((t) => (
              <li key={t.id}>
                <label className="check">
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} disabled={saving} />
                  <span className={t.done ? 'is-done' : ''}>{t.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div className="cview__record" variants={item}>
        <p className="cview__label">実施の記録</p>
        <div className="cview__status-seg" role="radiogroup" aria-label="実施の記録">
          {(['planned', 'completed', 'missed'] as EventStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={e.status === s} className={e.status === s ? 'is-on' : ''} onClick={() => setStatus(s)} disabled={saving}>
              {s === 'completed' && <Icon name="check" size={14} />}
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="cview__actual">
          <label className="field">
            <span className="field__label">実際にかかった時間（分・任意）</span>
            <input
              className="field__control"
              inputMode="numeric"
              value={actual}
              onChange={(ev) => setActual(ev.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(ev) => ev.key === 'Enter' && saveActual()}
              placeholder={`予定は${e.endMin - e.startMin}分`}
            />
          </label>
          <button type="button" className="btn btn--small" onClick={saveActual} disabled={saving || actual === (e.actualMinutes == null ? '' : String(e.actualMinutes))}>
            記録
          </button>
        </div>
        <p className="field__hint">記録は「振り返り」の集計に使われます。入力がない場合、実績は空欄のままです。</p>
      </motion.div>

      <motion.div className="cview__history" variants={item}>
        <button type="button" className="cview__history-toggle" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
          変更の記録（{e.history.length}）
          <Icon name={showHistory ? 'prev' : 'next'} size={14} className="cview__history-icon" />
        </button>
        {showHistory && (
          <ol className="cview__history-list">
            {[...e.history].reverse().map((h, i) => (
              <li key={i}>
                <time dateTime={h.at}>{new Date(h.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                <span>{h.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </motion.div>
    </motion.div>
  );
}
