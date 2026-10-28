import { Image, Tag } from 'antd';
import { API_ORIGIN } from '@/services/api';
import { handSizeFieldMeta, jewelryTypeLabel } from '@/constants/jewelryType';
import type { OrderDesignInfo, OrderPieceInfo, ProcessInfo, StoneInfo } from '@/types/order';
import './PieceDesignBrief.css';

const MATERIAL_LABEL: Record<string, string> = {
  SILVER_925: '925银',
  PURE_SILVER: '足银999',
  PURE_GOLD: '足金',
  PLATINUM_950: '铂金950',
  K9: '9K',
  K14: '14K',
  K18: '18K',
  K_OTHER: 'K金（其他）',
  K_GOLD: 'K金',
  COPPER: '铜',
  OTHER: '其他',
};

const PROCESS_LABEL: Record<string, string> = {
  ENAMEL: '珐琅',
  WIRE_DRAWING: '拉丝',
  SAND_BLASTING: '喷砂',
  NAIL_SAND: '钉砂',
  OTHER: '其他',
};

const STONE_LABEL: Record<string, string> = {
  DIAMOND: '钻石',
  RUBY: '红宝石',
  SAPPHIRE: '蓝宝石',
  EMERALD: '翡翠',
  JADE: '玉石',
  PEARL: '珍珠',
  CRYSTAL: '水晶',
  OTHER: '其他',
};

function imageSrc(url: string) {
  const value = url.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return value;
}

function labelOf(map: Record<string, string>, value?: string | null) {
  if (!value) return '';
  return map[value] || value;
}

function processLine(process: ProcessInfo) {
  const name = process.customProcess?.trim() || labelOf(PROCESS_LABEL, process.processType);
  return [name, process.notes?.trim()].filter(Boolean).join(' · ');
}

function stoneLine(stone: StoneInfo) {
  return [
    labelOf(STONE_LABEL, stone.stoneType),
    stone.size,
    stone.quantity ? `${stone.quantity}颗` : '',
    stone.notes?.trim(),
  ].filter(Boolean).join(' · ');
}

function ImageRow({ urls, alt }: { urls: string[]; alt: string }) {
  const srcs = urls.map(imageSrc).filter(Boolean);
  if (!srcs.length) return null;
  return (
    <Image.PreviewGroup>
      <div className="piece-design__images">
        {srcs.map((src, index) => (
          <Image
            key={`${src}-${index}`}
            src={src}
            alt={`${alt} ${index + 1}`}
            width={112}
            height={112}
            style={{ objectFit: 'contain', background: '#fff', borderRadius: 8 }}
          />
        ))}
      </div>
    </Image.PreviewGroup>
  );
}

function PieceBlock({
  piece,
  active,
  onSelect,
}: {
  piece: OrderPieceInfo;
  active: boolean;
  onSelect?: (pieceId: number) => void;
}) {
  const design: OrderDesignInfo | undefined = piece.design;
  const sizeMeta = handSizeFieldMeta(piece.jewelryType);
  const designImages = design?.designImages || [];
  const engravingImages = design?.engravingImages || [];
  const references = piece.referenceImages || [];
  const processes = (design?.processInfo || []).map(processLine).filter(Boolean);
  const stones = (design?.stoneInfo || []).map(stoneLine).filter(Boolean);
  return (
    <section
      className={`piece-design__card${active ? ' is-active' : ''}`}
      onClick={() => onSelect?.(piece.id)}
    >
      <header className="piece-design__head">
        <strong>{piece.name || `单件${piece.seq}`}</strong>
        {piece.jewelryType ? <span>{jewelryTypeLabel(piece.jewelryType)}</span> : null}
        <Tag color={piece.designConfirmed ? 'success' : 'default'}>
          {piece.designConfirmed ? '设计已确认' : '设计未确认'}
        </Tag>
      </header>
      <dl className="piece-design__meta">
        <div><dt>设计师</dt><dd>{design?.designerName || '—'}</dd></div>
        <div><dt>材质</dt><dd>{labelOf(MATERIAL_LABEL, design?.materialType) || design?.materialDetail || '—'}</dd></div>
        {sizeMeta.visible ? (
          <div><dt>{sizeMeta.label}</dt><dd>{design?.handSize || '—'}</dd></div>
        ) : null}
        <div><dt>字印</dt><dd>{design?.engravingText || '—'}</dd></div>
      </dl>
      {design?.designNotes?.trim() ? (
        <p className="piece-design__notes">{design.designNotes.trim()}</p>
      ) : null}
      {processes.length > 0 ? <p className="piece-design__extra">工艺：{processes.join('；')}</p> : null}
      {stones.length > 0 ? <p className="piece-design__extra">宝石：{stones.join('；')}</p> : null}
      <div className="piece-design__block">
        <div className="piece-design__label">设计图</div>
        {designImages.length > 0
          ? <ImageRow urls={designImages} alt={`${piece.name}设计图`} />
          : <p className="piece-design__empty">这件还没有设计图</p>}
      </div>
      {engravingImages.length > 0 ? (
        <div className="piece-design__block">
          <div className="piece-design__label">字印图</div>
          <ImageRow urls={engravingImages} alt={`${piece.name}字印图`} />
        </div>
      ) : null}
      {references.length > 0 ? (
        <div className="piece-design__block">
          <div className="piece-design__label">客户参考图</div>
          <ImageRow urls={references} alt={`${piece.name}参考图`} />
        </div>
      ) : null}
    </section>
  );
}

export function PieceDesignCard({
  piece,
  active,
  onSelect,
}: {
  piece: OrderPieceInfo;
  active?: boolean;
  onSelect?: (pieceId: number) => void;
}) {
  return <PieceBlock piece={piece} active={!!active} onSelect={onSelect} />;
}

export function PieceDesignBrief({
  pieces,
  activePieceId,
  onSelectPiece,
}: {
  pieces: OrderPieceInfo[];
  activePieceId?: number | null;
  onSelectPiece?: (pieceId: number) => void;
}) {
  if (!pieces.length) {
    return <p className="piece-design__empty">暂无单件设计信息</p>;
  }
  return (
    <div className="piece-design">
      <div className="piece-design__title">各单件设计稿</div>
      <p className="piece-design__hint">点开图片可放大。点某一件会切到该件的建模表单。</p>
      {pieces.map((piece) => (
        <PieceBlock
          key={piece.id}
          piece={piece}
          active={piece.id === activePieceId}
          onSelect={onSelectPiece}
        />
      ))}
    </div>
  );
}
