/**
 * 予定の詳細（閲覧）
 * 情報は「題名 → 時刻 → 場所・余白 → 準備 → 記録 → 履歴」の順に現れます。
 */
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { categoryOf } from '../data/categories';
import { describeRepeat, draftFromEvent, spanMinutes, STATUS_LABEL } from '../data/eventModel';
import type { CalendarEvent, EventStatus } from '../data/types';
import { addDays, diffDays, formatDateJa, formatDuration, formatMinutes, relativeDayLabel, todayKey } from '../lib/date';
import { holidayName } from '../lib/holidays';
import { timedOn, type EventInstance } from '../lib/recurrence';
import { conflictsFor } from '../lib/schedule';
import { tickContainer, tickItem, tickItemReduced } from '../motion/tokens';
import { useEvents } from '../state/EventsContext';
import { useToast } from '../state/ToastContext';
import { Icon } from './Icon';

interface Props {
  /** 表示している回（日ごとのインスタンス） */
  event: EventInstance;
  /** 保存されている元の予定 */
  base: CalendarEvent;
  titleId: string;
  onOpenOther: (id: string) => void;
}

export function ChamberView({ event: e, base, titleId, onOpenOther }: Props) {
  const reduce = useReducedMotion();
  const { update, record, events, saving } = useEvents();
  const { push } = useToast();
  const cat = categoryOf(e.category);
  const item = reduce ? tickItemReduced : tickItem;
  const conflicts = e.allDay ? [] : conflictsFor(e, timedOn(events, e.date));
  const [actual, setActual] = useState(e.actualMinutes == null ? '' : String(e.actualMinutes));
  const [showHistory, setShowHistory] = useState(false);
  // この回の全体（日をまたぐ場合は開始日〜終了日）
  const start = e.occurrence;
  const end = addDays(start, diffDays(base.date, base.endDate));
  const multi = end !== start;
  const rel = relativeDayLabel(start, todayKey());
  const holiday = holidayName(start);
  const planned = base.allDay ? 0 : spanMinutes(base);
  const total = base.bufferBeforeMin + planned + base.bufferAfterMin;

  const setStatus = async (status: EventStatus) => {
    if (status === e.status) return;
    const ok = await record([{ instance: e, status, actualMinutes: e.actualMinutes }]);
    if (ok) push({ kind: 'success', message: status === 'planned' ? '記録を取り消しました。' : `「${e.title}」を${STATUS_LABEL[status]}と記録しました。` });
  };

  const saveActual = async () => {
    const trimmed = actual.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value != null && (!Number.isInteger(value) || value < 0 || value > 1440)) {
      push({ kind: 'error', message: '実際の所要時間は0〜1440の整数（分）で入力してください。' });
      return;
    }
    if (value === e.actualMinutes) return;
    const ok = await record([{ instance: e, status: e.status, actualMinutes: value }]);
    if (ok) push({ kind: 'success', message: value == null ? '実績時間を消去しました。' : `実績時間を${formatDuration(value)}と記録しました。` });
  };

  const toggleTask = async (taskId: string) => {
    await update(base.id, { ...draftFromEvent(base), prepTasks: base.prepTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) });
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
          {formatDateJa(start, { year: true })}
          {multi && <> 〜 {formatDateJa(end, { year: end.slice(0, 4) !== start.slice(0, 4) })}</>}
          {rel && <span className="cview__rel">{rel}</span>}
          {holiday && <span className="cview__holiday">{holiday}</span>}
        </p>
        {base.allDay ? (
          <p className="cview__range">{multi ? `終日・${diffDays(start, end) + 1}日間` : '終日'}</p>
        ) : (
          <p className="cview__range num">
            <span>{formatMinutes(base.startMin)}</span>
            <span className="cview__dash" aria-hidden="true" />
            <span>
              {multi && <small className="cview__next-day">{formatDateJa(end, { weekday: false })}</small>}
              {formatMinutes(base.endMin)}
            </span>
          </p>
        )}
        {!base.allDay && <p className="cview__dur">{formatDuration(planned)}</p>}
        {base.repeat && (
          <p className="cview__repeat">
            <Icon name="repeat" size={14} /> {describeRepeat(base.repeat, base.date)}
          </p>
        )}
        {!base.allDay && (base.bufferBeforeMin > 0 || base.bufferAfterMin > 0) && (
          <div className="cview__buffer" aria-label={`前の余白${base.bufferBeforeMin}分、後の余白${base.bufferAfterMin}分`}>
            <div className="cview__buffer-bar" aria-hidden="true">
              <span className="is-buffer" style={{ flexGrow: base.bufferBeforeMin }} />
              <span className="is-core" style={{ flexGrow: planned, ['--cat' as string]: cat.color }} />
              <span className="is-buffer" style={{ flexGrow: base.bufferAfterMin }} />
            </div>
            <p className="cview__buffer-text">
              {base.bufferBeforeMin > 0 && <span>前 {base.bufferBeforeMin}分（{formatMinutes(base.startMin - base.bufferBeforeMin)}〜）</span>}
              {base.bufferAfterMin > 0 && <span>後 {base.bufferAfterMin}分（〜{formatMinutes(Math.min(1440, base.endMin + base.bufferAfterMin))}）</span>}
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
        <p className="cview__label">実施の記録{e.recurring ? `（${formatDateJa(e.occurrence, { weekday: false })}の回）` : ''}</p>
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
              placeholder={base.allDay ? '例：120' : `予定は${planned}分`}
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
          変更の記録（{base.history.length}）
          <Icon name={showHistory ? 'prev' : 'next'} size={14} className="cview__history-icon" />
        </button>
        {showHistory && (
          <ol className="cview__history-list">
            {[...base.history].reverse().map((h, i) => (
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
