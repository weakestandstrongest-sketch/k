/**
 * 予定の作成・編集フォーム
 * - 入力チェック（日本語のエラー）
 * - 他の予定との重なりをその場で表示し、重なる場合は確認してから保存
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { CATEGORIES } from '../data/categories';
import { validateDraft, type DraftErrors } from '../data/eventModel';
import type { CalendarEvent, EventDraft } from '../data/types';
import { formatDuration, formatTimeRange, parseTime, toTimeInputValue } from '../lib/date';
import { createId } from '../lib/ids';
import { conflictsFor } from '../lib/schedule';
import { ease } from '../motion/tokens';
import { Icon } from './Icon';

interface Props {
  initial: EventDraft;
  eventId?: string;
  allEvents: CalendarEvent[];
  saving: boolean;
  submitLabel: string;
  onSubmit: (draft: EventDraft) => void;
  onCancel: (dirty: boolean) => void;
}

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const DURATION_PRESETS = [30, 60, 90, 120];

export function EventForm({ initial, eventId, allEvents, saving, submitLabel, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<EventDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [ack, setAck] = useState(false);
  const [newTask, setNewTask] = useState('');
  const uid = useId();
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => {
    setD((prev) => {
      const next = { ...prev, [key]: value };
      if (submitted) setErrors(validateDraft(next));
      return next;
    });
    setAck(false);
  };

  const conflicts = useMemo(() => {
    if (Object.keys(validateDraft({ ...d, title: d.title || 'x' })).length > 0) return [];
    return conflictsFor({ ...d, id: eventId ?? '__new__' }, allEvents);
  }, [d, eventId, allEvents]);
  const overlapList = conflicts.filter((c) => c.kind === 'overlap');

  const onStart = (value: string) => {
    const s = parseTime(value);
    if (s == null) return;
    // 開始を変えたら長さを保ったまま終了もずらす
    const dur = Math.max(5, d.endMin - d.startMin);
    setD((prev) => {
      const next = { ...prev, startMin: s, endMin: Math.min(1440, s + dur) };
      if (submitted) setErrors(validateDraft(next));
      return next;
    });
    setAck(false);
  };

  const onEnd = (value: string) => {
    const e = parseTime(value);
    if (e == null) return;
    // 00:00 は「その日の終わり（24:00）」として扱う
    set('endMin', e === 0 ? 1440 : e);
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    const errs = validateDraft(d);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(errs)[0]}"]`);
      first?.focus();
      return;
    }
    if (overlapList.length > 0 && !ack) {
      setAck(true);
      return;
    }
    onSubmit(d);
  };

  const addTask = () => {
    const label = newTask.trim();
    if (!label) return;
    set('prepTasks', [...d.prepTasks, { id: createId('pt'), label, done: false }]);
    setNewTask('');
  };

  const err = (key: keyof DraftErrors) =>
    errors[key] ? (
      <p className="field__error" id={`${uid}-${key}-err`} role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form className="evform" onSubmit={submit} noValidate>
      <label className={`field evform__title ${errors.title ? 'field--error' : ''}`}>
        <span className="field__label">タイトル（必須）</span>
        <input
          className="field__control"
          data-field="title"
          data-autofocus={initial.title === '' ? true : undefined}
          value={d.title}
          maxLength={160}
          onChange={(e) => set('title', e.target.value)}
          placeholder="例：企画会議"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? `${uid}-title-err` : undefined}
          enterKeyHint="next"
        />
        {err('title')}
      </label>

      <div className="evform__when">
        <label className={`field ${errors.date ? 'field--error' : ''}`}>
          <span className="field__label">日付</span>
          <input className="field__control" type="date" data-field="date" value={d.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} required />
          {err('date')}
        </label>
        <label className={`field ${errors.startMin ? 'field--error' : ''}`}>
          <span className="field__label">開始</span>
          <input
            className="field__control"
            type="time"
            step={300}
            data-field="startMin"
            value={toTimeInputValue(d.startMin)}
            onChange={(e) => onStart(e.target.value)}
            aria-invalid={!!errors.startMin}
            required
          />
          {err('startMin')}
        </label>
        <label className={`field ${errors.endMin ? 'field--error' : ''}`}>
          <span className="field__label">終了</span>
          <input
            className="field__control"
            type="time"
            step={300}
            data-field="endMin"
            value={toTimeInputValue(d.endMin)}
            onChange={(e) => onEnd(e.target.value)}
            aria-invalid={!!errors.endMin}
            aria-describedby={`${uid}-end-hint`}
            required
          />
          {err('endMin')}
        </label>
      </div>
      <div className="evform__presets">
        <span className="field__hint" id={`${uid}-end-hint`}>
          {d.endMin > d.startMin ? `長さ ${formatDuration(d.endMin - d.startMin)}` : ''}
          {d.endMin === 1440 ? '（終了 0:00 は深夜0時＝その日の終わり）' : ''}
        </span>
        <span className="evform__preset-list">
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className={`evform__preset ${d.endMin - d.startMin === m ? 'is-on' : ''}`}
              onClick={() => set('endMin', Math.min(1440, d.startMin + m))}
            >
              {formatDuration(m)}
            </button>
          ))}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {conflicts.length > 0 && (
          <motion.div
            className={`evform__conflict ${overlapList.length > 0 ? 'is-overlap' : ''}`}
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: ease.escapement }}
          >
            <div className="evform__conflict-inner">
              <Icon name="warn" size={18} />
              <div>
                <p className="evform__conflict-title">{overlapList.length > 0 ? 'この時間は他の予定と重なっています' : '移動・準備の余白が他の予定と重なっています'}</p>
                <ul>
                  {conflicts.map(({ event, kind }) => (
                    <li key={event.id}>
                      {formatTimeRange(event.startMin, event.endMin)}「{event.title}」{kind === 'buffer' ? '（余白のみ）' : ''}
                    </li>
                  ))}
                </ul>
                <p className="evform__conflict-note">他の予定は変更されません。調整は「時間設計」でも行えます。</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <fieldset className="evform__cats">
        <legend className="field__label">カテゴリー</legend>
        <div className="evform__cat-list">
          {CATEGORIES.map((c) => (
            <label key={c.id} className={`evform__cat ${d.category === c.id ? 'is-on' : ''}`} style={{ ['--cat' as string]: c.color }}>
              <input type="radio" name={`${uid}-cat`} value={c.id} checked={d.category === c.id} onChange={() => set('category', c.id)} />
              <span className="dot" aria-hidden="true" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span className="field__label">場所</span>
        <input className="field__control" value={d.location} maxLength={120} onChange={(e) => set('location', e.target.value)} placeholder="例：第二会議室" />
      </label>

      <div className={`evform__buffers ${errors.buffer ? 'field--error' : ''}`}>
        <label className="field">
          <span className="field__label">前の余白（移動・準備）</span>
          <select className="field__control" value={d.bufferBeforeMin} onChange={(e) => set('bufferBeforeMin', Number(e.target.value))}>
            {BUFFER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'なし' : `${m}分`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">後の余白（移動・片付け）</span>
          <select className="field__control" value={d.bufferAfterMin} onChange={(e) => set('bufferAfterMin', Number(e.target.value))}>
            {BUFFER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'なし' : `${m}分`}
              </option>
            ))}
          </select>
        </label>
        {err('buffer')}
        <p className="field__hint evform__buffers-hint">余白は自分で見積もった時間です。移動時間を自動で予測することはしません。</p>
      </div>

      <div className="field">
        <span className="field__label">準備すること</span>
        <ul className="evform__tasks">
          {d.prepTasks.map((t, i) => (
            <li key={t.id}>
              <input
                className="field__control"
                value={t.label}
                aria-label={`準備 ${i + 1}`}
                onChange={(e) => set('prepTasks', d.prepTasks.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))}
              />
              <button type="button" className="btn btn--icon btn--ghost" aria-label={`「${t.label}」を削除`} onClick={() => set('prepTasks', d.prepTasks.filter((x) => x.id !== t.id))}>
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="evform__task-add">
          <input
            className="field__control"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                addTask();
              }
            }}
            placeholder="例：資料を印刷する"
            aria-label="準備することを追加"
          />
          <button type="button" className="btn btn--small" onClick={addTask} disabled={!newTask.trim()}>
            追加
          </button>
        </div>
      </div>

      <label className="field">
        <span className="field__label">メモ</span>
        <textarea className="field__control" value={d.notes} maxLength={4000} onChange={(e) => set('notes', e.target.value)} />
      </label>

      <label className="check">
        <input type="checkbox" checked={d.fixed} onChange={(e) => set('fixed', e.target.checked)} />
        <span>
          時刻を固定する
          <span className="field__hint evform__inline-hint">「時間設計」の提案でこの予定を動かしません</span>
        </span>
      </label>

      <div className="evform__actions">
        <button type="button" className="btn btn--ghost" onClick={() => onCancel(dirty)}>
          キャンセル
        </button>
        <button type="submit" className={`btn ${ack ? 'btn--danger' : 'btn--primary'}`} disabled={saving}>
          {saving ? '保存中…' : ack ? '重なりを承知で保存' : submitLabel}
        </button>
      </div>
      {ack && <p className="evform__ack">もう一度押すと、重なったまま保存します。重なっている予定は変更されません。</p>}
    </form>
  );
}
