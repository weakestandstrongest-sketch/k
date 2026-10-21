import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  /** 装飾用の名前（七宝・宝石の色名） */
  enamel: string;
  /** 帯に斜めに入れる短い英字（装飾） */
  tag: string;
  color: string;
}

/**
 * カテゴリーの色は、深い青の背景の上でも見分けられる鮮やかな色。
 */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'work', label: '仕事', enamel: '水色', tag: 'WORK', color: '#33e4ff' },
  { id: 'meeting', label: '会議', enamel: '紅', tag: 'MEET', color: '#ff3d5e' },
  { id: 'study', label: '学び', enamel: '菫', tag: 'STUDY', color: '#b97cff' },
  { id: 'health', label: '健康', enamel: '若葉', tag: 'HEALTH', color: '#42f09a' },
  { id: 'personal', label: '私用', enamel: '山吹', tag: 'LIFE', color: '#ffd93b' },
  { id: 'travel', label: '移動', enamel: '空', tag: 'MOVE', color: '#9fc4ff' },
  { id: 'social', label: '交流', enamel: '桃', tag: 'SOCIAL', color: '#ff62c9' },
  { id: 'other', label: 'その他', enamel: '銀', tag: 'OTHER', color: '#d7def0' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): CategoryInfo {
  return BY_ID.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}
