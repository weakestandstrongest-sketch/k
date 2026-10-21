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
 * カテゴリーの色は、白い面でも黒い面でも見分けられる落ち着いた中間調。
 */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'work', label: '仕事', enamel: '藍', tag: 'WORK', color: '#4a6fd1' },
  { id: 'meeting', label: '会議', enamel: '紅', tag: 'MEET', color: '#e0243c' },
  { id: 'study', label: '学び', enamel: '菫', tag: 'STUDY', color: '#8061c9' },
  { id: 'health', label: '健康', enamel: '翠', tag: 'HEALTH', color: '#2f9a72' },
  { id: 'personal', label: '私用', enamel: '山吹', tag: 'LIFE', color: '#c58b22' },
  { id: 'travel', label: '移動', enamel: '浅葱', tag: 'MOVE', color: '#3592a6' },
  { id: 'social', label: '交流', enamel: '桃', tag: 'SOCIAL', color: '#cf5389' },
  { id: 'other', label: 'その他', enamel: '鈍', tag: 'OTHER', color: '#8b909b' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): CategoryInfo {
  return BY_ID.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}
