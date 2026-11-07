import { Form } from 'antd';
import { isMultiChoice, readChoices } from '@agul/core';
import type { AgulFieldPlugin, AgulFieldRenderContext } from './types.js';
import { ChoiceCards } from '../components/widgets/ChoiceCards.js';
import { ScoreMeter } from '../components/widgets/ScoreMeter.js';
import { ProgressXp } from '../components/widgets/ProgressXp.js';

const labelOf = (context: AgulFieldRenderContext) => context.schema.title ?? context.label;

export const choiceCardsPlugin: AgulFieldPlugin = {
  id: 'agul-choice-cards',
  widget: 'choice-cards',
  render: (context) => (
    <Form.Item
      name={context.name}
      label={labelOf(context)}
      tooltip={context.schema.description}
      rules={context.required ? [{ required: true, message: `Please choose ${labelOf(context)}` }] : []}
    >
      <ChoiceCards choices={readChoices(context.schema)} multiple={isMultiChoice(context.schema)} />
    </Form.Item>
  ),
};

export const scoreMeterPlugin: AgulFieldPlugin = {
  id: 'agul-score-meter',
  widget: 'score-meter',
  render: (context) => (
    <Form.Item name={context.name} label={labelOf(context)} tooltip={context.schema.description}>
      <ScoreMeter schema={context.schema} />
    </Form.Item>
  ),
};

export const progressXpPlugin: AgulFieldPlugin = {
  id: 'agul-progress-xp',
  widget: 'progress-xp',
  render: (context) => (
    <Form.Item name={context.name} label={labelOf(context)} tooltip={context.schema.description}>
      <ProgressXp schema={context.schema} />
    </Form.Item>
  ),
};

/** Opt-in: pass to `AGULRenderer`'s `plugins` to draw `x-agul-widget` game fields. */
export const gameWidgetPlugins: AgulFieldPlugin[] = [choiceCardsPlugin, scoreMeterPlugin, progressXpPlugin];
