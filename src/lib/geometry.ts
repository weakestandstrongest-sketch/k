/**
 * 24時間文字盤の幾何学
 * 正午（12:00）を真上、真夜中（0:00）を真下に置きます（太陽が天頂にある配置）。
 */

/** 分 → 角度（度）。12:00 = 0°、18:00 = 90°、0:00 = 180° */
export function minuteToAngle(min: number): number {
  return ((min - 720) / 1440) * 360;
}

export function polar(r: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}

const f = (n: number) => Math.round(n * 100) / 100;

/** 半径 r の円弧（時計回り） */
export function arcPath(r: number, startMin: number, endMin: number): string {
  const a1 = minuteToAngle(startMin);
  let a2 = minuteToAngle(endMin);
  if (a2 <= a1) a2 += 360;
  // 完全な円は SVG の弧で描けないので、わずかに欠かす
  if (a2 - a1 >= 359.99) a2 = a1 + 359.9;
  const p1 = polar(r, a1);
  const p2 = polar(r, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${f(p1.x)} ${f(p1.y)} A ${r} ${r} 0 ${large} 1 ${f(p2.x)} ${f(p2.y)}`;
}

/** 前回の角度から最短方向で連続する角度にする（0:00 をまたいでも逆回転しない） */
export function continuousAngle(prev: number, next: number): number {
  let d = next - (prev % 360);
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return prev + d;
}
