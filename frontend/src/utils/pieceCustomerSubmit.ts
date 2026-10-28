import type { OrderPieceInfo } from '@/types/order';

export type PieceStage = 'design' | 'model';

export function pieceHasCustomerDesignReject(piece: OrderPieceInfo): boolean {
  return !piece.designConfirmed && !!piece.design?.lastCustomerDesignRejectReason?.trim();
}

export function pieceHasCustomerModelReject(piece: OrderPieceInfo): boolean {
  return !piece.modelConfirmed && !!piece.model?.lastCustomerModelRejectReason?.trim();
}

/** 按单件顺序，第一件仍处于客户驳回、待修改的单件。 */
export function firstCustomerRejectPieceId(
  pieces: OrderPieceInfo[] | undefined,
  stage: PieceStage,
): number | null {
  const hit = (pieces ?? []).find((piece) =>
    stage === 'design' ? pieceHasCustomerDesignReject(piece) : pieceHasCustomerModelReject(piece),
  );
  return hit?.id ?? null;
}

export function hasUnconfirmedPiece(pieces: OrderPieceInfo[] | undefined, stage: PieceStage): boolean {
  return (pieces ?? []).some((piece) => (stage === 'design' ? !piece.designConfirmed : !piece.modelConfirmed));
}

/** 可以发给客户确认的设计件：尚未确认，或已被建模师驳回、需要客户再看一次。 */
export function hasDesignPiecesForCustomerSubmit(pieces: OrderPieceInfo[] | undefined): boolean {
  return (pieces ?? []).some(
    (piece) => !piece.designConfirmed || !!piece.model?.lastRejectToDesignerMessage?.trim(),
  );
}

/**
 * 尚未被客户确认、且还没有成果图的单件名。
 * 当前正在编辑的未确认件用界面上的图片，其余件用已保存的图。
 */
export function piecesMissingCustomerSubmitImages(
  pieces: OrderPieceInfo[] | undefined,
  stage: PieceStage,
  activePieceId: number | null,
  activeImageUrls: string[],
): string[] {
  const missing: string[] = [];
  for (const piece of pieces ?? []) {
    const confirmed = stage === 'design' ? !!piece.designConfirmed : !!piece.modelConfirmed;
    const modelerSentBack = stage === 'design' && !!piece.model?.lastRejectToDesignerMessage?.trim();
    if (confirmed && !modelerSentBack) continue;
    const saved = stage === 'design' ? piece.design?.designImages : piece.model?.modelEffectImages;
    const urls = piece.id === activePieceId ? activeImageUrls : (saved ?? []);
    const ready = (urls || []).some((url) => String(url || '').trim());
    if (!ready) missing.push(piece.name || '未命名单件');
  }
  return missing;
}

export function sameImageList(left?: string[] | null, right?: string[] | null): boolean {
  const norm = (list?: string[] | null) =>
    (list ?? []).map((url) => String(url || '').trim()).filter(Boolean);
  const a = norm(left);
  const b = norm(right);
  if (a.length !== b.length) return false;
  return a.every((url, index) => url === b[index]);
}
