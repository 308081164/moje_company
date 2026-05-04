import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '@/services/orderService';
import { userService } from '@/services/userService';
import type { FileInfo, OrderInfo } from '@/types/order';
import { OrderSource, OrderStatus } from '@/types/order';
import { UserRole } from '@/types/auth';
import type { UserInfo } from '@/types/auth';
import { orderSourceLabel, orderStatusColor, orderStatusLabel } from '@/utils/orderLabels';

const { Title, Text } = Typography;

async function loadUsersByRole(role: UserRole): Promise<UserInfo[]> {
  const res = await userService.getUsers({ page: 0, size: 500, role });
  return res.content || [];
}

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = Number(id);

  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileInfo[]>([]);

  const [salesUsers, setSalesUsers] = useState<UserInfo[]>([]);
  const [designers, setDesigners] = useState<UserInfo[]>([]);
  const [modelers, setModelers] = useState<UserInfo[]>([]);
  const [trackers, setTrackers] = useState<UserInfo[]>([]);

  const [baseForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [designForm] = Form.useForm();
  const [modelForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [statusForm] = Form.useForm();

  const refresh = useCallback(async () => {
    if (!orderId || Number.isNaN(orderId)) return;
    setLoading(true);
    try {
      const o = await orderService.getOrderById(orderId);
      setOrder(o);
      baseForm.setFieldsValue({
        customerName: o.baseInfo.customerName,
        customerContact: o.baseInfo.customerContact,
        source: o.baseInfo.source,
        sourceDetail: o.baseInfo.sourceDetail,
        depositAmount: o.baseInfo.depositAmount,
        basicRequirements: o.baseInfo.basicRequirements,
        orderTime: o.baseInfo.orderTime ? dayjs(o.baseInfo.orderTime) : undefined,
        style: o.baseInfo.style,
        materialInfo: o.baseInfo.materialInfo,
      });
      assignForm.setFieldsValue({
        salesId: o.assignedSalesId,
        designerId: o.designInfo?.designerId,
        modelerId: o.modelInfo?.modelerId,
        trackerId: o.reviewInfo?.trackerId,
      });
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
      statusForm.setFieldsValue({
        status: o.currentStatus,
        notes: '',
      });
      const fl = await orderService.getOrderFiles(orderId);
      setFiles(fl);
    } catch (e) {
      message.error('加载订单失败');
    } finally {
      setLoading(false);
    }
  }, [orderId, baseForm, assignForm, designForm, modelForm, reviewForm, quoteForm, statusForm]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const saveBase = async () => {
    const v = await baseForm.validateFields();
    await orderService.updateOrder(orderId, {
      customerName: v.customerName,
      customerContact: v.customerContact,
      source: v.source,
      sourceDetail: v.sourceDetail,
      depositAmount: v.depositAmount,
      basicRequirements: v.basicRequirements,
      orderTime: v.orderTime ? v.orderTime.format('YYYY-MM-DD HH:mm:ss') : undefined,
      style: v.style,
      materialInfo: v.materialInfo,
    });
    message.success('基本信息已保存');
    refresh();
  };

  const saveAssign = async () => {
    const v = await assignForm.validateFields();
    await orderService.assignOrder(orderId, {
      salesId: v.salesId,
      designerId: v.designerId,
      modelerId: v.modelerId,
      trackerId: v.trackerId,
    });
    message.success('分配已保存');
    refresh();
  };

  const saveDesign = async () => {
    const v = await designForm.validateFields();
    await orderService.updateOrderDesign(orderId, {
      designerId: v.designerId,
      engravingText: v.engravingText,
      materialType: v.materialType,
      handSize: v.handSize,
      designNotes: v.designNotes,
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

  const changeStatus = async () => {
    const v = await statusForm.validateFields();
    await orderService.changeOrderStatus(orderId, {
      status: v.status,
      notes: v.notes,
    });
    message.success('状态已更新');
    refresh();
  };

  const copyOrder = async () => {
    const o = await orderService.copyOrder(orderId);
    message.success('已复制订单');
    navigate(`/orders/${o.baseInfo.id}`);
  };

  const removeOrder = async () => {
    await orderService.deleteOrder(orderId);
    message.success('已删除');
    navigate('/orders');
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
          <Button icon={<CopyOutlined />} onClick={copyOrder}>
            复制订单
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => orderService.downloadOrderMarkdown(orderId)}
          >
            导出 Markdown
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => orderService.downloadOrderHtml(orderId)}
          >
            导出 HTML
          </Button>
          <Popconfirm title="确定删除该订单？" onConfirm={removeOrder}>
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>

        {order && (
          <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="客户">
              {order.baseInfo.customerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系方式">{order.baseInfo.customerContact}</Descriptions.Item>
            <Descriptions.Item label="来源">
              {orderSourceLabel(order.baseInfo.source)}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Tabs
          items={[
            {
              key: 'base',
              label: '基本信息',
              children: (
                <Form form={baseForm} layout="vertical" style={{ maxWidth: 720 }}>
                  <Form.Item name="customerName" label="客户姓名">
                    <Input />
                  </Form.Item>
                  <Form.Item name="customerContact" label="联系方式" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="source" label="来源">
                    <Select
                      options={Object.values(OrderSource).map((s) => ({
                        value: s,
                        label: orderSourceLabel(s),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="sourceDetail" label="来源详情（达人等）">
                    <Input />
                  </Form.Item>
                  <Form.Item name="depositAmount" label="定金">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="basicRequirements" label="基础需求">
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Form.Item name="orderTime" label="下单时间">
                    <DatePicker showTime style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="style" label="款式">
                    <Input />
                  </Form.Item>
                  <Form.Item name="materialInfo" label="材质信息">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Button type="primary" onClick={saveBase}>
                    保存基本信息
                  </Button>
                </Form>
              ),
            },
            {
              key: 'assign',
              label: '分配',
              children: (
                <Form form={assignForm} layout="vertical" style={{ maxWidth: 520 }}>
                  <Form.Item name="salesId" label="售中客服">
                    <Select
                      allowClear
                      placeholder="选择用户"
                      options={salesUsers.map((u) => ({
                        value: u.id,
                        label: `${u.realName || u.username} (${u.id})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="designerId" label="设计师">
                    <Select
                      allowClear
                      placeholder="选择用户"
                      options={designers.map((u) => ({
                        value: u.id,
                        label: `${u.realName || u.username} (${u.id})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="modelerId" label="建模师">
                    <Select
                      allowClear
                      placeholder="选择用户"
                      options={modelers.map((u) => ({
                        value: u.id,
                        label: `${u.realName || u.username} (${u.id})`,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="trackerId" label="跟单员">
                    <Select
                      allowClear
                      placeholder="选择用户"
                      options={trackers.map((u) => ({
                        value: u.id,
                        label: `${u.realName || u.username} (${u.id})`,
                      }))}
                    />
                  </Form.Item>
                  <Button type="primary" onClick={saveAssign}>
                    保存分配
                  </Button>
                </Form>
              ),
            },
            {
              key: 'design',
              label: '设计',
              children: (
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
                  <Form.Item name="materialType" label="材质类型（字符串）">
                    <Input placeholder="如 SILVER_925" />
                  </Form.Item>
                  <Form.Item name="handSize" label="手寸/链长">
                    <Input />
                  </Form.Item>
                  <Form.Item name="designNotes" label="设计备注">
                    <Input.TextArea rows={4} />
                  </Form.Item>
                  <Button type="primary" onClick={saveDesign}>
                    保存设计信息
                  </Button>
                </Form>
              ),
            },
            {
              key: 'model',
              label: '建模',
              children: (
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
              ),
            },
            {
              key: 'review',
              label: '评审',
              children: (
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
                  <Form.Item
                    name="rejectedProcessesText"
                    label="驳回工艺（逗号分隔）"
                  >
                    <Input placeholder="如：珐琅,拉丝" />
                  </Form.Item>
                  <Button type="primary" onClick={saveReview}>
                    保存评审
                  </Button>
                </Form>
              ),
            },
            {
              key: 'quote',
              label: '报价',
              children: (
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
              ),
            },
            {
              key: 'files',
              label: '附件',
              children: (
                <div>
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Upload
                      beforeUpload={(file) => {
                        orderService.uploadDesignFile(orderId, file).then(() => {
                          message.success('设计文件已上传');
                          refresh();
                        });
                        return false;
                      }}
                      showUploadList={false}
                    >
                      <Button type="primary">上传设计文件</Button>
                    </Upload>
                    <Upload
                      beforeUpload={(file) => {
                        orderService.uploadModelFile(orderId, file).then(() => {
                          message.success('建模文件已上传');
                          refresh();
                        });
                        return false;
                      }}
                      showUploadList={false}
                    >
                      <Button>上传建模文件</Button>
                    </Upload>
                  </Space>
                  <Table
                    rowKey="id"
                    size="small"
                    columns={fileColumns}
                    dataSource={files}
                    pagination={false}
                  />
                </div>
              ),
            },
            {
              key: 'status',
              label: '状态流转',
              children: (
                <Form form={statusForm} layout="vertical" style={{ maxWidth: 480 }}>
                  <Form.Item name="status" label="目标状态" rules={[{ required: true }]}>
                    <Select
                      options={Object.values(OrderStatus).map((s) => ({
                        value: s,
                        label: orderStatusLabel(s),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="notes" label="备注">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Button type="primary" onClick={changeStatus}>
                    变更状态
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default OrderDetailPage;
