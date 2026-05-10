import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Divider,
  Image,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DownloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '@/services/orderService';
import { userService } from '@/services/userService';
import UploadWithImagePreview from '@/components/UploadWithImagePreview';
import {
  collectDoneImageUrlsFromFileList,
  normalizeDoneImageUploadFileList,
  normalizeModelSourceUploadFileList,
  savedImageUrlsToUploadFileList,
} from '@/utils/orderUploadFileList';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import type { CustomerProgressLinkResponse, FileInfo, OrderInfo, ProcessInfo } from '@/types/order';
import { OrderSource, OrderStatus, ProcessType } from '@/types/order';
import { UserRole } from '@/types/auth';
import type { UserInfo } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';
import { useCurrentUser, useIsAdmin, useIsSales, useIsDesigner, useIsModeler, useIsTracker, useIsPreSales } from '@/stores/authStore';

const { Title, Text, Paragraph } = Typography;

function modelSourceUploadListFromSaved(modelFiles: unknown): UploadFile[] {
  if (!modelFiles || !Array.isArray(modelFiles)) return [];
  const rows = modelFiles as { fileId?: number; fileName?: string; fileUrl?: string }[];
  return rows
    .filter((x) => x.fileId != null && x.fileUrl)
    .map((x, i) => {
      const name = x.fileName || '';
      const isImg = /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
      return {
        uid: `src-${x.fileId}-${i}`,
        name: name || `file-${x.fileId}`,
        status: 'done' as const,
        url: x.fileUrl,
        thumbUrl: isImg ? x.fileUrl : undefined,
        response: { id: x.fileId } as FileInfo,
      };
    });
}

async function loadUsersByRole(role: UserRole): Promise<UserInfo[]> {
  const res = await userService.getUsers({ page: 0, size: 500, role });
  return res.content || [];
}

const LEGACY_PROCESS_LABEL: Partial<Record<ProcessType, string>> = {
  [ProcessType.ENAMEL]: '珐琅',
  [ProcessType.WIRE_DRAWING]: '拉丝',
  [ProcessType.SAND_BLASTING]: '喷砂',
  [ProcessType.NAIL_SAND]: '钉砂',
  [ProcessType.OTHER]: '其他',
};

const OTHER_VALUE_PREFIX = 'other:';

/** 与工艺库接口一致：库内项用行 id；历史 OTHER+名称 在配置中无匹配时用 other:名称；旧枚举仍用枚举值。 */
function savedProcessToSelectValue(p: ProcessInfo, config: ProcessInfo[]): string {
  const name = (p.customProcess || '').trim();
  if (name) {
    const hit = config.find(
      (c) =>
        (c.customProcess || '').trim() === name && String(c.processType) === ProcessType.OTHER
    );
    if (hit?.id != null) return String(hit.id);
    return `${OTHER_VALUE_PREFIX}${name}`;
  }
  return String(p.processType);
}

