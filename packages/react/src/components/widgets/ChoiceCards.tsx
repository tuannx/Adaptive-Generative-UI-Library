import { theme } from 'antd';
import type { AgulChoice } from '@ai-kit/agul-core';

type ChoiceValue = string | number;

interface ChoiceCardsProps {
  choices: AgulChoice[];
  multiple?: boolean;
  /** Injected by `Form.Item`. */
  value?: ChoiceValue | ChoiceValue[];
  onChange?: (value: ChoiceValue | ChoiceValue[]) => void;
  disabled?: boolean;
}

/** One-tap answer cards: a single choice, or several when `multiple`. */
export function ChoiceCards({ choices, multiple = false, value, onChange, disabled }: ChoiceCardsProps) {
  const { token } = theme.useToken();
  const selected = new Set<ChoiceValue>(Array.isArray(value) ? value : value === undefined ? [] : [value]);

  const toggle = (choice: ChoiceValue) => {
    if (!multiple) {
      onChange?.(choice);
      return;
    }
    const next = selected.has(choice) ? [...selected].filter((item) => item !== choice) : [...selected, choice];
    onChange?.(next);
  };

  return (
    <div
      role="group"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: token.marginSM }}
    >
      {choices.map((choice) => {
        const active = selected.has(choice.value);
        return (
          <button
            key={String(choice.value)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            data-testid={`agul-choice-${choice.value}`}
            onClick={() => toggle(choice.value)}
            style={{
              textAlign: 'left',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: token.paddingSM,
              borderRadius: token.borderRadiusLG,
              border: `${active ? 2 : 1}px solid ${active ? token.colorPrimary : token.colorBorder}`,
              background: active ? token.colorPrimaryBg : token.colorBgContainer,
              color: token.colorText,
            }}
          >
            <div style={{ fontWeight: 600 }}>
              {choice.icon && <span style={{ marginRight: 8 }}>{choice.icon}</span>}
              {choice.label}
            </div>
            {choice.description && (
              <div style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM, marginTop: 4 }}>
                {choice.description}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
