/** 一意な ID を作る（crypto.randomUUID が使えない古い環境にも対応） */
export function createId(prefix = 'ev'): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return `${prefix}_${c.randomUUID()}`;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
