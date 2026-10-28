import api from './api';

export type ModelSettlementFile = {
  name?: string | null;
  url?: string | null;
};

export type ModelSettlementItem = {
  pieceId: number;
  orderId: number;
  orderNumber?: string | null;
  orderStatus?: string | null;
  pieceName?: string | null;
  pieceSeq?: number | null;
  jewelryType?: string | null;
  modelerId?: number | null;
  modelerName?: string | null;
  modeledAt?: string | null;
  modelConfirmed?: boolean;
  weight?: number | null;
  modelNotes?: string | null;
  designImages?: string[];
  modelEffectImages?: string[];
  modelFiles?: ModelSettlementFile[];
  processes?: string[];
  stones?: string[];
  reviewed?: boolean;
  structureComplexity?: string | null;
  textureLevel?: string | null;
  simpleComponentCount: number;
  regularCurveComponentCount: number;
  irregularCurveComponentCount: number;
  highDetailComponentCount: number;
  simpleInlayCount: number;
  specialInlayCount: number;
  linearStoneCount: number;
  freeformStoneCount: number;
  coefficient: number;
  note?: string | null;
  reviewedAt?: string | null;
};

export type ModelSettlementDraft = {
  structureComplexity?: string | null;
  textureLevel?: string | null;
  simpleComponentCount: number;
  regularCurveComponentCount: number;
  irregularCurveComponentCount: number;
  highDetailComponentCount: number;
  simpleInlayCount: number;
  specialInlayCount: number;
  linearStoneCount: number;
  freeformStoneCount: number;
  note?: string | null;
};

const STRUCTURE_POINTS: Record<string, number> = {
  无主体: 0,
  '普通构型（素圈）': 3,
  '异形（单圈形状微调）': 15,
  '异形（存在镂空、形状缠绕）': 30,
  '异形（戒圈完全重构）': 45,
};

const TEXTURE_POINTS: Record<string, number> = {
  不含纹理: 0,
  含纹理: 10,
  多种纹理: 20,
};

/** 与后端 ModelSettlementScore、飞书折算系数公式一致。 */
export function modelCoefficient(draft: ModelSettlementDraft): number {
  const structure = draft.structureComplexity ? STRUCTURE_POINTS[draft.structureComplexity] ?? 0 : 0;
  const texture = draft.textureLevel ? TEXTURE_POINTS[draft.textureLevel] ?? 0 : 0;
  return 10
    + structure
    + texture
    + draft.simpleComponentCount * 3
    + draft.regularCurveComponentCount * 15
    + draft.irregularCurveComponentCount * 30
    + draft.simpleInlayCount * 5
    + draft.specialInlayCount * 10
    + draft.linearStoneCount * 15;
}

export function draftFromItem(item: ModelSettlementItem): ModelSettlementDraft {
  return {
    structureComplexity: item.structureComplexity || null,
    textureLevel: item.textureLevel || null,
    simpleComponentCount: item.simpleComponentCount || 0,
    regularCurveComponentCount: item.regularCurveComponentCount || 0,
    irregularCurveComponentCount: item.irregularCurveComponentCount || 0,
    highDetailComponentCount: item.highDetailComponentCount || 0,
    simpleInlayCount: item.simpleInlayCount || 0,
    specialInlayCount: item.specialInlayCount || 0,
    linearStoneCount: item.linearStoneCount || 0,
    freeformStoneCount: item.freeformStoneCount || 0,
    note: item.note || '',
  };
}

export const settlementService = {
  listModel(): Promise<ModelSettlementItem[]> {
    return api.get('/admin/settlements/model');
  },
  saveModel(pieceId: number, draft: ModelSettlementDraft): Promise<ModelSettlementItem> {
    return api.put(`/admin/settlements/model/${pieceId}`, draft);
  },
};
