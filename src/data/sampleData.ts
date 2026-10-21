/**
 * 初回起動時の見本データ
 * 今日を基準に、過去と未来の予定を作ります。すべて isSample: true で、
 * 画面では「見本」と表示され、設定からまとめて消去できます。
 */
import { addDays, weekdayOf, type DateKey } from '../lib/date';
import { createEvent, emptyDraft } from './eventModel';
import type { CalendarEvent, CategoryId, EventStatus, Repeat } from './types';

interface Seed {
  offset: number;
  /** 日をまたぐ予定の終了日（今日からの日数） */
  endOffset?: number;
  allDay?: boolean;
  repeat?: Repeat;
  start: string;
  end: string;
  title: string;
  category: CategoryId;
  location?: string;
  notes?: string;
  prep?: string[];
  before?: number;
  after?: number;
  fixed?: boolean;
  /** 過去の予定に付ける記録（見本） */
  status?: EventStatus;
  actual?: number;
}

const t = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

const TODAY_AND_FUTURE: Seed[] = [
  { offset: 0, start: '07:30', end: '08:15', title: '朝の散策', category: 'health', location: '川沿いの遊歩道' },
  {
    offset: 0,
    start: '09:30',
    end: '10:30',
    title: '企画会議',
    category: 'meeting',
    location: '第二会議室',
    notes: '第3四半期の振り返りと来期の方針。',
    prep: ['資料を印刷する', '前回の議事録を読む'],
    after: 10,
    fixed: true,
  },
  { offset: 0, start: '10:15', end: '11:45', title: '提案書の作成', category: 'work', notes: '構成案まで仕上げる。' },
  {
    offset: 0,
    start: '13:00',
    end: '14:00',
    title: '取引先との打ち合わせ',
    category: 'meeting',
    location: '丸の内オフィス',
    before: 30,
    after: 30,
    prep: ['名刺を補充する', '見積書を持参'],
  },
  { offset: 0, start: '16:00', end: '17:00', title: '英語のオンライン講座', category: 'study' },
  { offset: 0, start: '19:30', end: '21:00', title: '友人と夕食', category: 'social', location: '神楽坂', before: 20 },
  { offset: 1, start: '08:00', end: '09:00', title: 'ジム', category: 'health', location: 'フィットネスクラブ' },
  { offset: 1, start: '10:00', end: '12:00', title: '設計レビュー', category: 'work', prep: ['図面の最新版を共有'] },
  { offset: 1, start: '15:00', end: '15:30', title: '定例ミーティング', category: 'meeting', fixed: true },
  { offset: 2, start: '09:00', end: '10:30', title: '読書会', category: 'study', location: '市立図書館' },
  { offset: 2, start: '14:00', end: '16:00', title: '歯科検診', category: 'personal', location: '駅前歯科', before: 15 },
  { offset: 3, start: '11:00', end: '12:00', title: '週次の振り返り', category: 'work' },
  { offset: 3, start: '18:30', end: '20:00', title: 'ピアノの練習', category: 'personal' },
  { offset: 5, start: '10:00', end: '13:00', title: '美術館へ', category: 'social', location: '上野', before: 40, after: 40 },
  { offset: 8, start: '09:30', end: '11:00', title: '四半期計画の締め切り', category: 'work', fixed: true },
  // 繰り返し・終日・日をまたぐ予定の見本
  { offset: -20, start: '07:00', end: '07:30', title: '朝のヨガ', category: 'health', repeat: { freq: 'weekly', interval: 1, weekdays: [2, 4], until: null } },
  { offset: 3, start: '00:00', end: '24:00', allDay: true, title: '母の誕生日', category: 'social', repeat: { freq: 'yearly', interval: 1, weekdays: [], until: null } },
  { offset: 4, endOffset: 5, start: '23:00', end: '06:30', title: '夜行バスで移動', category: 'travel', location: 'バスタ新宿', before: 30 },
  { offset: 6, endOffset: 7, start: '00:00', end: '24:00', allDay: true, title: '京都への出張', category: 'travel', location: '京都' },
];

/** 過去の見本：完了などの記録も見本として付けておく（見本であることは画面に明記） */
function pastSeeds(today: DateKey): Seed[] {
  const out: Seed[] = [];
  for (let offset = -28; offset <= -1; offset++) {
    const wd = weekdayOf(addDays(today, offset));
    const weekend = wd === 0 || wd === 6;
    const k = Math.abs(offset);
    if (!weekend) {
      out.push({ offset, start: '09:00', end: '12:00', title: '集中作業', category: 'work', status: 'completed', actual: 150 + (k % 4) * 15 });
      out.push({
        offset,
        start: '13:30',
        end: '14:30',
        title: k % 2 ? '定例ミーティング' : 'チーム打ち合わせ',
        category: 'meeting',
        status: k % 5 === 0 ? 'missed' : 'completed',
        actual: k % 5 === 0 ? undefined : 50 + (k % 3) * 10,
      });
      if (k % 3 === 0) out.push({ offset, start: '19:00', end: '20:00', title: '英語のオンライン講座', category: 'study', status: 'completed', actual: 60 });
      if (k % 3 === 1) out.push({ offset, start: '07:00', end: '07:45', title: '朝のランニング', category: 'health', status: k % 2 ? 'completed' : 'planned' });
    } else {
      out.push({ offset, start: '10:00', end: '12:00', title: '家族との時間', category: 'personal', status: 'completed' });
      if (k % 2) out.push({ offset, start: '15:00', end: '17:30', title: '散策と写真', category: 'social', status: 'completed', actual: 165 });
    }
  }
  return out;
}

export function buildSampleEvents(today: DateKey, now = new Date()): CalendarEvent[] {
  const seeds = [...pastSeeds(today), ...TODAY_AND_FUTURE];
  return seeds.map((s, i) => {
    const date = addDays(today, s.offset);
    const draft = emptyDraft(date);
    const repeat = s.repeat ? { ...s.repeat, weekdays: s.repeat.freq === 'weekly' ? s.repeat.weekdays : [] } : null;
    // 作成順を安定させるため、作成時刻を少しずつずらす
    const created = new Date(now.getTime() + i);
    return createEvent(
      {
        ...draft,
        title: s.title,
        endDate: addDays(today, s.endOffset ?? s.offset),
        allDay: s.allDay ?? false,
        repeat,
        startMin: t(s.start),
        endMin: t(s.end),
        category: s.category,
        location: s.location ?? '',
        notes: s.notes ?? '',
        prepTasks: (s.prep ?? []).map((label, j) => ({ id: `pt_s${i}_${j}`, label, done: false })),
        bufferBeforeMin: s.before ?? 0,
        bufferAfterMin: s.after ?? 0,
        fixed: s.fixed ?? false,
        status: s.status ?? 'planned',
        actualMinutes: s.actual ?? null,
      },
      created,
      true,
    );
  });
}
