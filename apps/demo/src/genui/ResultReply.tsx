import { CheckCircleFilled, MinusCircleOutlined } from '@ant-design/icons';
import { ResultView } from '@aikitstudio/agul-react';
import { summarizeSteps } from './reply.js';

/** The agent's reply after confirm, in words: one line per step. Falls back to AGUL's generic view. */
export function ResultReply({ value }: { value: unknown }) {
  const reply = summarizeSteps(value);
  if (!reply) return <ResultView value={value} />;
  return (
    <div className="genui-reply" data-testid="genui-reply">
      <p className="genui-reply__lead">{reply.lead}</p>
      <ul className="genui-reply__list">
        {reply.lines.map((line, index) => (
          <li key={index} className={line.done ? '' : 'genui-reply__skipped'}>
            {line.done ? <CheckCircleFilled className="genui-reply__ok" /> : <MinusCircleOutlined />}
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
