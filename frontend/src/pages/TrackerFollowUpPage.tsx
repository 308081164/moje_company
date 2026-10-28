import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Empty,
  Image,
  Modal,
  Spin,
  Tabs,
  Typography,
  message,
} from 'antd';
import { CameraOutlined, PictureOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import { YunexpressDesk } from '@/pages/orders/YunexpressDesk';
import { API_ORIGIN } from '@/services/api';
import type {
  OrderInfo,
  OrderPieceInfo,
  OrderProductionFollowLogDto,
  ProductionPieceCard,
  ProductionPoolPhoto,
  ProductionProcessSummary,
} from '@/types/order';

const { Text, Title } = Typography;

type FollowTab = 'process' | 'finish' | 'ship';

function followTabFromQuery(value: string | null): FollowTab {
  if (value === 'finish' || value === 'ship') return value;
  return 'process';
}

const PROCESSES = [
  { code: 'WAX', label: '喷蜡' },
  { code: 'CAST', label: '倒模浇筑' },
  { code: 'SETTING', label: '宝石镶嵌' },
  { code: 'ENAMEL', label: '烤珐琅' },
  { code: 'PLATING', label: '电镀' },
  { code: 'BRUSH', label: '拉丝' },
  { code: 'SAND', label: '喷砂' },
  { code: 'FINISH_MOLD', label: '执模' },
  { code: 'POLISH', label: '抛光' },
  { code: 'MICRO_PAVE', label: '钉砂' },
];

function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${API_ORIGIN}${path}`;
}

function firstResolvedImage(urls?: string[] | null): string {
  if (!urls?.length) return '';
  for (const raw of urls) {
    const resolved = resolveMediaUrl(raw);
    if (resolved) return resolved;
  }
  return '';
}

/** 单件优先用建模效果图，没有时用设计图。订单级字段只补到对应单件上。 */
function previewUrlForPiece(order: OrderInfo, piece: OrderPieceInfo): string {
  const own =
    firstResolvedImage(piece.model?.modelEffectImages) ||
    firstResolvedImage(piece.design?.designImages);
  if (own) return own;
  if (order.modelInfo?.pieceId != null && order.modelInfo.pieceId === piece.id) {
    const fromOrder = firstResolvedImage(order.modelInfo.modelEffectImages);
    if (fromOrder) return fromOrder;
  }
  if (order.designInfo?.pieceId != null && order.designInfo.pieceId === piece.id) {
    const fromOrder = firstResolvedImage(order.designInfo.designImages);
    if (fromOrder) return fromOrder;
  }
  if ((order.pieces?.length ?? 0) === 1) {
    return (
      firstResolvedImage(order.modelInfo?.modelEffectImages) ||
      firstResolvedImage(order.designInfo?.designImages)
    );
  }
  return '';
}

interface FinishPiecePreview {
  key: string;
  name: string;
  url: string;
  orderId: number;
  pieceId: number | null;
}

interface PieceTimelineTarget {
  orderId: number;
  pieceId: number | null;
  pieceName: string;
  orderNumber?: string;
}

/** 按实际完成时间先后，不用固定工艺顺序重排。 */
function compareFollowLogs(a: OrderProductionFollowLogDto, b: OrderProductionFollowLogDto): number {
  const ta = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
  const tb = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
  return (a.id || 0) - (b.id || 0);
}

function logsForPiece(rows: OrderProductionFollowLogDto[], pieceId: number | null): OrderProductionFollowLogDto[] {
  const tagged = pieceId == null
    ? rows.filter((log) => log.pieceId == null)
    : rows.filter((log) => log.pieceId === pieceId);
  const chosen = pieceId == null && tagged.length === 0 ? rows.slice() : tagged.slice();
  chosen.sort(compareFollowLogs);
  return chosen;
}

function formatLogTime(value?: string): string {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
}

function finishPiecePreviews(order: OrderInfo): FinishPiecePreview[] {
  const pieces = order.pieces ?? [];
  const orderId = order.baseInfo.id;
  if (pieces.length === 0) {
    const url =
      firstResolvedImage(order.modelInfo?.modelEffectImages) ||
      firstResolvedImage(order.designInfo?.designImages);
    if (!url) return [];
    return [{ key: `order-${orderId}`, name: '单件', url, orderId, pieceId: null }];
  }
  return pieces.map((piece, index) => ({
    key: String(piece.id ?? `${orderId}-${index}`),
    name: (piece.name || '').trim() || `单件${piece.seq || index + 1}`,
    url: previewUrlForPiece(order, piece),
    orderId,
    pieceId: piece.id ?? null,
  }));
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

function isAcceptedImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (IMAGE_EXT.test(file.name || '')) return true;
  // 安卓 WebView 经常不给相机文件带 MIME，空类型或二进制也要收下。
  return (!type || type === 'application/octet-stream') && file.size > 0;
}

function markFileIntake(status: 'ok' | 'bad') {
  (window as unknown as { __mojeFileIntake?: string }).__mojeFileIntake = status;
}

function shippingLines(order: OrderInfo): string[] {
  const base = order.baseInfo;
  if (!base.shippingRecipient && !base.shippingPhone && !base.shippingAddress && !base.shippingCountry) {
    return [];
  }
  return [
    base.shippingRecipient ? `收货人：${base.shippingRecipient}` : '',
    base.shippingPhone ? `电话：${base.shippingPhone}` : '',
    base.shippingCountry ? `国家/地区：${base.shippingCountry}` : '',
    base.shippingAddress ? `地址：${base.shippingAddress}` : '',
    `邮编：${base.shippingPostalCode || '未填'}`,
  ].filter(Boolean);
}

function errorText(error: unknown): string {
  const err = error as {
    message?: string;
    response?: { status?: number; data?: { message?: unknown; detail?: unknown; error?: unknown } };
    request?: unknown;
  };
  const data = err?.response?.data;
  const server = [data?.message, data?.detail, data?.error].find(
    (item) => typeof item === 'string' && item.trim()
  );
  if (typeof server === 'string') return server;
  if (err?.response?.status) return `服务器返回 HTTP ${err.response.status}`;
  if (err?.request && !err.response) return '网络请求失败，照片没有保存到服务器';
  if (err?.message) return err.message;
  return '请重试';
}

const TrackerFollowUpPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const followTab = followTabFromQuery(searchParams.get('tab'));
  const [mode, setMode] = useState<'home' | 'capture' | 'sync'>('home');
  const [processCode, setProcessCode] = useState<string>('WAX');
  const [summaries, setSummaries] = useState<ProductionProcessSummary[]>([]);
  const [pieces, setPieces] = useState<ProductionPieceCard[]>([]);
  const [photos, setPhotos] = useState<ProductionPoolPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [timelineTarget, setTimelineTarget] = useState<PieceTimelineTarget | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<OrderProductionFollowLogDto[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [shipOrders, setShipOrders] = useState<OrderInfo[]>([]);
  const [shippedOrders, setShippedOrders] = useState<OrderInfo[]>([]);
  const [shipDrafts, setShipDrafts] = useState<Record<number, { tracking: string; carrier: string }>>({});
  const [shippedDrafts, setShippedDrafts] = useState<Record<number, { tracking: string; carrier: string }>>({});
  const [shippingBusyId, setShippingBusyId] = useState<number | null>(null);
  const [shipmentEditBusy, setShipmentEditBusy] = useState<string | null>(null);
  const dragPhotoId = useRef<number | null>(null);
  const [ghost, setGhost] = useState<{ url: string; x: number; y: number } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  const processLabel = PROCESSES.find((p) => p.code === processCode)?.label || processCode;

  const loadSummary = useCallback(async () => {
    try {
      setSummaries(await orderService.listProductionProcesses());
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    }
  }, []);

  const loadBoard = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const board = await orderService.productionSyncBoard(code);
      setPieces(board.pieces || []);
      setPhotos(board.photos || []);
      const urls: Record<number, string> = {};
      await Promise.all(
        (board.photos || []).map(async (photo) => {
          try {
            urls[photo.fileId] = await orderService.previewFile(photo.fileId);
          } catch {
            /* 单张失败不影响其余 */
          }
        })
      );
      setPhotoUrls(urls);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await orderService.workbenchTrackerProducing(0, 50);
      setOrders(res?.content ?? []);
    } catch {
      setOrders([]);
    }
  }, []);

  const loadShipping = useCallback(async () => {
    try {
      const res = await orderService.workbenchTrackerToShip(0, 50);
      setShipOrders(res?.content ?? []);
    } catch {
      setShipOrders([]);
    }
    try {
      const res = await orderService.workbenchTrackerShipped(0, 50);
      const rows = res?.content ?? [];
      setShippedOrders(rows);
      setShippedDrafts((prev) => {
        const next = { ...prev };
        for (const order of rows) {
          const id = order.baseInfo.id;
          if (!next[id]) {
            next[id] = {
              tracking: order.shipment?.trackingNumber || '',
              carrier: order.shipment?.carrierName || '',
            };
          }
        }
        return next;
      });
    } catch {
      setShippedOrders([]);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadOrders();
    void loadShipping();
  }, [loadSummary, loadOrders, loadShipping]);

  useEffect(() => {
    const onFileError = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const text = typeof detail === 'string' && detail.trim()
        ? detail
        : '照片没有交回页面，请重试';
      message.error(text, 6);
    };
    window.addEventListener('moje-file-error', onFileError);
    return () => window.removeEventListener('moje-file-error', onFileError);
  }, []);

  useEffect(() => {
    return () => {
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingUrls]);

  const selectFollowTab = useCallback((next: FollowTab) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'process') params.delete('tab');
      else params.set('tab', next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const backToProcess = useCallback(() => {
    setMode('home');
    selectFollowTab('process');
  }, [selectFollowTab]);

  const openCapture = (code: string) => {
    setProcessCode(code);
    setPendingFiles([]);
    setPendingUrls([]);
    setMode('capture');
  };

  const openSync = (code: string) => {
    setProcessCode(code);
    setMode('sync');
    void loadBoard(code);
  };

  const addPending = (list: FileList | File[] | null) => {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    // 整批都是空文件时先不弹错。壳会再把照片字节写回来；写不回来才会提示。
    if (incoming.every((file) => file.size <= 0)) {
      markFileIntake('bad');
      return;
    }
    const accepted: File[] = [];
    const errors: string[] = [];
    for (const file of incoming) {
      if (file.size <= 0) {
        errors.push(`「${file.name || '照片'}」内容为空，没有从相机读到文件`);
        continue;
      }
      if (!isAcceptedImage(file)) {
        errors.push(`「${file.name || '文件'}」不是图片，无法保存`);
        continue;
      }
      accepted.push(file);
    }
    if (errors.length) {
      message.error(errors.slice(0, 3).join('；'), 6);
    }
    markFileIntake(accepted.length ? 'ok' : 'bad');
    if (!accepted.length) return;
    setPendingFiles((prev) => [...prev, ...accepted]);
    setPendingUrls((prev) => [...prev, ...accepted.map((file) => URL.createObjectURL(file))]);
  };

  const savePending = async () => {
    if (!pendingFiles.length) {
      message.warning('请先拍照或从相册选择图片');
      return;
    }
    setUploading(true);
    let saved = 0;
    try {
      for (let i = 0; i < pendingFiles.length; i += 1) {
        const file = pendingFiles[i];
        if (file.size <= 0) {
          throw new Error(`「${file.name || '照片'}」内容为空，没有上传`);
        }
        await orderService.uploadProcessPhoto(processCode, file);
        saved += 1;
      }
      message.success(`已保存 ${saved} 张${processLabel}照片`);
      pendingUrls.forEach((url) => URL.revokeObjectURL(url));
      setPendingFiles([]);
      setPendingUrls([]);
      await loadSummary();
    } catch (e: unknown) {
      if (saved > 0) {
        pendingUrls.slice(0, saved).forEach((url) => URL.revokeObjectURL(url));
        setPendingFiles(pendingFiles.slice(saved));
        setPendingUrls(pendingUrls.slice(saved));
        message.error(`已保存 ${saved} 张，其余没有保存：${errorText(e)}`, 6);
        await loadSummary();
      } else {
        message.error(`保存失败：${errorText(e)}`, 6);
      }
    } finally {
      setUploading(false);
    }
  };

  const matchPhoto = async (photoId: number, piece: ProductionPieceCard) => {
    try {
      await orderService.matchProcessPhoto({
        photoId,
        orderId: piece.orderId,
        pieceId: piece.pieceId,
      });
      message.success('该订单生产状态已更新');
      setPieces((prev) => prev.filter((item) => item.pieceId !== piece.pieceId));
      setPhotos((prev) => prev.filter((item) => item.id !== photoId));
      await loadBoard(processCode);
      await loadSummary();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    }
  };

  const onPhotoPointerDown = (event: React.PointerEvent<HTMLButtonElement>, photo: ProductionPoolPhoto) => {
    dragPhotoId.current = photo.id;
    event.currentTarget.setPointerCapture(event.pointerId);
    const url = photoUrls[photo.fileId];
    if (url) setGhost({ url, x: event.clientX, y: event.clientY });
  };

  const onPhotoPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPhotoId.current == null) return;
    setGhost((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : prev));
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target?.closest('[data-piece-key]') as HTMLElement | null;
    setOverKey(card?.dataset.pieceKey || null);
  };

  const onPhotoPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const photoId = dragPhotoId.current;
    dragPhotoId.current = null;
    setGhost(null);
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target?.closest('[data-piece-key]') as HTMLElement | null;
    const key = card?.dataset.pieceKey;
    setOverKey(null);
    if (photoId == null || !key) return;
    const piece = pieces.find((item) => `${item.orderId}-${item.pieceId}` === key);
    if (piece) void matchPhoto(photoId, piece);
  };

  const openPieceTimeline = useCallback(async (target: PieceTimelineTarget) => {
    setTimelineTarget(target);
    setTimelineLoading(true);
    setTimelineError('');
    setTimelineLogs([]);
    try {
      const rows = await orderService.listProductionFollowLogs(target.orderId);
      const list = Array.isArray(rows) ? rows : [];
      setTimelineLogs(logsForPiece(list, target.pieceId));
    } catch (e: unknown) {
      setTimelineError(`加载失败：${errorText(e)}`);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const confirmDiscardPhoto = (photo: ProductionPoolPhoto) => {
    Modal.confirm({
      title: '删除这张未匹配照片？',
      content: '删除后不可恢复，这张照片会从照片池中移除。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await orderService.discardProcessPhoto(photo.id);
        } catch (e: unknown) {
          message.error(`删除失败：${errorText(e)}`);
          throw e;
        }
        setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
        setPhotoUrls((prev) => {
          if (!(photo.fileId in prev)) return prev;
          const next = { ...prev };
          delete next[photo.fileId];
          return next;
        });
        message.success('已从照片池删除');
        try {
          await loadSummary();
        } catch {
          /* 未匹配数量刷新失败不影响已删除 */
        }
      },
    });
  };

  const confirmComplete = (order: OrderInfo) => {
    Modal.confirm({
      title: '确认生产完成？',
      content: '确认后订单进入「已完成」，并在客户订单群里请客户填写收货信息。',
      okText: '确认完成',
      cancelText: '取消',
      onOk: async () => {
        await orderService.completeProduction(order.baseInfo.id);
        message.success('生产已完成，已请客户填写收货信息');
        await loadOrders();
        await loadShipping();
        if (mode === 'sync') await loadBoard(processCode);
      },
    });
  };

  const patchShipDraft = (orderId: number, patch: Partial<{ tracking: string; carrier: string }>) => {
    setShipDrafts((prev) => {
      const current = prev[orderId] || { tracking: '', carrier: '' };
      return { ...prev, [orderId]: { ...current, ...patch } };
    });
  };

  const patchShippedDraft = (orderId: number, patch: Partial<{ tracking: string; carrier: string }>) => {
    setShippedDrafts((prev) => {
      const current = prev[orderId] || { tracking: '', carrier: '' };
      return { ...prev, [orderId]: { ...current, ...patch } };
    });
  };

  const readShippedDraft = (orderId: number) => {
    const order = shippedOrders.find((item) => item.baseInfo.id === orderId);
    const draft = shippedDrafts[orderId] || {
      tracking: order?.shipment?.trackingNumber || '',
      carrier: order?.shipment?.carrierName || '',
    };
    return {
      trackingNumber: draft.tracking.trim(),
      carrierName: draft.carrier.trim(),
    };
  };

  const applyShipmentUpdate = (orderId: number, shipment: OrderInfo['shipment']) => {
    if (!shipment) return;
    setShippedOrders((prev) => prev.map((order) => (
      order.baseInfo.id === orderId ? { ...order, shipment } : order
    )));
    setShippedDrafts((prev) => ({
      ...prev,
      [orderId]: {
        tracking: shipment.trackingNumber || '',
        carrier: shipment.carrierName || '',
      },
    }));
  };

  const submitShip = async (orderId: number) => {
    const draft = shipDrafts[orderId] || { tracking: '', carrier: '' };
    const trackingNumber = draft.tracking.trim();
    if (!trackingNumber) {
      message.warning('请填写国际物流单号');
      return;
    }
    setShippingBusyId(orderId);
    try {
      await orderService.shipOrder(orderId, {
        trackingNumber,
        carrierName: draft.carrier.trim() || undefined,
      });
      message.success('已发货，客户可以在订单聊天里查看物流');
      setShipDrafts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await loadShipping();
    } catch (e: unknown) {
      message.error(errorText(e));
    } finally {
      setShippingBusyId(null);
    }
  };

  const submitCorrectShipment = async (orderId: number) => {
    const { trackingNumber, carrierName } = readShippedDraft(orderId);
    if (!trackingNumber) {
      message.warning('请填写国际物流单号');
      return;
    }
    const current = shippedOrders.find((order) => order.baseInfo.id === orderId)?.shipment;
    const sameNumber = trackingNumber === (current?.trackingNumber || '').trim();
    const sameCarrier = carrierName === (current?.carrierName || '').trim() || !carrierName;
    if (sameNumber && sameCarrier) {
      message.warning('物流信息没有变化');
      return;
    }
    setShipmentEditBusy(`correct:${orderId}`);
    try {
      const shipment = await orderService.correctShipment(orderId, {
        trackingNumber,
        carrierName: carrierName || undefined,
      });
      applyShipmentUpdate(orderId, shipment);
      message.success('单号已更正，已通知客户按新单号查询');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setShipmentEditBusy(null);
    }
  };

  const submitReship = async (orderId: number) => {
    const { trackingNumber, carrierName } = readShippedDraft(orderId);
    if (!trackingNumber) {
      message.warning('请填写国际物流单号');
      return;
    }
    const current = shippedOrders.find((order) => order.baseInfo.id === orderId)?.shipment;
    if (current?.trackingNumber && trackingNumber.toLowerCase() === current.trackingNumber.trim().toLowerCase()) {
      message.warning('重新发货请填写新的国际物流单号');
      return;
    }
    setShipmentEditBusy(`reship:${orderId}`);
    try {
      const shipment = await orderService.reshipOrder(orderId, {
        trackingNumber,
        carrierName: carrierName || undefined,
      });
      applyShipmentUpdate(orderId, shipment);
      message.success('已重新发货，客户会看到新的物流单号');
    } catch {
      /* 拦截器已提示 */
    } finally {
      setShipmentEditBusy(null);
    }
  };

  const confirmReship = (orderId: number) => {
    const { trackingNumber } = readShippedDraft(orderId);
    if (!trackingNumber) {
      message.warning('请填写国际物流单号');
      return;
    }
    Modal.confirm({
      title: '确认重新发货？',
      content: '这是新的一次发出。新单号会成为当前有效物流，并在客户聊天里发送「已重新发货」。订单仍保持已完成，不会退回生产中。',
      okText: '重新发货',
      cancelText: '取消',
      onOk: () => submitReship(orderId),
    });
  };

  const unmatchedOf = (code: string) => summaries.find((item) => item.code === code)?.unmatchedCount || 0;

  return (
    <div className="follow-sync">
      <style>{`
        .follow-sync { display: flex; flex-direction: column; gap: 12px; min-height: 100%; min-width: 0; max-width: 100%; }
        .follow-sync__bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .follow-tabs { min-width: 0; }
        .follow-tabs > .ant-tabs-nav { margin-bottom: 12px; }
        .follow-tabs .ant-tabs-nav-wrap { flex: 1 1 auto; min-width: 0; }
        .follow-tabs .ant-tabs-nav-list { width: 100%; }
        .follow-tabs .ant-tabs-nav-operations { display: none; }
        .follow-tabs .ant-tabs-tab {
          flex: 1 1 0;
          justify-content: center;
          margin: 0 !important;
          padding: 12px 6px;
          min-height: 44px;
          font-size: 15px;
          touch-action: manipulation;
        }
        .follow-tabs .ant-tabs-extra-content .ant-btn { position: relative; min-width: 44px; min-height: 44px; }
        @media (max-width: 520px) {
          .follow-refresh-label {
            position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
            overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
          }
        }
        .follow-pane { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        @media (max-width: 400px) {
          .follow-tabs .ant-tabs-tab { font-size: 14px; padding: 12px 2px; }
          .follow-tabs .ant-tabs-extra-content .ant-btn { padding-inline: 8px; }
        }
        .process-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 10px; }
        .process-card {
          min-height: 104px; border: 1px solid #eee; border-radius: 16px; background: #fff;
          padding: 14px; text-align: left; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;
        }
        .process-card strong { font-size: 18px; }
        .process-card span { color: #8c8c8c; font-size: 12px; }
        .process-actions { display: flex; gap: 8px; }
        .process-actions button { flex: 1; height: 36px; border-radius: 999px; border: 1px solid #e5e5e5; background: #fafafa; }
        .capture-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .capture-actions .ant-btn { height: 52px; border-radius: 14px; font-size: 16px; }
        .preview-grid, .photo-pool { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 10px; }
        .preview-grid img, .photo-drag img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; display: block; }
        .photo-tile { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .photo-drag {
          width: 100%; border: 0; padding: 0; background: transparent; touch-action: none; cursor: grab; border-radius: 12px;
        }
        .photo-drag img { pointer-events: none; user-select: none; -webkit-user-drag: none; }
        .photo-loading {
          display: grid; place-items: center; width: 100%; aspect-ratio: 1; border-radius: 12px;
          background: #f3f3f3; color: #999; font-size: 12px;
        }
        .photo-delete {
          min-height: 44px; width: 100%; border-radius: 10px; border: 1px solid #ffccc7;
          background: #fff2f0; color: #cf1322; font-size: 15px; touch-action: manipulation; cursor: pointer;
        }
        .piece-row { display: flex; gap: 10px; overflow-x: auto; padding: 4px 2px 10px; -webkit-overflow-scrolling: touch; }
        .piece-card {
          width: 108px; flex: 0 0 108px; border: 2px solid transparent; border-radius: 18px; background: #fff;
          padding: 8px; text-align: center;
        }
        .piece-card.is-over { border-color: #c9a962; background: #fffaf0; }
        .piece-open {
          display: flex; flex-direction: column; align-items: center; width: 100%;
          margin: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit;
          cursor: pointer; text-align: center;
        }
        .piece-open strong { display: block; font-size: 13px; }
        .piece-card img, .piece-card .piece-fallback {
          width: 92px; height: 92px; border-radius: 16px; object-fit: cover; background: #f3f3f3;
          display: grid; place-items: center; margin: 0 auto 6px;
        }
        .piece-card small { display: block; color: #888; font-size: 11px; }
        .piece-log-hint { margin-top: 2px; color: #8c6b2f; font-size: 12px; line-height: 1.3; }
        .drag-ghost {
          position: fixed; width: 72px; height: 72px; margin-left: -36px; margin-top: -78px;
          border-radius: 14px; object-fit: cover; pointer-events: none; z-index: 2000;
          box-shadow: 0 8px 24px rgba(0,0,0,.25);
        }
        .log-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
        .log-item { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 12px; padding: 10px 12px; }
        .finish-thumb__log {
          border: 0; background: transparent; color: #8c6b2f; font-size: 12px; line-height: 1.2;
          min-height: 36px; width: 72px; padding: 6px 0; cursor: pointer; touch-action: manipulation;
        }
        .finish-list { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .finish-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas: "meta done" "thumbs thumbs";
          gap: 8px 10px;
          align-items: center;
          background: #fff;
          border-radius: 12px;
          padding: 10px 12px;
          min-width: 0;
        }
        .finish-row__meta { grid-area: meta; min-width: 0; }
        .finish-row__no { font-weight: 600; overflow-wrap: anywhere; }
        .finish-row__done { grid-area: done; justify-self: end; flex: 0 0 auto; }
        .finish-thumbs {
          grid-area: thumbs;
          display: flex;
          gap: 10px;
          overflow-x: auto;
          min-width: 0;
          width: 100%;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
        }
        .finish-thumb {
          flex: 0 0 72px;
          width: 72px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .finish-thumb .ant-image {
          display: block;
          width: 72px;
          height: 72px;
          border-radius: 10px;
          overflow: hidden;
          background: #f3f3f3;
          line-height: 0;
        }
        .finish-thumb .ant-image-img {
          width: 72px;
          height: 72px;
          object-fit: cover;
        }
        .finish-thumb .ant-image-mask { font-size: 12px; border-radius: 10px; }
        .finish-thumb__empty {
          width: 72px;
          height: 72px;
          border-radius: 10px;
          background: #f3f3f3;
          color: #bfbfbf;
          display: grid;
          place-items: center;
          font-size: 18px;
        }
        .finish-thumb__name {
          width: 72px;
          font-size: 11px;
          line-height: 1.3;
          color: #666;
          text-align: center;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (min-width: 768px) {
          .finish-row {
            grid-template-columns: minmax(128px, 200px) minmax(0, 1fr) auto;
            grid-template-areas: "meta thumbs done";
            align-items: center;
          }
          .finish-thumbs { width: auto; }
        }
        .ship-list { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .ship-card {
          background: #fff; border-radius: 12px; padding: 12px;
          display: flex; flex-direction: column; gap: 8px; min-width: 0;
        }
        .ship-card__addr { font-size: 13px; line-height: 1.55; color: #444; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ship-card__form { display: flex; flex-direction: column; gap: 8px; }
        .ship-card__form label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666; min-width: 0; }
        .ship-card__form input {
          width: 100%; min-height: 44px; font-size: 16px; border: 1px solid #e5e5e5;
          border-radius: 10px; padding: 8px 12px; box-sizing: border-box;
        }
        .ship-card__form .ant-btn { min-height: 44px; font-size: 16px; width: 100%; }
        .ship-card__current { font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
        .ship-card__actions { display: flex; flex-direction: column; gap: 8px; }
        .ship-card__yun.ant-btn { min-height: 44px; width: 100%; }
        .ship-card__hint { margin: 0; font-size: 12px; line-height: 1.5; color: #888; }
        .ship-section { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        @media (min-width: 768px) {
          .ship-card__form { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(180px, 1.4fr) auto; align-items: end; gap: 8px; }
          .ship-card__form .ant-btn { width: auto; min-width: 112px; }
          .ship-card__form--shipped { grid-template-columns: minmax(140px, 1fr) minmax(180px, 1.4fr); }
          .ship-card__actions { grid-column: 1 / -1; flex-direction: row; }
          .ship-card__actions .ant-btn { flex: 1; width: auto; }
        }
        @media (max-width: 767px) {
          .process-grid { grid-template-columns: 1fr 1fr; }
          .follow-sync { padding-bottom: 8px; }
          .follow-sync__bar { flex-wrap: wrap; align-items: flex-start; }
          .finish-row__done, .process-actions button { min-height: 40px; }
        }
        @media (max-width: 1199px) {
          .follow-sync__bar { min-width: 0; }
          .follow-sync__bar .ant-typography { overflow-wrap: anywhere; }
        }
      `}</style>

      {mode === 'home' && (
        <Tabs
          className="follow-tabs"
          activeKey={followTab}
          onChange={(key) => selectFollowTab(key as FollowTab)}
          tabBarExtraContent={{
            right: (
              <Button
                icon={<ReloadOutlined />}
                aria-label="刷新"
                onClick={() => { void loadSummary(); void loadOrders(); void loadShipping(); }}
              >
                <span className="follow-refresh-label">刷新</span>
              </Button>
            ),
          }}
          items={[
            {
              key: 'process',
              label: '工序跟单',
              children: (
                <div className="follow-pane">
                  <Text type="secondary">现场按工序连续拍照，回公司后再拖到对应单件。</Text>
                  <div className="process-grid">
                    {PROCESSES.map((process) => (
                      <div key={process.code} className="process-card">
                        <div>
                          <strong>{process.label}</strong>
                          <span>未匹配 {unmatchedOf(process.code)} 张</span>
                        </div>
                        <div className="process-actions">
                          <button type="button" onClick={() => openCapture(process.code)}>拍照</button>
                          <button type="button" onClick={() => openSync(process.code)}>同步</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              key: 'finish',
              label: '生产收尾',
              children: (
          <div className="finish-list">
            {orders.length === 0 ? <Empty description="暂无生产中的订单" /> : orders.map((order) => {
              const previews = finishPiecePreviews(order);
              return (
                <div key={order.baseInfo.id} className="finish-row">
                  <div className="finish-row__meta">
                    <div className="finish-row__no">{order.baseInfo.orderNumber}</div>
                    <Text type="secondary">{order.baseInfo.customerName || '客户'}</Text>
                  </div>
                  {previews.length > 0 && (
                    <div className="finish-thumbs">
                      <Image.PreviewGroup>
                        {previews.map((preview) => (
                          <div key={preview.key} className="finish-thumb">
                            {preview.url ? (
                              <Image
                                src={preview.url}
                                alt={preview.name}
                                width={72}
                                height={72}
                                style={{ objectFit: 'cover' }}
                                preview={{ mask: '放大' }}
                              />
                            ) : (
                              <div className="finish-thumb__empty" aria-label={`${preview.name}暂无预览图`}>
                                <PictureOutlined />
                              </div>
                            )}
                            <span className="finish-thumb__name" title={preview.name}>{preview.name}</span>
                            <button
                              type="button"
                              className="finish-thumb__log"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openPieceTimeline({
                                  orderId: preview.orderId,
                                  pieceId: preview.pieceId,
                                  pieceName: preview.name,
                                  orderNumber: order.baseInfo.orderNumber,
                                });
                              }}
                            >
                              过程记录
                            </button>
                          </div>
                        ))}
                      </Image.PreviewGroup>
                    </div>
                  )}
                  <Button
                    className="finish-row__done"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    onClick={() => confirmComplete(order)}
                  >
                    生产完成
                  </Button>
                </div>
              );
            })}
          </div>
              ),
            },
            {
              key: 'ship',
              label: '发货',
              children: (
                <div className="follow-pane">
          <Text type="secondary">待发货先试算渠道再云途发货。已经发出的云途运单可以打面单、改重量、拦截或撤销。手工单号仍可更正。</Text>
          <div className="ship-section">
            <Text strong>待发货</Text>
            <div className="ship-list">
              {shipOrders.length === 0 ? (
                <Text type="secondary">暂无待发货订单</Text>
              ) : shipOrders.map((order) => {
                const lines = shippingLines(order);
                const draft = shipDrafts[order.baseInfo.id] || { tracking: '', carrier: '' };
                return (
                  <div key={order.baseInfo.id} className="ship-card">
                    <div className="finish-row__no">{order.baseInfo.orderNumber}</div>
                    <Text type="secondary">{order.baseInfo.customerName || '客户'}</Text>
                    <div className="ship-card__addr">
                      {lines.length > 0 ? lines.join('\n') : '客户还没填写收货信息。已在订单群里请客户填写，也可以先录入物流单号。'}
                    </div>
                    <div className="ship-card__form">
                      <label>
                        承运商（可选）
                        <input
                          value={draft.carrier}
                          autoComplete="off"
                          placeholder="DHL / FedEx / UPS"
                          onChange={(event) => patchShipDraft(order.baseInfo.id, { carrier: event.target.value })}
                        />
                      </label>
                      <label>
                        国际物流单号
                        <input
                          value={draft.tracking}
                          autoComplete="off"
                          inputMode="text"
                          placeholder="物流单号"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void submitShip(order.baseInfo.id);
                          }}
                          onChange={(event) => patchShipDraft(order.baseInfo.id, { tracking: event.target.value })}
                        />
                      </label>
                      <Button
                        type="primary"
                        loading={shippingBusyId === order.baseInfo.id}
                        onClick={() => void submitShip(order.baseInfo.id)}
                      >
                        确认发货
                      </Button>
                    </div>
                    {lines.length > 0 ? (
                      <YunexpressDesk
                        orderId={order.baseInfo.id}
                        hasAddress
                        onUpdated={() => { void loadShipping(); }}
                      />
                    ) : (
                      <p className="ship-card__hint">客户还没填写收货信息，暂不能使用云途快捷发货。</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="ship-section">
            <Text strong>已发货</Text>
            <Text type="secondary">保存更正只改当前这一条物流，承运商留空表示不改。重新发货用于发错货，必须填新单号；承运商留空则自动识别。订单不会退回生产中。</Text>
            <div className="ship-list">
              {shippedOrders.length === 0 ? (
                <Text type="secondary">暂无已发货订单</Text>
              ) : shippedOrders.map((order) => {
                const lines = shippingLines(order);
                const draft = shippedDrafts[order.baseInfo.id] || {
                  tracking: order.shipment?.trackingNumber || '',
                  carrier: order.shipment?.carrierName || '',
                };
                const orderId = order.baseInfo.id;
                return (
                  <div key={orderId} className="ship-card">
                    <div className="finish-row__no">{order.baseInfo.orderNumber}</div>
                    <Text type="secondary">{order.baseInfo.customerName || '客户'}</Text>
                    <div className="ship-card__current">
                      当前单号：{order.shipment?.trackingNumber || '—'}
                      {order.shipment?.carrierName ? ` · ${order.shipment.carrierName}` : ''}
                    </div>
                    <div className="ship-card__addr">
                      {lines.length > 0 ? lines.join('\n') : '客户还没填写收货信息。'}
                    </div>
                    {(order.shipment?.carrierName === '云途' || (order.shipment?.carrierName || '').toLowerCase() === 'yunexpress') && (
                      <YunexpressDesk
                        orderId={orderId}
                        hasAddress={lines.length > 0}
                        shipment={order.shipment}
                        onUpdated={() => { void loadShipping(); }}
                      />
                    )}
                    <div className="ship-card__form ship-card__form--shipped">
                      <label>
                        承运商（可选）
                        <input
                          value={draft.carrier}
                          autoComplete="off"
                          placeholder="DHL / FedEx / UPS"
                          onChange={(event) => patchShippedDraft(orderId, { carrier: event.target.value })}
                        />
                      </label>
                      <label>
                        国际物流单号
                        <input
                          value={draft.tracking}
                          autoComplete="off"
                          inputMode="text"
                          placeholder="物流单号"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void submitCorrectShipment(orderId);
                          }}
                          onChange={(event) => patchShippedDraft(orderId, { tracking: event.target.value })}
                        />
                      </label>
                      <div className="ship-card__actions">
                        <Button
                          type="primary"
                          loading={shipmentEditBusy === `correct:${orderId}`}
                          disabled={shipmentEditBusy != null && shipmentEditBusy !== `correct:${orderId}`}
                          onClick={() => void submitCorrectShipment(orderId)}
                        >
                          保存更正
                        </Button>
                        <Button
                          loading={shipmentEditBusy === `reship:${orderId}`}
                          disabled={shipmentEditBusy != null && shipmentEditBusy !== `reship:${orderId}`}
                          onClick={() => confirmReship(orderId)}
                        >
                          手工重新发货
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                </div>
              ),
            },
          ]}
        />
      )}

      {mode === 'capture' && (
        <>
          <div className="follow-sync__bar">
            <Button onClick={backToProcess}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>{processLabel}</Title>
            <Button type="primary" loading={uploading} onClick={() => void savePending()}>保存</Button>
          </div>
          <Text type="secondary">可以连续拍很多张。保存后先进入照片池，回公司再匹配订单。</Text>
          <div className="capture-actions">
            <Button
              icon={<CameraOutlined />}
              onClick={() => {
                (window as unknown as { __mojeWantCamera?: boolean }).__mojeWantCamera = true;
                cameraRef.current?.click();
              }}
            >
              拍照
            </Button>
            <Button
              icon={<PictureOutlined />}
              onClick={() => {
                (window as unknown as { __mojeWantCamera?: boolean }).__mojeWantCamera = false;
                albumRef.current?.click();
              }}
            >
              相册多选
            </Button>
          </div>
          <input
            ref={cameraRef}
            hidden
            data-moje-file="camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              addPending(selected);
              e.target.value = '';
            }}
          />
          <input
            ref={albumRef}
            hidden
            data-moje-file="album"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const selected = e.target.files ? Array.from(e.target.files) : [];
              addPending(selected);
              e.target.value = '';
            }}
          />
          {pendingUrls.length === 0 ? <Empty description="还没有选择照片" /> : (
            <div className="preview-grid">
              {pendingUrls.map((url, index) => <img key={url} src={url} alt={`待保存 ${index + 1}`} />)}
            </div>
          )}
        </>
      )}

      {mode === 'sync' && (
        <>
          <div className="follow-sync__bar">
            <Button onClick={backToProcess}>返回</Button>
            <Title level={4} style={{ margin: 0 }}>{processLabel}进度同步</Title>
            <Button icon={<ReloadOutlined />} onClick={() => void loadBoard(processCode)} />
          </div>
          <Text type="secondary">把下方照片拖到对应的建模图上。拖完后这件在本工序不再出现，并会通知客户。点单件可看这件的过程记录。</Text>
          {loading ? <Spin /> : (
            <>
              <div className="piece-row">
                {pieces.length === 0 ? <Empty description="这一工序没有待同步的单件" /> : pieces.map((piece) => {
                  const key = `${piece.orderId}-${piece.pieceId}`;
                  const pieceName = piece.pieceName || '单件';
                  return (
                    <div
                      key={key}
                      data-piece-key={key}
                      className={`piece-card${overKey === key ? ' is-over' : ''}`}
                    >
                      <button
                        type="button"
                        className="piece-open"
                        onClick={() => void openPieceTimeline({
                          orderId: piece.orderId,
                          pieceId: piece.pieceId,
                          pieceName,
                          orderNumber: piece.orderNumber,
                        })}
                      >
                        {piece.thumbnailUrl ? (
                          <img src={resolveMediaUrl(piece.thumbnailUrl)} alt={pieceName} draggable={false} />
                        ) : (
                          <div className="piece-fallback">{pieceName.slice(0, 2)}</div>
                        )}
                        <strong>{pieceName}</strong>
                        <small>{piece.orderNumber}</small>
                        <span className="piece-log-hint">过程记录</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <Title level={5} style={{ margin: 0 }}>未匹配照片</Title>
              {photos.length === 0 ? <Empty description="照片池是空的，先去现场拍照并保存" /> : (
                <div className="photo-pool">
                  {photos.map((photo) => (
                    <div key={photo.id} className="photo-tile">
                      <button
                        type="button"
                        className="photo-drag"
                        onPointerDown={(event) => onPhotoPointerDown(event, photo)}
                        onPointerMove={onPhotoPointerMove}
                        onPointerUp={onPhotoPointerUp}
                        onPointerCancel={() => { dragPhotoId.current = null; setOverKey(null); setGhost(null); }}
                      >
                        {photoUrls[photo.fileId]
                          ? <img src={photoUrls[photo.fileId]} alt="现场照片" draggable={false} />
                          : <span className="photo-loading">加载中</span>}
                      </button>
                      <button
                        type="button"
                        className="photo-delete"
                        aria-label="删除这张未匹配照片"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => confirmDiscardPhoto(photo)}
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
      <Modal
        open={timelineTarget != null}
        title={timelineTarget ? `${timelineTarget.pieceName} · 过程记录` : '过程记录'}
        footer={null}
        onCancel={() => setTimelineTarget(null)}
        destroyOnClose
      >
        {timelineTarget?.orderNumber ? <Text type="secondary">{timelineTarget.orderNumber}</Text> : null}
        <div><Text type="secondary">按这件实际完成时间先后</Text></div>
        {timelineLoading ? <Spin /> : timelineError ? (
          <Text type="danger">{timelineError}</Text>
        ) : timelineLogs.length === 0 ? (
          <Text type="secondary">暂无</Text>
        ) : (
          <div className="log-list">
            {timelineLogs.map((log) => (
              <div key={log.id} className="log-item">
                <strong>{log.processLabel || log.processCode || '记录'}</strong>
                {log.processCode === 'WAX' ? <Text type="success"> · 工艺验证已通过</Text> : null}
                <div>{log.note || '已更新生产进度'}</div>
                {formatLogTime(log.createdAt) ? <Text type="secondary">{formatLogTime(log.createdAt)}</Text> : null}
              </div>
            ))}
          </div>
        )}
      </Modal>
      {ghost && <img className="drag-ghost" src={ghost.url} alt="" style={{ left: ghost.x, top: ghost.y }} />}
    </div>
  );
};

export default TrackerFollowUpPage;
