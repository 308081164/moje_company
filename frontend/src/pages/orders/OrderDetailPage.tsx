import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
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
  Upload,
  message,
  Divider,
  Image,
  Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '@/services/orderService';
import { userService } from '@/services/userService';
import type { FileInfo, OrderInfo, ProcessInfo } from '@/types/order';
import { OrderSource, OrderStatus } from '@/types/order';
import { UserRole } from '@/types/auth';
import type { UserInfo } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';
import { useCurrentUser, useIsAdmin, useIsSales, useIsDesigner, useIsModeler, useIsTracker, useIsPreSales } from '@/stores/authStore';

const { Title, Text, Paragraph } = Typography;

async function loadUsersByRole(role: UserRole): Promise<UserInfo[]> {
  const res = await userService.getUsers({ page: 0, size: 500, role });
  return res.content || [];
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
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [relatedOrders, setRelatedOrders] = useState<OrderInfo[]>([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [materialConfig, setMaterialConfig] = useState<{ type: string; name: string; priceFormula: string }[]>([]);
  const [processConfig, setProcessConfig] = useState<ProcessInfo[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);

  const [salesUsers, setSalesUsers] = useState<UserInfo[]>([]);
  const [designers, setDesigners] = useState<UserInfo[]>([]);
  const [modelers, setModelers] = useState<UserInfo[]>([]);
  const [trackers, setTrackers] = useState<UserInfo[]>([]);

  const [designForm] = Form.useForm();
  const [modelForm] = Form.useForm();
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
      setDesignImages(o.designInfo?.designImages || []);
      setSelectedProcesses(
        o.designInfo?.processInfo?.map(p => String(p.processType)) || []
      );
      
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

  const handleDesignImageUpload = async (file: File) => {
    try {
      const result = await orderService.uploadDesignFile(orderId, file);
      if (result.fileUrl) {
        setDesignImages([...designImages, result.fileUrl]);
        message.success('设计图片上传成功');
      }
    } catch (error) {
      message.error('设计图片上传失败');
    }
    return false;
  };

  const removeDesignImage = (index: number) => {
    const newImages = [...designImages];
    newImages.splice(index, 1);
    setDesignImages(newImages);
  };

  const saveDesign = async () => {
    const v = await designForm.validateFields();
    const processInfo = selectedProcesses.map((processType) => ({
      processType: processType as any,
      additionalCost: 0,
    }));
    await orderService.updateOrderDesign(orderId, {
      designerId: v.designerId,
      engravingText: v.engravingText,
      materialType: v.materialType,
      handSize: v.handSize,
      designNotes: v.designNotes,
      designImages: designImages,
      processInfo,
    });
    message.success('设计信息已保存');
    refresh();
  };

  const saveModel = async () => {
    const v = await modelForm.validateFields();
    await orderService.updateOrderModel(orderId, {
      modelerId: v.modelerId,
      weight: v.weight,
      modelNotes: v.modelNotes,
    });
    message.success('建模信息已保存');
    refresh();
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
              options={processConfig.map((p) => ({
                value: String(p.processType),
                label: String(p.processType),
              }))}
            />
          </Form.Item>
          <Form.Item name="designNotes" label="设计备注">
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <Form.Item label="设计图片">
            <div style={{ marginBottom: 16 }}>
              <Upload
                beforeUpload={handleDesignImageUpload}
                showUploadList={false}
                accept="image/*"
                multiple
              >
                <Button type="dashed">上传设计图片</Button>
              </Upload>
            </div>
            
            {designImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {designImages.map((url, index) => (
                  <div
                    key={index}
                    style={{
                      position: 'relative',
                      width: 120,
                      height: 120,
                      border: '1px solid #d9d9d9',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={url}
                      alt={`设计图 ${index + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => removeDesignImage(index)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Form.Item>
          
          <Button type="primary" onClick={saveDesign}>
            保存设计信息
          </Button>
        </Form>
      );
    }

    if (isModeler) {
      return (
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
          <Button type="primary" onClick={saveModel}>
            保存建模信息
          </Button>
        </Form>
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
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="克重">
                {order.modelInfo.weight ? `${order.modelInfo.weight}g` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="建模备注" span={2}>
                {order.modelInfo.modelNotes || '-'}
              </Descriptions.Item>
            </Descriptions>
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
          <Button icon={<DownloadOutlined />} onClick={() => orderService.downloadOrderMarkdown(orderId)}>
            导出 Markdown
          </Button>
        </Space>

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
