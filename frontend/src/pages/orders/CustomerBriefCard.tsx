import { Card, Typography } from 'antd';
import type { CustomerBriefInfo } from '@/types/order';

const { Paragraph, Text } = Typography;

export default function CustomerBriefCard({
  brief,
  pieceId,
}: {
  brief?: CustomerBriefInfo | null;
  pieceId?: number | null;
}) {
  if (!brief) return null;
  const current = brief.pieces?.find((p) => p.pieceId === pieceId);
  const others = (brief.pieces || []).filter((p) => p.pieceId !== pieceId && p.summary);
  return (
    <Card size="small" title="客户定制问卷" style={{ marginBottom: 16 }}>
      <Paragraph style={{ marginBottom: 8 }}>
        金属：{brief.metalLabel || '支付定金时未选择'}
        {brief.inlayAllowed === false ? '。足金、足银无法镶嵌宝石，问卷里没有镶石选项。' : ''}
      </Paragraph>
      {!brief.submitted ? (
        <Text type="secondary">客户还没提交问卷。AI 客服会在群聊里发送填写链接。</Text>
      ) : (
        <>
          <Paragraph style={{ marginBottom: 8 }}>预算：{brief.budgetLabel || '—'}</Paragraph>
          <Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
            {current?.summary || '这一件还没有单独记录。'}
          </Paragraph>
          {others.length > 0 ? (
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              其他件：{others.map((p) => p.summary).join('；')}
            </Paragraph>
          ) : null}
          <Text type="secondary">
            拉丝、喷砂、钉砂等其他工艺由设计师填写。客户的选择会尽可能被采纳，但不保证每一项都原样实现。
          </Text>
        </>
      )}
    </Card>
  );
}