function formatSavedProcessLine(p: ProcessInfo): string {
  const name = (p.customProcess || '').trim();
  if (name) return name;
  const pt = p.processType as ProcessType;
  return LEGACY_PROCESS_LABEL[pt] || String(p.processType);
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = Number(id);
  const currentUser = useCurrentUser();
  const isAdmin = useIsAdmin();
  const isSales = useIsSales();
  const isDesigner = useIsDesigner();
  const isModeler = useIsModeler();
  const isTracker = useIsTracker();
  const isPreSales = useIsPreSales();

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [designImageFileList, setDesignImageFileList] = useState<UploadFile[]>([]);
  const [modelEffectImageFileList, setModelEffectImageFileList] = useState<UploadFile[]>([]);
  const [modelSourceFileList, setModelSourceFileList] = useState<UploadFile[]>([]);
  const [rejectDesignerAttachList, setRejectDesignerAttachList] = useState<UploadFile[]>([]);
  const [relatedOrders, setRelatedOrders] = useState<OrderInfo[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [materialConfig, setMaterialConfig] = useState<{ type: string; name: string; priceFormula: string }[]>([]);
  const [processConfig, setProcessConfig] = useState<ProcessInfo[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);

  const [salesUsers, setSalesUsers] = useState<UserInfo[]>([]);
  const [designers, setDesigners] = useState<UserInfo[]>([]);
  const [modelers, setModelers] = useState<UserInfo[]>([]);
  const [trackers, setTrackers] = useState<UserInfo[]>([]);
  const [customerProgressLink, setCustomerProgressLink] = useState<CustomerProgressLinkResponse | null>(null);
  const [customerCardPreviewUrl, setCustomerCardPreviewUrl] = useState<string | null>(null);
  const [customerProgressBusy, setCustomerProgressBusy] = useState(false);

  const [designForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  const [rejectDesignerForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [quoteForm] = Form.useForm();

  const loadRelatedOrders = useCallback(async () => {
    if (!currentUser) return;
    try {
      let orders: OrderInfo[] = [];
      
      if (isDesigner) {
        const res = await orderService.workbenchDesignerTodo(0, 100);
        orders = res.content || [];
      } else if (isModeler) {
        const res = await orderService.workbenchModelerTodo(0, 100);
        orders = res.content || [];
      } else if (isTracker) {
        const res = await orderService.workbenchTrackerTodo(0, 100);
        orders = res.content || [];
      } else if (isSales || isAdmin || isPreSales) {
        const res = await orderService.getOrders({ page: 0, size: 100 });
        orders = res.content || [];
      }
      
      setRelatedOrders(orders);
      
      const index = orders.findIndex((o) => o.baseInfo.id === orderId);
      if (index >= 0) {
        setCurrentOrderIndex(index);
      }
    } catch (error) {
      console.error('加载相关订单失败:', error);
    }
  }, [currentUser, orderId, isDesigner, isModeler, isTracker, isSales, isAdmin, isPreSales]);

  const navigateToOrder = useCallback((newOrderId: number) => {
    navigate(`/orders/${newOrderId}`, { replace: true });
  }, [navigate]);

  const goToPrevOrder = useCallback(() => {
    if (relatedOrders.length > 0 && currentOrderIndex > 0) {
      const prevOrder = relatedOrders[currentOrderIndex - 1];
      navigateToOrder(prevOrder.baseInfo.id);
    }
  }, [relatedOrders, currentOrderIndex, navigateToOrder]);

  const goToNextOrder = useCallback(() => {
    if (relatedOrders.length > 0 && currentOrderIndex < relatedOrders.length - 1) {
      const nextOrder = relatedOrders[currentOrderIndex + 1];
      navigateToOrder(nextOrder.baseInfo.id);
    }
  }, [relatedOrders, currentOrderIndex, navigateToOrder]);

  const loadConfigs = useCallback(async () => {
    try {
      const [materials, processes] = await Promise.all([
        orderService.getMaterialConfig(),
        orderService.getProcessConfig(),
      ]);
      setMaterialConfig(materials);
      setProcessConfig(processes);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) return;
    setLoading(true);
    try {
      const o = await orderService.getOrderById(orderId);
      setOrder(o);
      setDesignImageFileList(savedImageUrlsToUploadFileList(o.designInfo?.designImages || [], '设计图'));
      setModelEffectImageFileList(savedImageUrlsToUploadFileList(o.modelInfo?.modelEffectImages || [], '效果图'));
      setModelSourceFileList(modelSourceUploadListFromSaved(o.modelInfo?.modelFiles));

      if (o.designInfo) {
        designForm.setFieldsValue({
          designerId: o.designInfo.designerId,
          engravingText: o.designInfo.engravingText,
          materialType: o.designInfo.materialType,
          handSize: o.designInfo.handSize,
          designNotes: o.designInfo.designNotes,
        });
      }
      if (o.modelInfo) {
        modelForm.setFieldsValue({
          modelerId: o.modelInfo.modelerId,
          weight: o.modelInfo.weight,
          modelNotes: o.modelInfo.modelNotes,
        });
      }
      if (o.reviewInfo) {
        reviewForm.setFieldsValue({
          trackerId: o.reviewInfo.trackerId,
          reviewNotes: o.reviewInfo.reviewNotes,
          rejectionReason: o.reviewInfo.rejectionReason,
          rejectedProcessesText: (o.reviewInfo.rejectedProcesses || []).join(','),
        });
      }
      if (o.quotationInfo) {
        const q = o.quotationInfo;
        quoteForm.setFieldsValue({
          processCost: q.processCost,
          stoneCost: q.stoneCost,
          materialCost: q.materialCost,
          weightCost: q.weightCost,
          laborCost: q.laborCost,
          designBuyout: !!q.designBuyout,
          designBuyoutCost: q.designBuyoutCost,
          certificateCost: q.certificateCost,
          confidential: !!q.confidential,
          otherCost: q.otherCost,
          totalCost: q.totalCost,
          quotationNotes: q.quotationNotes,
        });
      } else {
        quoteForm.setFieldsValue({
          designBuyout: false,
          confidential: false,
        });
      }
      
      const fl = await orderService.getOrderFiles(orderId);
      setFiles(fl);
    } catch (error) {
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [orderId, designForm, modelForm, reviewForm, quoteForm]);

  useEffect(() => {
    refresh();
    loadRelatedOrders();
    loadConfigs();
  }, [refresh, loadRelatedOrders, loadConfigs]);

  useEffect(() => {
    const raw = order?.designInfo?.processInfo;
    if (!raw?.length) {
      setSelectedProcesses([]);
      return;
    }
    setSelectedProcesses(raw.map((p) => savedProcessToSelectValue(p as ProcessInfo, processConfig)));
  }, [order, processConfig]);

  const craftSelectOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const p of processConfig) {
      if (p.id == null) continue;
      const value = String(p.id);
      const name = (p.customProcess || '').trim();
      const label = name ? `${name} (${value})` : `${String(p.processType)} (${value})`;
      opts.push({ value, label });
      seen.add(value);
    }
    const saved = order?.designInfo?.processInfo || [];
    for (const row of saved) {
      const p = row as ProcessInfo;
      const v = savedProcessToSelectValue(p, processConfig);
      if (!seen.has(v)) {
        seen.add(v);
        opts.push({ value: v, label: formatSavedProcessLine(p) });
      }
    }
    return opts;
  }, [processConfig, order?.designInfo?.processInfo]);

  useEffect(() => {
    (async () => {
      try {
        const [s, d, m, t] = await Promise.all([
          loadUsersByRole(UserRole.SALES),
          loadUsersByRole(UserRole.DESIGNER),
          loadUsersByRole(UserRole.MODELER),
          loadUsersByRole(UserRole.TRACKER),
        ]);
        setSalesUsers(s);
        setDesigners(d);
        setModelers(m);
        setTrackers(t);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleDesignUploadChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setDesignImageFileList(normalizeDoneImageUploadFileList(fileList));
  }, []);

  const handleDesignCustomRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onSuccess } = options;
      try {
        const res = await orderService.uploadDesignFile(orderId, file as File);
        let url = res.fileUrl?.trim();
        if (!url) {
          url = (await orderService.previewFile(res.id))?.trim();
        }
        if (!url) {
          throw new Error('未返回图片地址');
        }
        onSuccess?.({ ...res, url });
        message.success('设计图片上传成功');
      } catch {
        message.error('设计图片上传失败');
        onError?.(new Error('上传失败'));
      }
    },
    [orderId]
  );

  const handleModelEffectUploadChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setModelEffectImageFileList(normalizeDoneImageUploadFileList(fileList));
  }, []);

  const handleModelEffectCustomRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onSuccess } = options;
      try {
        const res = await orderService.uploadModelEffectFile(orderId, file as File);
        let url = res.fileUrl?.trim();
        if (!url) {
          url = (await orderService.previewFile(res.id))?.trim();
        }
        if (!url) {
          throw new Error('未返回图片地址');
        }
        onSuccess?.({ ...res, url });
        message.success('效果图上传成功');
      } catch {
        message.error('效果图上传失败');
        onError?.(new Error('上传失败'));
      }
    },
    [orderId]
  );

  const handleModelSourceUploadChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setModelSourceFileList(normalizeModelSourceUploadFileList(fileList));
  }, []);

  const handleModelSourceCustomRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onSuccess } = options;
      try {
        const res = await orderService.uploadModelFile(orderId, file as File);
        let url = res.fileUrl?.trim();
        if (!url) {
          url = (await orderService.previewFile(res.id))?.trim();
        }
        onSuccess?.(url ? { ...res, url } : res);
        message.success('源文件上传成功');
      } catch {
        message.error('源文件上传失败');
        onError?.(new Error('上传失败'));
      }
    },
    [orderId]
  );

  const handleRejectDesignerAttachChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setRejectDesignerAttachList(normalizeDoneImageUploadFileList(fileList));
  }, []);

  const handleRejectDesignerAttachRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onSuccess } = options;
      try {
        const res = await orderService.uploadModelEffectFile(orderId, file as File);
        let url = res.fileUrl?.trim();
        if (!url) {
          url = (await orderService.previewFile(res.id))?.trim();
        }
        if (!url) {
          throw new Error('未返回图片地址');
        }
        onSuccess?.({ ...res, url });
        message.success('附件已上传');
      } catch {
        message.error('附件上传失败');
        onError?.(new Error('上传失败'));
      }
    },
    [orderId]
  );

  const saveDesign = async () => {
    const v = await designForm.validateFields();
    const processInfo = selectedProcesses.map((key) => {
      const cfg = processConfig.find((p) => p.id != null && String(p.id) === key);
      if (cfg) {
        return {
          id: cfg.id,
          processType: cfg.processType,
          customProcess: cfg.customProcess,
          additionalCost: cfg.additionalCost ?? 0,
          notes: cfg.notes,
        };
      }
      if (key.startsWith(OTHER_VALUE_PREFIX)) {
        return {
          processType: ProcessType.OTHER,
          customProcess: key.slice(OTHER_VALUE_PREFIX.length),
          additionalCost: 0,
        };
      }
      return {
        processType: key as ProcessType,
        additionalCost: 0,
      };
    });
    await orderService.updateOrderDesign(orderId, {
      designerId: v.designerId,
      engravingText: v.engravingText,
      materialType: v.materialType,
      handSize: v.handSize,
      designNotes: v.designNotes,
      designImages: collectDoneImageUrlsFromFileList(designImageFileList),
      processInfo,
    });
    message.success('设计信息已保存');
    refresh();
  };

  const canShareCustomerProgress = useMemo(() => {
    if (!order || (!isDesigner && !isAdmin)) return false;
    const hasDesignImgs = (order.designInfo?.designImages?.length ?? 0) > 0;
    const st = order.currentStatus as OrderStatus;
    const lateEnough =
      st === OrderStatus.PENDING_MODEL ||
      st === OrderStatus.MODELING ||
      st === OrderStatus.PENDING_REVIEW ||
      st === OrderStatus.PENDING_PRODUCTION ||
      st === OrderStatus.PRODUCING ||
      st === OrderStatus.COMPLETED;
    return hasDesignImgs || lateEnough;
  }, [order, isDesigner, isAdmin]);

  useEffect(() => {
    return () => {
      if (customerCardPreviewUrl) URL.revokeObjectURL(customerCardPreviewUrl);
    };
  }, [customerCardPreviewUrl]);

  const onGenerateCustomerProgress = async () => {
    setCustomerProgressBusy(true);
    try {
      const link = await orderService.createCustomerProgressLink(orderId);
      setCustomerProgressLink(link);
      const blob = await orderService.fetchCustomerProgressCardBlob(orderId);
      setCustomerCardPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      message.success('已生成客户进度链接与名片预览');
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setCustomerProgressBusy(false);
    }
  };

  const onDownloadCustomerCard = async () => {
    setCustomerProgressBusy(true);
    try {
      const blob = await orderService.fetchCustomerProgressCardBlob(orderId);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `order-${orderId}-customer-card.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      message.success('已开始下载');
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setCustomerProgressBusy(false);
    }
  };

  const saveModel = async () => {
    const v = await modelForm.validateFields();
    const sourceIds = modelSourceFileList
      .filter((f) => f.status === 'done')
      .map((f) => {
        const res = f.response as FileInfo | undefined;
        return res?.id;
      })
      .filter((id): id is number => id != null && !Number.isNaN(Number(id)));
    await orderService.updateOrderModel(orderId, {
      modelerId: v.modelerId,
      weight: v.weight,
      modelNotes: v.modelNotes,
      modelEffectImageUrls: collectDoneImageUrlsFromFileList(modelEffectImageFileList),
      modelSourceFileIds: sourceIds,
    });
    message.success('建模信息已保存');
    refresh();
  };

  const submitRejectToDesigner = async () => {
    const v = await rejectDesignerForm.validateFields();
    const attachmentFileIds = rejectDesignerAttachList
      .filter((f) => f.status === 'done')
      .map((f) => (f.response as FileInfo | undefined)?.id)
      .filter((id): id is number => id != null && !Number.isNaN(Number(id)));
    try {
      await orderService.modelerRejectToDesigner(orderId, {
        message: v.rejectMessage as string,
        attachmentFileIds: attachmentFileIds.length ? attachmentFileIds : undefined,
      });
      message.success('已驳回给设计师，订单已回到「设计中」');
      rejectDesignerForm.resetFields();
      setRejectDesignerAttachList([]);
      refresh();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    }
  };

  const onRejectToCustomerClick = () => {
    void orderService.modelerRejectToCustomer(orderId).catch(() => {
      /* 501 等错误由 api 拦截器统一提示 */
    });
  };

  const saveReview = async () => {
    const v = await reviewForm.validateFields();
    const arr = v.rejectedProcessesText
      ? String(v.rejectedProcessesText)
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    await orderService.updateOrderReview(orderId, {
      trackerId: v.trackerId,
      reviewNotes: v.reviewNotes,
      rejectionReason: v.rejectionReason,
      rejectedProcesses: arr.length ? arr : undefined,
    });
    message.success('评审已保存');
    refresh();
  };

  const saveQuote = async () => {
    const v = await quoteForm.validateFields();
    await orderService.updateOrderQuotation(orderId, v);
    message.success('报价已保存');
    refresh();
  };

  const previewFile = async (fileId: number) => {
    const url = await orderService.previewFile(fileId);
    if (url && /^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      message.warning('无法预览：未返回有效 URL');
    }
  };

  const fileColumns: ColumnsType<FileInfo> = [
    { title: '文件名', dataIndex: 'fileName', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'fileSize',
      width: 100,
      render: (n: number) => (n != null ? `${(n / 1024).toFixed(1)} KB` : '-'),
    },
    { title: '上传者', dataIndex: 'uploaderName', width: 100 },
    {
      title: '时间',
      dataIndex: 'uploadTime',
      width: 170,
      render: (t) => (t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'op',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" onClick={() => previewFile(r.id)}>
            打开 / 下载
          </Button>
        </Space>
      ),
    },
  ];

  const getTaskForm = () => {
    if (!order) return null;

    if (isDesigner) {
      return (
        <Form form={designForm} layout="vertical" style={{ maxWidth: 720 }}>
          <Form.Item name="designerId" label="设计师">
            <Select
              allowClear
              options={designers.map((u) => ({
                value: u.id,
                label: `${u.realName || u.username}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="engravingText" label="字印">
            <Input />
          </Form.Item>
          <Form.Item name="materialType" label="材质类型">
            <Select
              allowClear
              placeholder="请选择材质"
              options={materialConfig.map((m) => ({
                value: m.type,
                label: `${m.name} (${m.type})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="handSize" label="手寸/链长">
            <Input />
          </Form.Item>
          <Form.Item label="工艺选择">
            <Select
              mode="multiple"
              placeholder="请选择工艺（可多选）"
              value={selectedProcesses}
              onChange={setSelectedProcesses}
              options={craftSelectOptions}
            />
          </Form.Item>
          <Form.Item name="designNotes" label="设计备注">
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <Form.Item
            label="设计图片"
            extra="支持多张图片；上传成功即可预览缩略图，点击「保存设计信息」写入订单。"
          >
            <UploadWithImagePreview
              listType="picture-card"
              accept="image/*"
              multiple
              fileList={designImageFileList}
              onChange={handleDesignUploadChange}
              customRequest={handleDesignCustomRequest}
            >
              <div>
                <PlusOutlined />
                <div style={{ marginTop: 8 }}>上传</div>
              </div>
            </UploadWithImagePreview>
          </Form.Item>
          
          <Button type="primary" onClick={saveDesign}>
            保存设计信息
          </Button>

          {canShareCustomerProgress && (
            <Card size="small" title="客户进度分享" style={{ marginTop: 16 }}>
              <Paragraph type="secondary" style={{ marginTop: 0 }}>
                生成安全链接后，客户无需登录即可在手机查看进度。可下载带二维码的小名片图发给客户。
              </Paragraph>
              <Space wrap>
                <Button type="primary" loading={customerProgressBusy} onClick={() => void onGenerateCustomerProgress()}>
                  生成客户进度二维码
                </Button>
                <Button
                  disabled={!customerProgressLink}
                  loading={customerProgressBusy}
                  onClick={() => void onDownloadCustomerCard()}
                >
                  下载名片 PNG
                </Button>
              </Space>
              {customerProgressLink && (
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">客户打开链接（已写入二维码）：</Text>
                  <Paragraph copyable style={{ marginBottom: 8 }}>
                    {customerProgressLink.publicPageUrl}
                  </Paragraph>
                  {customerProgressLink.expiresAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      有效期至 {dayjs(customerProgressLink.expiresAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  )}
                </div>
              )}
              {customerCardPreviewUrl && (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">名片预览</Text>
                  <div>
                    <img
                      alt="客户进度名片"
                      src={customerCardPreviewUrl}
                      style={{ maxWidth: 360, width: '100%', borderRadius: 8, border: '1px solid #eee' }}
                    />
                  </div>
                </div>
              )}
            </Card>
          )}
        </Form>
      );
    }

    if (isModeler) {
      const canReject =
        order.currentStatus === OrderStatus.PENDING_MODEL || order.currentStatus === OrderStatus.MODELING;
      return (
        <div style={{ maxWidth: 720 }}>
          {canReject && (
            <Collapse
              style={{ marginBottom: 16 }}
              defaultActiveKey={[]}
              items={[
                {
                  key: 'actions',
                  label: '执行操作（驳回等，默认折叠）',
                  children: (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <Card size="small" title="驳回给设计师">
                        <Form form={rejectDesignerForm} layout="vertical">
                          <Form.Item
                            name="rejectMessage"
                            label="说明"
                            rules={[{ required: true, message: '请填写需要设计师补充的内容' }]}
                          >
                            <Input.TextArea rows={4} placeholder="说明需补充的设计细节、参考等" />
                          </Form.Item>
                          <Form.Item label="参考图（可选）" extra="上传的图片将作为附件 ID 一并提交。">
                            <UploadWithImagePreview
                              listType="picture-card"
                              accept="image/*"
                              multiple
                              fileList={rejectDesignerAttachList}
                              onChange={handleRejectDesignerAttachChange}
                              customRequest={handleRejectDesignerAttachRequest}
                            >
                              <div>
                                <PlusOutlined />
                                <div style={{ marginTop: 8 }}>上传</div>
                              </div>
                            </UploadWithImagePreview>
                          </Form.Item>
                          <Button danger type="primary" onClick={() => void submitRejectToDesigner()}>
                            提交：驳回给设计师
                          </Button>
                        </Form>
                      </Card>
                      <Card size="small" title="驳回给客户 / 上游">
                        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                          占位：需约定订单是否进入「待客户补充」等状态，并与 B2B / 企微通知打通后再实现后端与按钮逻辑。
                        </Paragraph>
                        <Button onClick={() => void onRejectToCustomerClick()}>尝试驳回给客户（将提示未开放）</Button>
                      </Card>
                    </Space>
                  ),
                },
              ]}
            />
          )}
          <Form form={modelForm} layout="vertical" style={{ maxWidth: 520 }}>
            <Form.Item name="modelerId" label="建模师">
              <Select
                allowClear
                options={modelers.map((u) => ({
                  value: u.id,
                  label: `${u.realName || u.username}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="weight" label="克重">
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="modelNotes" label="建模备注">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item
              label="效果图"
              extra="支持多张图片；上传后点「保存建模信息」写入订单（与设计师设计图存法一致）。"
            >
              <UploadWithImagePreview
                listType="picture-card"
                accept="image/*"
                multiple
                fileList={modelEffectImageFileList}
                onChange={handleModelEffectUploadChange}
                customRequest={handleModelEffectCustomRequest}
              >
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传</div>
                </div>
              </UploadWithImagePreview>
            </Form.Item>
            <Form.Item
              label="建模源文件（STL / ZIP 等）"
              extra="先上传文件，再保存建模信息；保存时会写入本单的 MODEL 类型文件引用。"
            >
              <UploadWithImagePreview
                multiple
                imageOnlyRasterPreview
                fileList={modelSourceFileList}
                onChange={handleModelSourceUploadChange}
                customRequest={handleModelSourceCustomRequest}
              >
                <Button icon={<PlusOutlined />}>上传源文件</Button>
              </UploadWithImagePreview>
            </Form.Item>
            <Button type="primary" onClick={saveModel}>
              保存建模信息
            </Button>
          </Form>
        </div>
      );
    }

    if (isTracker) {
      return (
        <Form form={reviewForm} layout="vertical" style={{ maxWidth: 720 }}>
          <Form.Item name="trackerId" label="跟单员">
            <Select
              allowClear
              options={trackers.map((u) => ({
                value: u.id,
                label: `${u.realName || u.username}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="reviewNotes" label="评审备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="rejectionReason" label="驳回原因（有内容则视为驳回）">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="rejectedProcessesText" label="驳回工艺（逗号分隔）">
            <Input placeholder="如：珐琅,拉丝" />
          </Form.Item>
          <Button type="primary" onClick={saveReview}>
            保存评审
          </Button>
        </Form>
      );
    }

    if (isSales || isAdmin) {
      return (
        <Form form={quoteForm} layout="vertical" style={{ maxWidth: 720 }}>
          <Space wrap>
            <Form.Item name="processCost" label="工艺费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="laborCost" label="工费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="stoneCost" label="石料费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="materialCost" label="材质费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="weightCost" label="克重费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="certificateCost" label="证书费">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="otherCost" label="其他费用">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="totalCost" label="总计">
              <InputNumber min={0} step={0.01} />
            </Form.Item>
          </Space>
          <Form.Item name="designBuyout" label="设计买断" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="designBuyoutCost" label="买断费用">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="confidential" label="保密不宣传" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="quotationNotes" label="报价备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" onClick={saveQuote}>
            保存报价
          </Button>
        </Form>
      );
    }

    return <Text type="secondary">您当前角色没有可编辑的任务</Text>;
  };

  const getOrderInfoTab = () => {
    if (!order) return null;

    return (
      <div style={{ maxWidth: 900 }}>
        <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="订单编号">
              {order.baseInfo.orderNumber || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={orderStatusColor(order.currentStatus)}>
                {orderStatusLabel(order.currentStatus)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="客户姓名">
              {order.baseInfo.customerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系方式">
              {order.baseInfo.customerContact || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="订单来源">
              {orderSourceLabel(order.baseInfo.source)}
            </Descriptions.Item>
            <Descriptions.Item label="定金">
              {order.baseInfo.depositAmount ? `¥${order.baseInfo.depositAmount}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="款式">
              {order.baseInfo.style || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="下单时间">
              {order.baseInfo.orderTime ? dayjs(order.baseInfo.orderTime).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="基础需求" span={2}>
              <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                {order.baseInfo.basicRequirements || '-'}
              </Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="材质信息" span={2}>
              {order.baseInfo.materialInfo || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {(order.wecomJoinQrBase64 || order.wecomJoinError) && (
          <Card size="small" title="企业微信客户群" style={{ marginBottom: 16 }}>
            {order.wecomJoinError && (
              <Alert type="warning" showIcon message="自动配置进群方式未成功" description={order.wecomJoinError} />
            )}
            {order.wecomJoinQrBase64 && (
              <div style={{ marginTop: order.wecomJoinError ? 12 : 0 }}>
                <Text type="secondary">请客户使用微信扫描下方二维码加入客户群；若刚创建订单，可稍后刷新本页。</Text>
                <div style={{ marginTop: 12 }}>
                  <img
                    alt="客户进群二维码"
                    style={{ maxWidth: 280, display: 'block' }}
                    src={`data:image/jpeg;base64,${order.wecomJoinQrBase64}`}
                  />
                </div>
              </div>
            )}
          </Card>
        )}

        <Card size="small" title="分配信息" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="售前客服">
              {order.assignedPreSalesName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="售中客服">
              {order.assignedSalesName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="设计师">
              {order.designInfo?.designerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="建模师">
              {order.modelInfo?.modelerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="跟单员">
              {order.reviewInfo?.trackerName || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card size="small" title="设计信息" style={{ marginBottom: 16 }}>
          {order.designInfo ? (
            <>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="字印">
                  {order.designInfo.engravingText || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="材质类型">
                  {order.designInfo.materialType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="手寸/链长">
                  {order.designInfo.handSize || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="设计通过">
                  {order.designInfo.designPassed ? (
                    <Tag color="success">已通过</Tag>
                  ) : (
                    <Tag color="default">未通过</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="设计备注" span={2}>
                  {order.designInfo.designNotes || '-'}
                </Descriptions.Item>
              </Descriptions>
              
              {order.designInfo.designImages && order.designInfo.designImages.length > 0 && (
                <>
                  <Divider style={{ margin: '16px 0 8px 0' }}>设计图片</Divider>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {order.designInfo.designImages.map((url, index) => (
                      <Image
                        key={index}
                        width={120}
                        height={120}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        src={url}
                        alt={`设计图 ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Text type="secondary">暂无设计信息</Text>
          )}
        </Card>

        <Card size="small" title="建模信息" style={{ marginBottom: 16 }}>
          {order.modelInfo ? (
            <>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="克重">
                  {order.modelInfo.weight ? `${order.modelInfo.weight}g` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="建模备注" span={2}>
                  {order.modelInfo.modelNotes || '-'}
                </Descriptions.Item>
                {order.modelInfo.lastRejectToDesignerMessage && (
                  <Descriptions.Item label="建模师驳回说明" span={2}>
                    <Text type="warning">{order.modelInfo.lastRejectToDesignerMessage}</Text>
                  </Descriptions.Item>
                )}
              </Descriptions>
              {order.modelInfo.modelEffectImages && order.modelInfo.modelEffectImages.length > 0 && (
                <>
                  <Divider style={{ margin: '16px 0 8px 0' }}>建模效果图</Divider>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {order.modelInfo.modelEffectImages.map((url, index) => (
                      <Image
                        key={index}
                        width={120}
                        height={120}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        src={url}
                        alt={`效果图 ${index + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Text type="secondary">暂无建模信息</Text>
          )}
        </Card>

        <Card size="small" title="评审信息" style={{ marginBottom: 16 }}>
          {order.reviewInfo ? (
            <>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="评审备注" span={2}>
                  {order.reviewInfo.reviewNotes || '-'}
                </Descriptions.Item>
                {order.reviewInfo.rejectionReason && (
                  <Descriptions.Item label="驳回原因" span={2}>
                    <Text type="danger">{order.reviewInfo.rejectionReason}</Text>
                  </Descriptions.Item>
                )}
                {order.reviewInfo.rejectedProcesses && order.reviewInfo.rejectedProcesses.length > 0 && (
                  <Descriptions.Item label="驳回工艺" span={2}>
                    {order.reviewInfo.rejectedProcesses.join(', ')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </>
          ) : (
            <Text type="secondary">暂无评审信息</Text>
          )}
        </Card>

        <Card size="small" title="报价信息" style={{ marginBottom: 16 }}>
          {order.quotationInfo ? (
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label="工艺费">
                {order.quotationInfo.processCost ? `¥${order.quotationInfo.processCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="工费">
                {order.quotationInfo.laborCost ? `¥${order.quotationInfo.laborCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="石料费">
                {order.quotationInfo.stoneCost ? `¥${order.quotationInfo.stoneCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="材质费">
                {order.quotationInfo.materialCost ? `¥${order.quotationInfo.materialCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="克重费">
                {order.quotationInfo.weightCost ? `¥${order.quotationInfo.weightCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="证书费">
                {order.quotationInfo.certificateCost ? `¥${order.quotationInfo.certificateCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="其他费用">
                {order.quotationInfo.otherCost ? `¥${order.quotationInfo.otherCost}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="总计">
                <Text strong>
                  {order.quotationInfo.totalCost ? `¥${order.quotationInfo.totalCost}` : '-'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="设计买断">
                {order.quotationInfo.designBuyout ? (
                  <Tag color="blue">是 ¥{order.quotationInfo.designBuyoutCost || 0}</Tag>
                ) : (
                  <Tag>否</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="保密不宣传">
                {order.quotationInfo.confidential ? <Tag color="red">是</Tag> : <Tag>否</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="报价备注" span={2}>
                {order.quotationInfo.quotationNotes || '-'}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">暂无报价信息</Text>
          )}
        </Card>

        <Card size="small" title="附件">
          {files.length > 0 ? (
            <Table
              rowKey="id"
              size="small"
              columns={fileColumns}
              dataSource={files}
              pagination={false}
            />
          ) : (
            <Text type="secondary">暂无附件</Text>
          )}
        </Card>
      </div>
    );
  };

  if (!order && !loading) {
    return (
      <Card>
        <Text>订单不存在</Text>
        <Button onClick={() => navigate('/orders')}>返回</Button>
      </Card>
    );
  }

  return (
    <div>
      <Card loading={loading} bordered={false}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            订单 {order?.baseInfo.orderNumber}
          </Title>
          {order && (
            <Tag color={orderStatusColor(order.currentStatus)}>
              {orderStatusLabel(order.currentStatus)}
            </Tag>
          )}
          <Space size={4} align="center">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => void orderService.downloadOrderHtml(orderId).catch((err) => message.error(String(err?.message || err)))}
            >
              导出 HTML 工单
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() =>
                void orderService.downloadOrderMarkdown(orderId).catch((err) => message.error(String(err?.message || err)))
              }
            >
              Markdown
            </Button>
          </Space>
        </Space>

        {/* 不用 Tabs.styles：部分 antd/@types 组合下 ts-loader 会报 TS2322；外层滚动与 flex minHeight:0 等效 */}
        <div
          style={{
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          <Tabs
            items={[
              {
                key: 'info',
                label: '📋 订单信息',
                children: getOrderInfoTab(),
              },
              {
                key: 'task',
                label: '✏️ 我的任务',
                children: getTaskForm(),
              },
            ]}
          />
        </div>
      </Card>

      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1000,
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={goToPrevOrder}
          disabled={!relatedOrders.length || currentOrderIndex <= 0}
          style={{ borderRadius: '50%', width: 48, height: 48, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        />
        <Button
          icon={<ArrowRightOutlined />}
          onClick={goToNextOrder}
          disabled={!relatedOrders.length || currentOrderIndex >= relatedOrders.length - 1}
          style={{ borderRadius: '50%', width: 48, height: 48, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        />
      </div>

      <div style={{ position: 'fixed', bottom: 28, right: 80, zIndex: 1000 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {relatedOrders.length > 0 ? `${currentOrderIndex + 1} / ${relatedOrders.length}` : ''}
        </Text>
      </div>
    </div>
  );
};

export default OrderDetailPage;
