/** ひび手帳の「のりかえ」で入れた経路（見るだけ） */
import type { RouteInfo } from '../data/types';

export function RouteView({ route: r }: { route: RouteInfo }) {
  const meta = [r.duration, r.transfers != null ? `乗換 ${r.transfers}回` : '', r.fare != null ? `${r.fareNote === '目安' ? '約' : ''}${r.fare.toLocaleString('ja-JP')}円` : '', r.via ? `${r.via} 経由` : ''].filter(Boolean);
  return (
    <section className="route" aria-label="のりかえの経路">
      <p className="cview__label">経路（のりかえ）</p>
      <p className="route__od">
        {r.from} <span aria-hidden="true">→</span> {r.to}
      </p>
      {meta.length > 0 && <p className="route__meta">{meta.join('・')}</p>}
      <ol className="route__steps">
        {r.steps.map((s, i) =>
          s.k === 's' ? (
            <li key={i} className="route__st">
              <span className="route__time num">
                {s.arr && <small>{s.arr}着</small>}
                {s.dep && <b>{s.dep}発</b>}
              </span>
              <span className="route__mk" aria-hidden="true" />
              <span className="route__name">{s.name}</span>
            </li>
          ) : (
            <li key={i} className={`route__ac ${s.walk ? 'is-walk' : ''}`} style={s.color ? ({ '--rc': s.color } as React.CSSProperties) : undefined}>
              <span className="route__time" />
              <span className="route__mk" aria-hidden="true" />
              <span className="route__body">
                <b>
                  {s.line}
                  {s.dest ? <span className="route__dest"> {s.dest}</span> : null}
                </b>
                {[s.platform, s.stops].filter(Boolean).join('・') && <small>{[s.platform, s.stops].filter(Boolean).join('・')}</small>}
              </span>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}
