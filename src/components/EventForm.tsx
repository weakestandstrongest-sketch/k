/**
 * 予定の作成・編集フォーム
 * - 入力チェック（日本語のエラー）
 * - 他の予定との重なりをその場で表示し、重なる場合は確認してから保存
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { CATEGORIES } from '../data/categories';
import { shiftKeepingSpan, spanMinutes, validateDraft, type DraftErrors } from '../data/eventModel';
import type { CalendarEvent, EventDraft, Repeat, RepeatFreq } from '../data/types';
import { addDays, compareDateKeys, formatDuration, formatTimeRange, isValidDateKey, parseTime, toTimeInputValue, weekdayOf, WEEKDAYS_JA } from '../lib/date';
import { createId } from '../lib/ids';
import { timedOn } from '../lib/recurrence';
import { conflictsFor } from '../lib/schedule';
import { ease } from '../motion/tokens';
import { Icon } from './Icon';

interface Props {
  initial: EventDraft;
  eventId?: string;
  allEvents: CalendarEvent[];
  saving: boolean;
  submitLabel: string;
  /** 繰り返しの設定を隠す（繰り返しの「この回だけ」を編集するとき） */
  hideRepeat?: boolean;
  /** フォームの上に出す補足 */
  note?: string;
  onSubmit: (draft: EventDraft) => void;
  onCancel: (dirty: boolean) => void;
}

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const DURATION_PRESETS = [30, 60, 90, 120];
const FREQ_OPTIONS: { value: RepeatFreq | 'none'; label: string }[] = [
  { value: 'none', label: 'しない' },
  { value: 'daily', label: '毎日' },
  { value: 'weekly', label: '毎週' },
  { value: 'monthly', label: '毎月' },
  { value: 'yearly', label: '毎年' },
];
const FREQ_UNIT: Record<RepeatFreq, string> = { daily: '日', weekly: '週', monthly: 'か月', yearly: '年' };
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function EventForm({ initial, eventId, allEvents, saving, submitLabel, hideRepeat = false, note, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<EventDraft>(initial);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [ack, setAck] = useState(false);
  const [newTask, setNewTask] = useState('');
  const uid = useId();
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const apply = (fn: (prev: EventDraft) => EventDraft) => {
    setD((prev) => {
      const next = fn(prev);
      if (submitted) setErrors(validateDraft(next));
      return next;
    });
    setAck(false);
  };
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => apply((prev) => ({ ...prev, [key]: value }));

  const multiDay = d.endDate !== d.date;
  const conflicts = useMemo(() => {
    if (d.allDay) return [];
    if (Object.keys(validateDraft({ ...d, title: d.title || 'x' })).length > 0) return [];
    // 日をまたぐ予定は、初日の部分（開始〜24:00）で重なりを調べる
    const candidate = { ...d, endMin: d.endDate > d.date ? 1440 : d.endMin, id: eventId ?? '__new__', baseId: eventId };
    return conflictsFor(candidate, timedOn(allEvents, d.date));
  }, [d, eventId, allEvents]);
  const overlapList = conflicts.filter((c) => c.kind === 'overlap');

  const onStartDate = (value: string) => {
    if (!isValidDateKey(value)) return set('date', value);
    apply((prev) => {
      const next = shiftKeepingSpan(prev, value, prev.startMin);
      // 毎週の繰り返しで曜日が 1 つだけなら、開始日の曜日に合わせる
      if (next.repeat?.freq === 'weekly' && next.repeat.weekdays.length <= 1) next.repeat = { ...next.repeat, weekdays: [weekdayOf(value)] };
      return next;
    });
  };

  const onStartTime = (value: string) => {
    const s = parseTime(value);
    if (s == null) return;
    // 開始を変えたら長さを保ったまま終了もずらす（日付をまたぐこともある）
    apply((prev) => shiftKeepingSpan(prev, prev.date, s));
  };

  const onEndDate = (value: string) => set('endDate', value);

  const onEndTime = (value: string) => {
    const e = parseTime(value);
    if (e == null) return;
    // 00:00 は「その日の終わり（24:00）」として扱う
    set('endMin', e === 0 ? 1440 : e);
  };

  const toggleAllDay = (on: boolean) =>
    apply((prev) => (on ? { ...prev, allDay: true } : { ...prev, allDay: false, startMin: initial.allDay ? 9 * 60 : prev.startMin, endMin: initial.allDay ? 10 * 60 : prev.endMin }));

  const setPreset = (m: number) => apply((prev) => shiftKeepingSpan({ ...prev, endDate: prev.date, endMin: prev.startMin + m }, prev.date, prev.startMin));

  const setFreq = (value: RepeatFreq | 'none') =>
    apply((prev) => {
      if (value === 'none') return { ...prev, repeat: null };
      const r: Repeat = prev.repeat ?? { freq: value, interval: 1, weekdays: [], until: null };
      return { ...prev, repeat: { ...r, freq: value, weekdays: value === 'weekly' ? (r.weekdays.length ? r.weekdays : [weekdayOf(prev.date)]) : [] } };
    });
  const setRepeat = (patch: Partial<Repeat>) => apply((prev) => (prev.repeat ? { ...prev, repeat: { ...prev.repeat, ...patch } } : prev));
  const toggleWeekday = (w: number) => {
    if (!d.repeat) return;
    const has = d.repeat.weekdays.includes(w);
    setRepeat({ weekdays: has ? d.repeat.weekdays.filter((x) => x !== w) : [...d.repeat.weekdays, w] });
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

  const span = spanMinutes(d);
  const endBeforeStart = isValidDateKey(d.date) && isValidDateKey(d.endDate) && compareDateKeys(d.endDate, d.date) < 0;

  return (
    <form className="evform" onSubmit={submit} noValidate>
      {note && <p className="evform__note">{note}</p>}
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

      <div className="evform__card">
        <label className="evform__switch-row">
          <span>終日</span>
          <span className="switch">
            <input type="checkbox" role="switch" checked={d.allDay} onChange={(e) => toggleAllDay(e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
          </span>
        </label>
        <div className={`evform__row ${errors.date || errors.startMin ? 'field--error' : ''}`}>
          <span className="evform__row-label">開始</span>
          <div className="evform__row-controls">
            <input className="field__control" type="date" aria-label="開始日" data-field="date" value={d.date} onChange={(e) => onStartDate(e.target.value)} aria-invalid={!!errors.date} required />
            {!d.allDay && (
              <input
                className="field__control evform__time"
                type="time"
                step={300}
                aria-label="開始時刻"
                data-field="startMin"
                value={toTimeInputValue(d.startMin)}
                onChange={(e) => onStartTime(e.target.value)}
                aria-invalid={!!errors.startMin}
                required
              />
            )}
          </div>
        </div>
        {err('date')}
        {err('startMin')}
        <div className={`evform__row ${errors.endDate || errors.endMin ? 'field--error' : ''}`}>
          <span className="evform__row-label">終了</span>
          <div className="evform__row-controls">
            <input
              className="field__control"
              type="date"
              aria-label="終了日"
              data-field="endDate"
              min={d.date}
              value={d.endDate}
              onChange={(e) => onEndDate(e.target.value)}
              aria-invalid={!!errors.endDate || endBeforeStart}
              required
            />
            {!d.allDay && (
              <input
                className="field__control evform__time"
                type="time"
                step={300}
                aria-label="終了時刻"
                data-field="endMin"
                value={toTimeInputValue(d.endMin)}
                onChange={(e) => onEndTime(e.target.value)}
                aria-invalid={!!errors.endMin}
                aria-describedby={`${uid}-end-hint`}
                required
              />
            )}
          </div>
        </div>
        {err('endDate')}
        {err('endMin')}
        {!d.allDay && (
          <div className="evform__presets">
            <span className="field__hint" id={`${uid}-end-hint`}>
              {span > 0 ? `長さ ${formatDuration(span)}` : ''}
              {multiDay && span > 0 ? '（日をまたぐ予定）' : ''}
              {d.endMin === 1440 && !multiDay ? '（終了 0:00 は深夜0時＝その日の終わり）' : ''}
            </span>
            <span className="evform__preset-list">
              {DURATION_PRESETS.map((m) => (
                <button key={m} type="button" className={`evform__preset ${span === m ? 'is-on' : ''}`} onClick={() => setPreset(m)}>
                  {formatDuration(m)}
                </button>
              ))}
            </span>
          </div>
        )}
        {!d.allDay && !multiDay && (
          <button type="button" className="evform__link" onClick={() => set('endDate', addDays(d.date, 1))}>
            翌日に終わる予定にする
          </button>
        )}
      </div>

      {!hideRepeat && (
        <div className={`evform__card ${errors.repeat ? 'field--error' : ''}`}>
          <div className="evform__row">
            <span className="evform__row-label">
              <Icon name="repeat" size={16} /> 繰り返し
            </span>
            <div className="evform__row-controls">
              <select className="field__control" data-field="repeat" value={d.repeat?.freq ?? 'none'} onChange={(e) => setFreq(e.target.value as RepeatFreq | 'none')}>
                {FREQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {d.repeat && (
            <>
              <div className="evform__row">
                <span className="evform__row-label">間隔</span>
                <div className="evform__row-controls evform__interval">
                  <input
                    className="field__control"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    aria-label="繰り返しの間隔"
                    value={Number.isFinite(d.repeat.interval) ? d.repeat.interval : ''}
                    onChange={(e) => setRepeat({ interval: e.target.value === '' ? NaN : Number(e.target.value) })}
                  />
                  <span>{FREQ_UNIT[d.repeat.freq]}ごと</span>
                </div>
              </div>
              {d.repeat.freq === 'weekly' && (
                <div className="evform__weekdays" role="group" aria-label="繰り返す曜日">
                  {WEEK_ORDER.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`evform__wd ${d.repeat!.weekdays.includes(w) ? 'is-on' : ''} ${w === 0 ? 'is-sun' : w === 6 ? 'is-sat' : ''}`}
                      aria-pressed={d.repeat!.weekdays.includes(w)}
                      onClick={() => toggleWeekday(w)}
                    >
                      {WEEKDAYS_JA[w]}
                    </button>
                  ))}
                </div>
              )}
              <div className="evform__row">
                <span className="evform__row-label">終了日</span>
                <div className="evform__row-controls">
                  <input
                    className="field__control"
                    type="date"
                    aria-label="繰り返しの終了日"
                    min={d.date}
                    value={d.repeat.until ?? ''}
                    onChange={(e) => setRepeat({ until: e.target.value || null })}
                  />
                  {d.repeat.until && (
                    <button type="button" className="btn btn--small btn--ghost" onClick={() => setRepeat({ until: null })}>
                      なし
                    </button>
                  )}
                </div>
              </div>
              {!d.repeat.until && <p className="field__hint">終了日を空にすると、ずっと繰り返します。</p>}
            </>
          )}
          {err('repeat')}
        </div>
      )}

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
                <p className="evform__conflict-note">他の予定は変更されません。</p>
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
          <span className="field__hint evform__inline-hint">重なりを調整するとき、この予定は動かしません</span>
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
