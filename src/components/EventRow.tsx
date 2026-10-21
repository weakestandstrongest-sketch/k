/**
 * 予定の一行（ホームの一覧・月表示の一覧・週の一覧で共通）
 * layoutId を持つので、選ぶとそのまま「私室」（詳細パネル）へ広がります。
 */
import { motion, type Variants } from 'motion/react';
import { categoryOf } from '../data/categories';
import { STATUS_LABEL } from '../data/eventModel';
import type { CalendarEvent } from '../data/types';
import { formatMinutes } from '../lib/date';
import type { ConflictKind } from '../lib/schedule';
import { Icon } from './Icon';
import './EventRow.css';

interface Props {
  event: CalendarEvent;
  scope: string;
  conflict?: ConflictKind;
  past?: boolean;
  onOpen: (event: CalendarEvent, layoutKey: string) => void;
  variants?: Variants;
  compact?: boolean;
}

export function EventRow({ event: e, scope, conflict, past, onOpen, variants, compact }: Props) {
  const cat = categoryOf(e.category);
  const layoutKey = `${scope}-${e.id}`;
  return (
    <motion.li variants={variants} className="evrow-item" layout="position">
      <button
        type="button"
        className={`evrow ${past ? 'is-past' : ''} ${compact ? 'evrow--compact' : ''} ${e.status !== 'planned' ? `is-${e.status}` : ''}`}
        style={{ ['--cat' as string]: cat.color }}
        onClick={() => onOpen(e, layoutKey)}
        aria-label={`${formatMinutes(e.startMin)}から${formatMinutes(e.endMin)} ${e.title}、${cat.label}${conflict === 'overlap' ? '、他の予定と重複' : ''}${e.status !== 'planned' ? `、${STATUS_LABEL[e.status]}` : ''}`}
      >
        <motion.span layoutId={`shell-${layoutKey}`} className="evrow__shell" aria-hidden="true" />
        <span className="evrow__time num" aria-hidden="true">
          <span>{formatMinutes(e.startMin)}</span>
          {!compact && <span className="evrow__end">{formatMinutes(e.endMin)}</span>}
        </span>
        <span className="evrow__rule" aria-hidden="true" />
        <span className="evrow__main" aria-hidden="true">
          <span className="evrow__title">
            {e.status === 'completed' && <Icon name="check" size={14} className="evrow__done" />}
            {e.title}
          </span>
          {!compact && (
            <span className="evrow__meta">
              <span>{cat.label}</span>
              {e.location && (
                <span className="evrow__loc">
                  <Icon name="pin" size={12} />
                  {e.location}
                </span>
              )}
              {(e.bufferBeforeMin > 0 || e.bufferAfterMin > 0) && <span>余白 {e.bufferBeforeMin + e.bufferAfterMin}分</span>}
            </span>
          )}
        </span>
        <span className="evrow__flags" aria-hidden="true">
          {e.fixed && <Icon name="lock" size={14} className="evrow__lock" />}
          {conflict === 'overlap' && <span className="chip chip--danger">重複</span>}
          {conflict === 'buffer' && <span className="chip chip--warn">余白が重複</span>}
          {e.isSample && <span className="chip chip--sample">見本</span>}
        </span>
      </button>
    </motion.li>
  );
}
