import { Card, Typography } from 'antd';

/** How a text-only agent answers the same request. */
export function TextAnswer({ text }: { text: string }) {
  return (
    <Card size="small" title="Text-only agent" className="genui-panel" data-testid="genui-text-answer">
      <Typography.Paragraph className="genui-text">{text}</Typography.Paragraph>
      <Typography.Text type="secondary">Then: “which ones?”, “change 3”, “not miso”… one round per change.</Typography.Text>
    </Card>
  );
}
