import type { Issue, Strategy } from '../core/types';
import { en } from '../i18n/en';
import { ArmRow, type ArmHandlers } from './ArmRow';

export interface ArmsEditorProps extends ArmHandlers {
  strategy: Strategy;
  issues: Issue[];
  onAddArm: () => void;
}

export function ArmsEditor({ strategy, issues, onAddArm, ...handlers }: ArmsEditorProps) {
  return (
    <div>
      <ol className="arm-list">
        {strategy.arms.map((arm, index) => (
          <li key={arm.id}>
            {index > 0 && <span className="operator and-label">{en.and}</span>}
            <ArmRow
              arm={arm}
              index={index}
              issues={issues.filter((issue) => issue.armId === arm.id)}
              {...handlers}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="add-arm" onClick={onAddArm}>
        {en.addArm}
      </button>
    </div>
  );
}
