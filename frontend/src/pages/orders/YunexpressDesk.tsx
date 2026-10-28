import { useEffect, useState } from 'react';
import { Button, InputNumber, Modal, message } from 'antd';
import { orderService } from '@/services/orderService';
import type { OrderShipmentDto, YunexpressQuote } from '@/types/order';
import './YunexpressDesk.css';

function isYunexpress(shipment?: OrderShipmentDto | null) {
  const name = (shipment?.carrierName || '').trim();
  return name === '云途' || name.toLowerCase() === 'yunexpress';
}

function money(quote: YunexpressQuote) {
  const currency = (quote.currency || '').toUpperCase();
  const prefix = currency === 'RMB' || currency === 'CNY' ? '¥' : `${currency || ''} `;
  return `${prefix}${quote.amount || '—'}`;
}

async function openDoc(loader: () => Promise<{ url?: string }>) {
  const doc = await loader();
  if (!doc?.url) {
    message.warning('云途还没有生成这份文件');
    return;
  }
  window.open(doc.url, '_blank', 'noopener,noreferrer');
}

export function YunexpressDesk({
  orderId,
  hasAddress,
  shipment,
  onUpdated,
}: {
  orderId: number;
  hasAddress: boolean;
  shipment?: OrderShipmentDto | null;
  onUpdated: () => void;
}) {
  const yun = isYunexpress(shipment);
  const cancelled = yun && (shipment?.status === 'C' || shipment?.statusLabel === '已撤销');
  const [weight, setWeight] = useState<number>(0.2);
  const [quotes, setQuotes] = useState<YunexpressQuote[]>([]);
  const [productCode, setProductCode] = useState('THPHR');
  const [busy, setBusy] = useState('');
  const [detail, setDetail] = useState<OrderShipmentDto | null>(shipment || null);

  useEffect(() => {
    setDetail(shipment || null);
  }, [shipment]);

  useEffect(() => {
    if (!yun || !shipment?.trackingNumber) return;
    let alive = true;
    orderService.getShipment(orderId).then((fresh) => {
      if (alive && fresh) setDetail(fresh);
    }).catch(() => {});
    return () => { alive = false; };
  }, [orderId, yun, shipment?.trackingNumber, shipment?.statusLabel]);

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch {
      /* 拦截器已提示 */
    } finally {
      setBusy('');
    }
  };

  const quote = () => run('quote', async () => {
    const rows = await orderService.quoteYunexpress(orderId, weight);
    setQuotes(rows || []);
    if (rows?.some((row) => row.productCode === 'THPHR')) setProductCode('THPHR');
    else if (rows?.[0]) setProductCode(rows[0].productCode);
    if (!rows?.length) message.info('沙盒没有返回可用渠道');
  });

  const ship = () => {
    Modal.confirm({
      title: shipment && !cancelled ? '用云途重新发货？' : '用云途快捷发货？',
      content: '按当前收件信息和所选渠道向云途沙盒创建运单。成功后客户会在订单聊天里看到新的物流。',
      okText: shipment && !cancelled ? '重新发货' : '确认发货',
      cancelText: '取消',
      onOk: () => run('ship', async () => {
        const body = { productCode, weightKg: weight };
        const next = shipment
          ? await orderService.reshipByYunexpress(orderId, body)
          : await orderService.shipByYunexpress(orderId, body);
        setDetail(next);
        message.success(shipment ? '已用云途重新发货' : '云途运单已创建');
        onUpdated();
      }),
    });
  };

  const shown = detail || shipment;

  return (
    <div className="yt-desk">
      <div className="yt-desk__title">云途发货</div>
      {!hasAddress && !yun && <p className="yt-desk__hint">客户还没填写收货信息，先请客户补齐地址，或改用手工单号。</p>}
      {(hasAddress || yun) && (!shipment || cancelled) && (
        <>
          <label className="yt-desk__weight">
            包裹重量（千克）
            <InputNumber min={0.001} max={10000} step={0.1} value={weight} onChange={(value) => setWeight(Number(value) || 0.2)} />
          </label>
          <div className="yt-desk__actions">
            <Button loading={busy === 'quote'} disabled={!!busy && busy !== 'quote'} onClick={quote}>试算运费</Button>
            <Button type="primary" loading={busy === 'ship'} disabled={!hasAddress || (!!busy && busy !== 'ship')} onClick={ship}>
              {shipment ? '云途重新发货' : '云途快捷发货'}
            </Button>
          </div>
          {quotes.length > 0 && (
            <div className="yt-desk__quotes" role="radiogroup" aria-label="物流渠道">
              {quotes.map((row) => (
                <label key={row.productCode} className={productCode === row.productCode ? 'is-on' : ''}>
                  <input
                    type="radio"
                    name={`yt-${orderId}`}
                    checked={productCode === row.productCode}
                    onChange={() => setProductCode(row.productCode)}
                  />
                  <span>
                    <strong>{row.productName || row.productCode}</strong>
                    <em>{money(row)}{row.intervalDay ? ` · ${row.intervalDay} 天` : ''}</em>
                  </span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {yun && shown && (
        <div className="yt-desk__live">
          <div className="yt-desk__status">{shown.statusLabel || '已发货'}</div>
          <div>运单号 {shown.trackingNumber}</div>
          {shown.lastMileName && (
            <div>
              末端派送：{shown.lastMileName}
              {shown.lastMileTracking ? ` · ${shown.lastMileTracking}` : ''}
              {shown.lastMilePhone ? ` · ${shown.lastMilePhone}` : ''}
            </div>
          )}
          {shown.trackingNote && <p className="yt-desk__hint">{shown.trackingNote}</p>}
          {!!shown.events?.length && (
            <ol className="yt-desk__tl">
              {[...shown.events].reverse().map((event, index) => (
                <li key={`${event.time}-${index}`}>
                  <strong>{event.description || '物流更新'}</strong>
                  <span>{[event.time, event.location].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ol>
          )}
          {!cancelled && (
            <>
              <div className="yt-desk__actions">
                <Button loading={busy === 'label'} onClick={() => run('label', () => openDoc(() => orderService.yunexpressLabel(orderId)))}>面单</Button>
                <Button loading={busy === 'docs'} onClick={() => run('docs', () => openDoc(() => orderService.yunexpressShippingDocument(orderId)))}>发货证明</Button>
                <Button loading={busy === 'pod'} onClick={() => run('pod', () => openDoc(() => orderService.yunexpressPod(orderId)))}>签收证明</Button>
              </div>
              <label className="yt-desk__weight">
                修改预报重量
                <InputNumber min={0.001} max={10000} step={0.1} value={weight} onChange={(value) => setWeight(Number(value) || 0.2)} />
              </label>
              <div className="yt-desk__actions">
                <Button
                  loading={busy === 'weight'}
                  onClick={() => run('weight', async () => {
                    await orderService.modifyYunexpressWeight(orderId, weight);
                    message.success('预报重量已更新');
                  })}
                >
                  保存重量
                </Button>
                <Button
                  loading={busy === 'hold'}
                  onClick={() => Modal.confirm({
                    title: '拦截这票运单？',
                    content: '云途会暂停派送。客户会收到一条「运单已拦截」。',
                    okText: '拦截',
                    cancelText: '取消',
                    onOk: () => run('hold', async () => {
                      const next = await orderService.holdYunexpress(orderId);
                      setDetail(next);
                      message.success('已拦截');
                      onUpdated();
                    }),
                  })}
                >
                  拦截
                </Button>
                <Button
                  danger
                  loading={busy === 'cancel'}
                  onClick={() => Modal.confirm({
                    title: '撤销这票运单？',
                    content: '撤销后这张单号不再派送。客户会收到通知。需要再寄时，用下面的重新发货。',
                    okText: '撤销运单',
                    okButtonProps: { danger: true },
                    cancelText: '取消',
                    onOk: () => run('cancel', async () => {
                      const next = await orderService.cancelYunexpress(orderId);
                      setDetail(next);
                      message.success('运单已撤销');
                      onUpdated();
                    }),
                  })}
                >
                  撤销运单
                </Button>
              </div>
            </>
          )}
          {cancelled && <p className="yt-desk__hint">这张运单已撤销。可以重新试算并再次发货。</p>}
        </div>
      )}
      {yun && shipment && !cancelled && hasAddress && (
        <details className="yt-desk__again">
          <summary>换渠道重新发货</summary>
          <label className="yt-desk__weight">
            包裹重量（千克）
            <InputNumber min={0.001} max={10000} step={0.1} value={weight} onChange={(value) => setWeight(Number(value) || 0.2)} />
          </label>
          <div className="yt-desk__actions">
            <Button loading={busy === 'quote'} onClick={quote}>试算运费</Button>
            <Button loading={busy === 'ship'} onClick={ship}>云途重新发货</Button>
          </div>
          {quotes.length > 0 && (
            <div className="yt-desk__quotes">
              {quotes.map((row) => (
                <label key={row.productCode} className={productCode === row.productCode ? 'is-on' : ''}>
                  <input type="radio" name={`yt-again-${orderId}`} checked={productCode === row.productCode} onChange={() => setProductCode(row.productCode)} />
                  <span>
                    <strong>{row.productName || row.productCode}</strong>
                    <em>{money(row)}{row.intervalDay ? ` · ${row.intervalDay} 天` : ''}</em>
                  </span>
                </label>
              ))}
            </div>
          )}
        </details>
      )}
    </div>
  );
}
