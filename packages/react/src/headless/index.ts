// `@aikitstudio/agul-react/headless`: flow state without antd, for hosts that draw with their own components.
export { createFlowClient, type FlowClient, type FlowClientOptions } from './flowClient.js';
export { useAgulFlow, type FlowStatus, type UseAgulFlowResult } from './useAgulFlow.js';
export {
  findFlows,
  flowPercent,
  isMultiChoice,
  readChoices,
  readFlowStep,
  readScore,
  readXp,
  type AgulChoice,
  type AgulLevel,
  type AgulScore,
  type AgulScoreBand,
  type AgulXp,
  type AgulFlowBinding,
  type AgulFlowProgress,
  type AgulFlowStep,
  type AgulFlowStepView,
} from '@aikitstudio/agul-core';
