import type { AgulFieldPlugin } from '@aikitstudio/agul-react';
import { AppStep } from './AppStep.js';
import { StepField } from './step-field.js';

/** Host component for `x-agul-widget: app-step`. The agent can only place components the host registers. */
export const appStepPlugin: AgulFieldPlugin = {
  id: 'genui-app-step',
  widget: 'app-step',
  render: (context) => <AppStep context={context} />,
};

/** `x-agul-widget: textarea` on a top-level text field. */
export const textareaPlugin: AgulFieldPlugin = {
  id: 'genui-textarea',
  widget: 'textarea',
  render: (context) => <StepField path={[context.name]} schema={{ title: context.label, ...context.schema }} disabled={false} />,
};
