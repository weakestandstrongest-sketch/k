import type { CategoryId } from './types';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  /** 装飾用の名前（七宝・宝石の色名） */
  enamel: string;
  color: string;
}

/**
 * カテゴリーの色は「七宝（エナメル）」をイメージした中間調。
 * 黒背景・アイボリー背景のどちらでも識別できる明度にしています。
 */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'work', label: '仕事', enamel: '瑠璃', color: '#4a78c2' },
  { id: 'meeting', label: '会議', enamel: '紅玉', color: '#c4513f' },
  { id: 'study', label: '学び', enamel: '紫水晶', color: '#8c62c4' },
  { id: 'health', label: '健康', enamel: '孔雀石', color: '#2f9a72' },
  { id: 'personal', label: '私用', enamel: '琥珀', color: '#cf952c' },
  { id: 'travel', label: '移動', enamel: '青磁', color: '#3d9da3' },
  { id: 'social', label: '交流', enamel: '珊瑚', color: '#cf6a8a' },
  { id: 'other', label: 'その他', enamel: '鉛', color: '#858b96' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: CategoryId): CategoryInfo {
  return BY_ID.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}
