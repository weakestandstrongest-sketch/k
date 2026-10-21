/**
 * 各画面の背景（建築・天体・設計図・古文書）
 * 純粋な装飾なので、支援技術からは隠しています。
 */
import { motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { ease } from '../motion/tokens';
import './Backdrop.css';

export type BackdropKind = 'hall' | 'orrery' | 'equation' | 'chronicle';

function Line({ d, delay = 0, draw, className = '' }: { d: string; delay?: number; draw: boolean; className?: string }) {
  return (
    <motion.path
      d={d}
      className={className}
      initial={draw ? { pathLength: 0, opacity: 0 } : false}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 1.4, ease: ease.regal, delay }}
    />
  );
}

/** 等時差（均時差）の曲線：一年を通した太陽時と平均時のずれ */
function equationOfTimePath(w: number, h: number, y0: number): string {
  const pts: string[] = [];
  for (let d = 0; d <= 365; d += 5) {
    const b = ((2 * Math.PI) / 364) * (d - 81);
    const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // 分
    const x = (d / 365) * w;
    const y = y0 - (eot / 17) * h;
    pts.push(`${d === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

function BackdropImpl({ kind, intro = false, introDelay = 0 }: { kind: BackdropKind; intro?: boolean; introDelay?: number }) {
  const reduce = useReducedMotion();
  const draw = intro && !reduce;
  const d0 = introDelay;

  return (
    <div className={`backdrop backdrop--${kind}`} aria-hidden="true">
      <div className="backdrop__vignette" />
      <svg className="backdrop__svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        {kind === 'hall' && (
          <g className="backdrop__lines">
            {/* 三連のアーチと列柱 */}
            {[260, 800, 1340].map((cx, i) => (
              <g key={cx}>
                <Line draw={draw} delay={d0 + i * 0.12} d={`M ${cx - 190} 1000 L ${cx - 190} 420 A 190 190 0 0 1 ${cx + 190} 420 L ${cx + 190} 1000`} />
                <Line draw={draw} delay={d0 + 0.2 + i * 0.12} className="thin" d={`M ${cx - 160} 1000 L ${cx - 160} 430 A 160 160 0 0 1 ${cx + 160} 430 L ${cx + 160} 1000`} />
              </g>
            ))}
            <Line draw={draw} delay={d0 + 0.1} d="M 0 140 L 1600 140" />
            <Line draw={draw} delay={d0 + 0.2} className="thin" d="M 0 156 L 1600 156" />
            <Line draw={draw} delay={d0 + 0.3} className="thin" d="M 0 930 L 1600 930" />
            {[530, 1070].map((x) => (
              <Line key={x} draw={draw} delay={d0 + 0.4} className="thin" d={`M ${x} 156 L ${x} 1000`} />
            ))}
            <Line draw={draw} delay={d0 + 0.5} className="thin" d="M 800 156 m -60 0 a 60 60 0 1 0 120 0 a 60 60 0 1 0 -120 0" />
          </g>
        )}
        {kind === 'orrery' && (
          <g className="backdrop__lines">
            {[180, 300, 430, 580].map((r, i) => (
              <Line key={r} draw={draw} delay={d0 + i * 0.08} className={i % 2 ? 'thin' : ''} d={`M ${1250 - r} 300 a ${r} ${r * 0.42} 0 1 0 ${r * 2} 0 a ${r} ${r * 0.42} 0 1 0 ${-r * 2} 0`} />
            ))}
            <Line draw={draw} className="thin" d="M 1250 0 L 1250 1000" />
            <Line draw={draw} className="thin" d="M 0 300 L 1600 300" />
            {Array.from({ length: 9 }, (_, i) => (
              <Line key={i} draw={draw} className="hair" d={`M ${i * 200} 0 L ${i * 200} 1000`} />
            ))}
          </g>
        )}
        {kind === 'equation' && (
          <g className="backdrop__lines">
            {Array.from({ length: 17 }, (_, i) => (
              <Line key={`v${i}`} draw={draw} className="hair" d={`M ${i * 100} 0 L ${i * 100} 1000`} />
            ))}
            {Array.from({ length: 11 }, (_, i) => (
              <Line key={`h${i}`} draw={draw} className="hair" d={`M 0 ${i * 100} L 1600 ${i * 100}`} />
            ))}
            <Line draw={draw} className="thin" d="M 0 700 L 1600 700" />
            <Line draw={draw} className="glow" d={equationOfTimePath(1600, 220, 700)} />
          </g>
        )}
        {kind === 'chronicle' && (
          <g className="backdrop__lines">
            <Line draw={draw} d="M 60 60 L 1540 60 L 1540 940 L 60 940 Z" />
            <Line draw={draw} className="thin" d="M 76 76 L 1524 76 L 1524 924 L 76 924 Z" />
            {Array.from({ length: 20 }, (_, i) => (
              <Line key={i} draw={draw} className="hair" d={`M 76 ${120 + i * 40} L 1524 ${120 + i * 40}`} />
            ))}
            <Line draw={draw} className="thin" d="M 1200 500 m -260 0 a 260 260 0 1 0 520 0 a 260 260 0 1 0 -520 0" />
          </g>
        )}
      </svg>
      <div className="backdrop__grain" />
    </div>
  );
}

export const Backdrop = memo(BackdropImpl);
