import { Button, Input, InputNumber, Select } from 'antd';
import { StoneShape, StoneType, type StoneInfo } from '@/types/order';

export type StoneDraft = {
  stoneType: string;
  shape: string;
  size: string;
  quantity: number | null;
  weight: number | null;
  price: number | null;
  notes: string;
};

const STONE_TYPES = [
  { value: StoneType.DIAMOND, label: '钻石' },
  { value: StoneType.RUBY, label: '红宝石' },
  { value: StoneType.SAPPHIRE, label: '蓝宝石' },
  { value: StoneType.EMERALD, label: '翡翠' },
  { value: StoneType.JADE, label: '玉石' },
  { value: StoneType.PEARL, label: '珍珠' },
  { value: StoneType.CRYSTAL, label: '水晶' },
  { value: StoneType.OTHER, label: '其他' },
];

const SHAPES = [
  { value: StoneShape.ROUND, label: '圆形' },
  { value: StoneShape.OVAL, label: '椭圆' },
  { value: StoneShape.PEAR, label: '梨形' },
  { value: StoneShape.MARQUISE, label: '马眼' },
  { value: StoneShape.HEART, label: '心形' },
  { value: StoneShape.PRINCESS, label: '公主方' },
  { value: StoneShape.CUSHION, label: '垫形' },
  { value: StoneShape.EMERALD_CUT, label: '祖母绿形' },
  { value: StoneShape.BAGUETTE, label: '长阶梯' },
  { value: StoneShape.OTHER, label: '其他' },
];

export function emptyStone(): StoneDraft {
  return { stoneType: StoneType.OTHER, shape: StoneShape.ROUND, size: '', quantity: 1, weight: null, price: null, notes: '' };
}

export function stonesFromSaved(raw: unknown): StoneDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      stoneType: String(row.stoneType || StoneType.OTHER),
      shape: String(row.shape || StoneShape.OTHER),
      size: String(row.size || ''),
      quantity: row.quantity == null || row.quantity === '' ? null : Number(row.quantity),
      weight: row.weight == null || row.weight === '' ? null : Number(row.weight),
      price: row.price == null || row.price === '' ? null : Number(row.price),
      notes: String(row.notes || ''),
    };
  });
}

export function stonesForSave(rows: StoneDraft[]): StoneInfo[] {
  return rows
    .filter((row) => row.size.trim() || row.notes.trim() || (row.quantity != null && row.quantity > 0))
    .map((row) => ({
      stoneType: (row.stoneType || StoneType.OTHER) as StoneType,
      shape: (row.shape || StoneShape.OTHER) as StoneShape,
      size: row.size.trim(),
      quantity: row.quantity ?? 0,
      weight: row.weight,
      price: row.price ?? 0,
      notes: row.notes.trim(),
    }));
}

export function StoneEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: StoneDraft[];
  onChange: (rows: StoneDraft[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<StoneDraft>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };
  return (
    <div className="stone-editor">
      {rows.length === 0 ? <p className="stone-editor__empty">还没有石料。没有镶石可以不填。</p> : null}
      {rows.map((row, index) => (
        <div className="stone-editor__row" key={index}>
          <Select
            disabled={disabled}
            value={row.stoneType}
            options={STONE_TYPES}
            onChange={(value) => update(index, { stoneType: value })}
          />
          <Select
            disabled={disabled}
            value={row.shape}
            options={SHAPES}
            onChange={(value) => update(index, { shape: value })}
          />
          <Input disabled={disabled} placeholder="尺寸" value={row.size} onChange={(e) => update(index, { size: e.target.value })} />
          <InputNumber disabled={disabled} min={0} placeholder="数量" value={row.quantity ?? undefined} onChange={(value) => update(index, { quantity: value })} />
          <InputNumber disabled={disabled} min={0} step={0.01} placeholder="重量" value={row.weight ?? undefined} onChange={(value) => update(index, { weight: value })} />
          <InputNumber disabled={disabled} min={0} step={0.01} placeholder="价格" value={row.price ?? undefined} onChange={(value) => update(index, { price: value })} />
          <Input disabled={disabled} placeholder="备注" value={row.notes} onChange={(e) => update(index, { notes: e.target.value })} />
          <Button disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}>删除</Button>
        </div>
      ))}
      <Button disabled={disabled} onClick={() => onChange([...rows, emptyStone()])}>添加石料</Button>
    </div>
  );
}
