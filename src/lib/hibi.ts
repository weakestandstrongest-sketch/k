/**
 * ひび手帳との切り替え（UI チェンジ）
 *
 * ひび手帳（…/day/）は同じサイトにあるカレンダーで、同じ予定を別の見た目で扱えます。
 * - CHRONOS を開いているとき：ボタンでひび手帳を上に重ねて開く（HibiSwitch）
 * - ひび手帳の中で開かれたとき（?from=hibi）：ボタンでひび手帳に戻る
 * 予定の受け渡し（両方の予定を合わせる処理）は、切り替えるたびにひび手帳の側が行います。
 * CHRONOS は戻ってきたときに、保存された予定を読み直すだけです。
 */

/** ひび手帳の中で開かれている */
export const IN_HIBI: boolean = (() => {
  try {
    return window.self !== window.top && window.parent.location.origin === location.origin && /[?&]from=hibi\b/.test(location.search);
  } catch {
    return false;
  }
})();

export function hibiUrl(): string {
  return new URL('../day/', location.href.split(/[?#]/)[0]).href;
}

/** ボタンを押したとき：ひび手帳に戻る／ひび手帳を開く */
export function switchToHibi(): void {
  if (IN_HIBI) window.parent.postMessage({ type: 'chronos:to-hibi' }, location.origin);
  else window.dispatchEvent(new Event('chronos:open-hibi'));
}
