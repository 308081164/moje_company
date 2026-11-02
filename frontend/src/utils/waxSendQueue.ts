/** 跟单「待发送 / 已发送」本地队列（按登录用户隔离） */

export type WaxSendQueueItem = {
  /** orderId:pieceId:fileId */
  key: string;
  orderId: number;
  orderNumber: string;
  pieceId: number | null;
  pieceName: string;
  fileId: number;
  fileName: string;
  markedAt: string;
};

export type WaxSentItem = WaxSendQueueItem & {
  sentAt: string;
  batchId?: string;
};

const QUEUE_PREFIX = 'moje.waxSendQueue.v1.';
const SENT_PREFIX = 'moje.waxSent.v1.';

function userScope(): string {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { user?: { id?: number; username?: string } } };
      const uid = parsed?.state?.user?.id ?? parsed?.state?.user?.username;
      if (uid != null && String(uid)) return String(uid);
    }
  } catch {
    /* ignore */
  }
  return 'anon';
}

function queueKey(): string {
  return QUEUE_PREFIX + userScope();
}

function sentKey(): string {
  return SENT_PREFIX + userScope();
}

function emitChanged() {
  window.dispatchEvent(new CustomEvent('moje-wax-send-queue-changed'));
}

function readQueue(): WaxSendQueueItem[] {
  try {
    const raw = localStorage.getItem(queueKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaxSendQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: WaxSendQueueItem[]) {
  localStorage.setItem(queueKey(), JSON.stringify(items));
  emitChanged();
}

function readSent(): WaxSentItem[] {
  try {
    const raw = localStorage.getItem(sentKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaxSentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSent(items: WaxSentItem[]) {
  localStorage.setItem(sentKey(), JSON.stringify(items));
  emitChanged();
}

export function makeWaxSendKey(orderId: number, pieceId: number | null, fileId: number): string {
  return `${orderId}:${pieceId ?? 0}:${fileId}`;
}

export function listWaxSendQueue(): WaxSendQueueItem[] {
  return readQueue().slice().sort((a, b) => (a.markedAt < b.markedAt ? 1 : -1));
}

export function countWaxSendQueue(): number {
  return readQueue().length;
}

export function listWaxSent(): WaxSentItem[] {
  return readSent().slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

export function isInWaxSendQueue(orderId: number, pieceId: number | null, fileId: number): boolean {
  const key = makeWaxSendKey(orderId, pieceId, fileId);
  return readQueue().some((i) => i.key === key);
}

function pieceFileSet(
  items: { orderId: number; pieceId: number | null; fileId: number }[],
  orderId: number,
  pieceId: number | null
): Set<number> {
  const pid = pieceId ?? null;
  return new Set(
    items
      .filter((i) => i.orderId === orderId && (i.pieceId ?? null) === pid)
      .map((i) => i.fileId)
  );
}

export function isPieceFullyQueued(
  orderId: number,
  pieceId: number | null,
  fileIds: number[]
): boolean {
  if (!fileIds.length) return false;
  const set = pieceFileSet(readQueue(), orderId, pieceId);
  return fileIds.every((id) => set.has(id));
}

/** 该单件相关文件均已执行过发送（且当前不在待发送队列） */
export function isPieceFullySent(
  orderId: number,
  pieceId: number | null,
  fileIds: number[]
): boolean {
  if (!fileIds.length) return false;
  if (isPieceFullyQueued(orderId, pieceId, fileIds)) return false;
  const set = pieceFileSet(readSent(), orderId, pieceId);
  return fileIds.every((id) => set.has(id));
}

export function markWaxSendItems(items: Omit<WaxSendQueueItem, 'key' | 'markedAt'>[]): number {
  const now = new Date().toISOString();
  const map = new Map(readQueue().map((i) => [i.key, i]));
  let added = 0;
  for (const item of items) {
    const key = makeWaxSendKey(item.orderId, item.pieceId, item.fileId);
    if (map.has(key)) continue;
    map.set(key, { ...item, key, markedAt: now });
    added += 1;
  }
  writeQueue([...map.values()]);
  return added;
}

export function unmarkWaxSendByKeys(keys: string[]): number {
  const set = new Set(keys);
  const before = readQueue();
  const next = before.filter((i) => !set.has(i.key));
  writeQueue(next);
  return before.length - next.length;
}

export function unmarkWaxSendPiece(orderId: number, pieceId: number | null): number {
  const pid = pieceId ?? null;
  const before = readQueue();
  const next = before.filter((i) => !(i.orderId === orderId && (i.pieceId ?? null) === pid));
  writeQueue(next);
  return before.length - next.length;
}

/** 批量发送成功：移出待发送，写入已发送历史 */
export function completeWaxSendByKeys(keys: string[], batchId?: string): number {
  const set = new Set(keys);
  const queue = readQueue();
  const moving = queue.filter((i) => set.has(i.key));
  if (!moving.length) return 0;
  const now = new Date().toISOString();
  const sentMap = new Map(readSent().map((i) => [i.key, i]));
  for (const item of moving) {
    sentMap.set(item.key, { ...item, sentAt: now, batchId });
  }
  writeSent([...sentMap.values()]);
  writeQueue(queue.filter((i) => !set.has(i.key)));
  return moving.length;
}

export function clearWaxSendQueue(): void {
  writeQueue([]);
}

export function subscribeWaxSendQueue(listener: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key.startsWith(QUEUE_PREFIX) || e.key.startsWith(SENT_PREFIX)) listener();
  };
  const onCustom = () => listener();
  window.addEventListener('storage', onStorage);
  window.addEventListener('moje-wax-send-queue-changed', onCustom);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('moje-wax-send-queue-changed', onCustom);
  };
}
