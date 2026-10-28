import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Image, Input, InputNumber, Segmented, Select, Space, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { API_ORIGIN } from '@/services/api';
import { jewelryTypeLabel } from '@/constants/jewelryType';
import { orderStatusLabel } from '@/utils/orderLabels';
import {
  draftFromItem,
  modelCoefficient,
  settlementService,
  type ModelSettlementDraft,
  type ModelSettlementItem,
} from '@/services/settlementService';

const { Text, Paragraph } = Typography;

const STRUCTURES = [
  { value: '无主体', points: 0 },
  { value: '普通构型（素圈）', points: 3 },
  { value: '异形（单圈形状微调）', points: 15 },
  { value: '异形（存在镂空、形状缠绕）', points: 30 },
  { value: '异形（戒圈完全重构）', points: 45 },
];

const TEXTURES = [
  { value: '不含纹理', points: 0 },
  { value: '含纹理', points: 10 },
  { value: '多种纹理', points: 20 },
];

const COUNTS: { key: keyof ModelSettlementDraft; label: string; points: number }[] = [
  { key: 'simpleComponentCount', label: '简单小组件', points: 3 },
  { key: 'regularCurveComponentCount', label: '一般复杂小组件', points: 15 },
  { key: 'irregularCurveComponentCount', label: '复杂小组件', points: 30 },
  { key: 'simpleInlayCount', label: '简单镶嵌结构', points: 5 },
  { key: 'specialInlayCount', label: '特殊镶嵌结构', points: 10 },
  { key: 'linearStoneCount', label: '线性排石', points: 15 },
];

const PARKED: { key: keyof ModelSettlementDraft; label: string }[] = [
  { key: 'highDetailComponentCount', label: '高度复杂小组件' },
  { key: 'freeformStoneCount', label: '不规则曲面排石' },
];

