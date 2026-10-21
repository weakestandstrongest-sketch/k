/** 小さな日付移動（前へ・今日・次へ）。数字は日付窓のように回転します */
import { Icon } from './Icon';
import { RollingText } from './RollingText';
import './DateStepper.css';

interface Props {
  label: string;
  /** 読み上げ用の完全な表記 */
  srLabel: string;
  direction: 1 | -1;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isToday: boolean;
  prevLabel: string;
  nextLabel: string;
}

export function DateStepper({ label, srLabel, direction, onPrev, onNext, onToday, isToday, prevLabel, nextLabel }: Props) {
  return (
    <div className="stepper">
      <button type="button" className="btn btn--icon" onClick={onPrev} aria-label={prevLabel}>
        <Icon name="prev" />
      </button>
      <p className="stepper__label" aria-live="polite">
        <span className="sr-only">{srLabel}</span>
        <span aria-hidden="true">
          <RollingText text={label} direction={direction} stagger={0.015} />
        </span>
      </p>
      <button type="button" className="btn btn--icon" onClick={onNext} aria-label={nextLabel}>
        <Icon name="next" />
      </button>
      <button type="button" className="btn btn--small stepper__today" onClick={onToday} disabled={isToday}>
        今日
      </button>
    </div>
  );
}