function imageSrc(url?: string | null) {
  const value = (url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return value;
}

function ModelSettlementDesk() {
  const [items, setItems] = useState<ModelSettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState<'pending' | 'done' | 'all'>('pending');
  const [modelerId, setModelerId] = useState<number | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ModelSettlementDraft | null>(null);

  const load = async (preferId?: number | null) => {
    setLoading(true);
    try {
      const rows = await settlementService.listModel();
      const list = Array.isArray(rows) ? rows : [];
      setItems(list);
      const nextId = preferId && list.some((row) => row.pieceId === preferId)
        ? preferId
        : (list.find((row) => !row.reviewed)?.pieceId ?? list[0]?.pieceId ?? null);
      setActiveId(nextId);
      const next = list.find((row) => row.pieceId === nextId);
      setDraft(next ? draftFromItem(next) : null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const modelers = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((item) => {
      if (item.modelerId != null) map.set(item.modelerId, item.modelerName || `建模师${item.modelerId}`);
    });
    return [...map.entries()];
  }, [items]);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (scope === 'pending' && item.reviewed) return false;
      if (scope === 'done' && !item.reviewed) return false;
      if (modelerId !== 'all' && item.modelerId !== modelerId) return false;
      if (!q) return true;
      return `${item.orderNumber || ''} ${item.pieceName || ''} ${item.modelerName || ''}`.toLowerCase().includes(q);
    });
  }, [items, scope, modelerId, keyword]);

  const active = items.find((item) => item.pieceId === activeId) || null;
  const score = draft ? modelCoefficient(draft) : 10;
  const pendingCount = items.filter((item) => !item.reviewed).length;
  const doneSum = items.filter((item) => item.reviewed).reduce((sum, item) => sum + (item.coefficient || 0), 0);

  const select = (item: ModelSettlementItem) => {
    setActiveId(item.pieceId);
    setDraft(draftFromItem(item));
  };

  const patch = (partial: Partial<ModelSettlementDraft>) => {
    setDraft((current) => current ? { ...current, ...partial } : current);
  };

  const save = async (goNext: boolean) => {
    if (!active || !draft) return;
    if (!draft.structureComplexity || !draft.textureLevel) {
      message.warning('请先选择主体结构复杂度和纹理');
      return;
    }
    setSaving(true);
    try {
      const saved = await settlementService.saveModel(active.pieceId, draft);
      const rest = items.map((item) => item.pieceId === saved.pieceId ? saved : item);
      setItems(rest);
      const pool = rest.filter((item) => {
        if (modelerId !== 'all' && item.modelerId !== modelerId) return false;
        return !item.reviewed;
      });
      const next = goNext ? pool.find((item) => item.pieceId !== saved.pieceId) : saved;
      if (next) {
        select(next);
      } else {
        select(saved);
        if (goNext) message.success('这一批评完了');
      }
      if (!goNext) message.success(`已保存，折算系数 ${saved.coefficient}`);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settle-desk">
      <aside className="settle-queue">
        <div className="settle-queue__bar">
          <Segmented
            block
            value={scope}
            onChange={(value) => setScope(value as 'pending' | 'done' | 'all')}
            options={[
              { label: `待评 ${pendingCount}`, value: 'pending' },
              { label: '已评', value: 'done' },
              { label: '全部', value: 'all' },
            ]}
          />
          <Select
            value={modelerId}
            onChange={setModelerId}
            options={[{ value: 'all', label: '全部建模师' }, ...modelers.map(([id, name]) => ({ value: id, label: name }))]}
          />
          <Input allowClear placeholder="订单号 / 单件 / 建模师" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Text type="secondary">已评合计 {doneSum} 分</Text>
        </div>
        <div className="settle-queue__list">
          {!loading && visible.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这里没有要评的件" /> : null}
          {visible.map((item) => {
            const thumb = imageSrc(item.modelEffectImages?.[0] || item.designImages?.[0]);
            return (
              <button
                key={item.pieceId}
                type="button"
                className={`settle-card${item.pieceId === activeId ? ' is-active' : ''}`}
                onClick={() => select(item)}
              >
                {thumb ? <img src={thumb} alt="" /> : <div className="settle-card__ph">无图</div>}
                <div>
                  <div className="settle-card__title">{item.orderNumber} · {item.pieceName}</div>
                  <div className="settle-card__meta">
                    {item.modelerName || '未指派'}
                    {item.reviewed ? ` · ${item.coefficient} 分` : ' · 待评'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="settle-stage">
        {!active || !draft ? (
          <Empty description={loading ? '正在读取已建模的单件' : '还没有可以核算的建模。建模师上传效果图或源文件后会出现在这里。'} />
        ) : (
          <>
            <div className="settle-head">
              <div>
                <h2>{active.orderNumber} · {active.pieceName}</h2>
                <Text type="secondary">{jewelryTypeLabel(active.jewelryType)} · {orderStatusLabel(active.orderStatus || '')}</Text>
              </div>
              <Tag color={active.reviewed ? 'gold' : 'default'}>{active.reviewed ? '已评' : '待评'}</Tag>
            </div>
            <div className="settle-facts">
              <Tag>建模师 {active.modelerName || '未指派'}</Tag>
              <Tag>建模日 {active.modeledAt ? dayjs(active.modeledAt).format('YYYY-MM-DD') : '—'}</Tag>
              <Tag>{active.modelConfirmed ? '客户已确认模型' : '模型未确认'}</Tag>
              {active.weight != null ? <Tag>克重 {active.weight}</Tag> : null}
            </div>
            <div className="settle-images">
              <div>
                <h3>设计图 · 订单自动带出</h3>
                <Image.PreviewGroup>
                  <div className="settle-images__row">
                    {(active.designImages || []).length === 0 ? <Text type="secondary">这件还没有设计图</Text> : null}
                    {(active.designImages || []).map((url) => (
                      <Image key={url} src={imageSrc(url)} alt="设计图" />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
              <div>
                <h3>建模效果图 · 订单自动带出</h3>
                <Image.PreviewGroup>
                  <div className="settle-images__row">
                    {(active.modelEffectImages || []).length === 0 ? <Text type="secondary">还没有效果图</Text> : null}
                    {(active.modelEffectImages || []).map((url) => (
                      <Image key={url} src={imageSrc(url)} alt="效果图" />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            </div>
            {(active.modelFiles || []).length > 0 ? (
              <Paragraph>
                源文件：
                {(active.modelFiles || []).map((file, index) => (
                  <a key={`${file.url}-${index}`} href={imageSrc(file.url)} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>
                    {file.name || '源文件'}
                  </a>
                ))}
              </Paragraph>
            ) : null}
            {(active.processes || []).length > 0 || (active.stones || []).length > 0 ? (
              <Paragraph type="secondary">
                设计里已写的工艺和宝石，只作对照，不直接计分：
                {[...(active.processes || []), ...(active.stones || [])].join('、')}
              </Paragraph>
            ) : null}
            {active.modelNotes ? <Paragraph>建模备注：{active.modelNotes}</Paragraph> : null}

            <div className="settle-score">
              <div>
                <h3>主体结构复杂度</h3>
                <div className="settle-options">
                  {STRUCTURES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`settle-option${draft.structureComplexity === option.value ? ' is-on' : ''}`}
                      onClick={() => patch({ structureComplexity: option.value })}
                    >
                      <b>{option.value}</b>
                      <span>+{option.points}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>是否含纹理</h3>
                <div className="settle-options">
                  {TEXTURES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`settle-option${draft.textureLevel === option.value ? ' is-on' : ''}`}
                      onClick={() => patch({ textureLevel: option.value })}
                    >
                      <b>{option.value}</b>
                      <span>+{option.points}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>计入分数的件数</h3>
                <div className="settle-counts">
                  {COUNTS.map((field) => (
                    <label key={field.key} className="settle-count">
                      <span>{field.label}<small>每个 +{field.points}</small></span>
                      <InputNumber
                        min={0}
                        max={99}
                        value={Number(draft[field.key] || 0)}
                        onChange={(value) => patch({ [field.key]: Number(value || 0) } as Partial<ModelSettlementDraft>)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="settle-muted">
                <h3>先记下，当前公式不计分</h3>
                <div className="settle-counts">
                  {PARKED.map((field) => (
                    <label key={field.key} className="settle-count">
                      <span>{field.label}<small>飞书公式未计入</small></span>
                      <InputNumber
                        min={0}
                        max={99}
                        value={Number(draft[field.key] || 0)}
                        onChange={(value) => patch({ [field.key]: Number(value || 0) } as Partial<ModelSettlementDraft>)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <Input.TextArea
                rows={2}
                placeholder="评语，可选"
                value={draft.note || ''}
                onChange={(event) => patch({ note: event.target.value })}
              />
            </div>
            <div className="settle-footer">
              <div className="settle-total">
                {score}
                <span>折算系数 = 底分 10 + 主体 + 纹理 + 件数</span>
              </div>
              <Space>
                <Button loading={saving} onClick={() => void save(false)}>只保存</Button>
                <Button type="primary" loading={saving} onClick={() => void save(true)}>保存并下一件</Button>
              </Space>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default ModelSettlementDesk;
