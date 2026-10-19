import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import {
  storefrontAdminService,
  type AdminStorefrontListing,
  type AdminStorefrontOrder,
  type AdminStorefrontSeller,
  type AdminStorefrontWithdrawal,
} from '@/services/storefrontAdminService';
import { API_ORIGIN } from '@/services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

/** 封面图 URL 解析：绝对地址原样使用；/api 等相对路径补 API_ORIGIN */
const resolveCover = (url?: string | null): string => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
};

const fmtTime = (v?: string | null) => (v ? v.replace('T', ' ').slice(0, 19) : '-');
const fmtMoney = (v?: number | null) =>
  v === null || v === undefined ? '-' : `$${Number(v).toFixed(2)}`;

const LISTING_STATUS: Record<string, { color: string; label: string }> = {
  PUBLISHED: { color: 'green', label: '已上架' },
  PAUSED: { color: 'orange', label: '已下架' },
};

// ==================== 商品管理 ====================

const ListingTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStorefrontListing[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStorefrontListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storefrontAdminService.listings({
        status: status || undefined,
        keyword: keyword.trim() || undefined,
      });
      setRows(res || []);
    } finally {
      setLoading(false);
    }
  }, [status, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (r: AdminStorefrontListing) => {
    setEditing(r);
    form.setFieldsValue({
      title: r.title,
      description: r.description || '',
      salePrice: r.salePrice,
      coverImageUrl: r.coverImageUrl || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!editing) return;
    const v = await form.validateFields();
    setSaving(true);
    try {
      await storefrontAdminService.updateListing(editing.id, {
        title: (v.title || '').trim(),
        description: v.description || '',
        salePrice: v.salePrice,
        coverImageUrl: (v.coverImageUrl || '').trim(),
      });
      message.success('已保存');
      setModalOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: AdminStorefrontListing) => {
    if (r.status === 'PUBLISHED') {
      await storefrontAdminService.pauseListing(r.id);
      message.success('已下架');
    } else {
      await storefrontAdminService.republishListing(r.id);
      message.success('已重新上架');
    }
    void load();
  };

  const columns: ColumnsType<AdminStorefrontListing> = [
    {
      title: '封面',
      width: 84,
      render: (_, r) =>
        r.coverImageUrl ? (
          <Image
            src={resolveCover(r.coverImageUrl)}
            width={56}
            height={56}
            style={{ objectFit: 'cover', borderRadius: 6 }}
          />
        ) : (
          <Text type="secondary">无图</Text>
        ),
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '卖家账号', dataIndex: 'sellerDisplayName', width: 150 },
    {
      title: '售价',
      dataIndex: 'salePrice',
      width: 110,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const s = LISTING_STATUS[v] || { color: 'default', label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    { title: '销量', dataIndex: 'soldCount', width: 80, align: 'right' },
    {
      title: '上架时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => fmtTime(v),
    },
    {
      title: '操作',
      width: 170,
      render: (_, r) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm
            title={r.status === 'PUBLISHED' ? '确认下架该商品？' : '确认重新上架该商品？'}
            onConfirm={() => void toggle(r)}
          >
            <Button type="link" size="small" danger={r.status === 'PUBLISHED'}>
              {r.status === 'PUBLISHED' ? '下架' : '重新上架'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const coverDraft = Form.useWatch('coverImageUrl', form);

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 130 }}
          value={status}
          onChange={(v) => setStatus(v)}
          options={[
            { value: 'PUBLISHED', label: '已上架' },
            { value: 'PAUSED', label: '已下架' },
          ]}
        />
        <Input.Search
          placeholder="搜索标题"
          allowClear
          style={{ width: 240 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => void load()}
        />
        <Button type="primary" onClick={() => void load()}>
          查询
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      <Modal
        title={`编辑商品 #${editing?.id ?? ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submit()}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, whitespace: true, message: '标题不能为空' }]}
          >
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} maxLength={2000} />
          </Form.Item>
          <Form.Item
            name="salePrice"
            label="售价（USD）"
            rules={[
              { required: true, message: '请填写售价' },
              { type: 'number', min: 0.01, message: '售价必须大于 0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} precision={2} min={0} />
          </Form.Item>
          <Form.Item name="coverImageUrl" label="封面图 URL">
            <Input placeholder="https://… 或 /api/files/…" />
          </Form.Item>
          {coverDraft ? (
            <Image
              src={resolveCover(coverDraft)}
              width={120}
              height={120}
              style={{ objectFit: 'cover', borderRadius: 8 }}
            />
          ) : null}
        </Form>
      </Modal>
    </>
  );
};

// ==================== 商城订单 ====================

const ORDER_STATUS_OPTIONS = [
  'PENDING_DESIGN',
  'DESIGNING',
  'PENDING_MODEL',
  'MODELING',
  'PENDING_REVIEW',
  'PENDING_PRODUCTION',
  'PRODUCING',
  'COMPLETED',
  'CANCELLED',
];

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_DESIGN: '设计中',
  DESIGNING: '设计复审中',
  PENDING_MODEL: '建模中',
  MODELING: '建模修改中',
  PENDING_REVIEW: '待工艺验证',
  PENDING_PRODUCTION: '待生产',
  PRODUCING: '生产中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const OrderTab: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStorefrontOrder[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | undefined>();
  const [keyword, setKeyword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storefrontAdminService.orders({
        page,
        size,
        status: status || undefined,
        keyword: keyword.trim() || undefined,
      });
      setRows(res?.content || []);
      setTotal(res?.totalElements ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, size, status, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AdminStorefrontOrder> = [
    { title: '订单号', dataIndex: 'orderNumber', width: 170 },
    { title: '买家', dataIndex: 'buyerName', width: 130, ellipsis: true },
    { title: '卖家', dataIndex: 'sellerDisplayName', width: 140, ellipsis: true },
    {
      title: '售价',
      dataIndex: 'salePrice',
      width: 100,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '代工费',
      dataIndex: 'productionFee',
      width: 100,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '代邮费',
      dataIndex: 'shippingFee',
      width: 100,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '卖家应得',
      dataIndex: 'sellerPayout',
      width: 100,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string, r) => (
        <Tag color={v === 'COMPLETED' ? 'green' : v === 'CANCELLED' ? 'default' : 'blue'}>
          {r.statusLabel || ORDER_STATUS_LABELS[v] || v}
        </Tag>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'orderTime',
      width: 170,
      render: (v: string, r) => fmtTime(v || r.createdAt),
    },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => navigate(`/orders/${r.orderId}`)}>
          订单详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder="订单状态"
          style={{ width: 150 }}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={ORDER_STATUS_OPTIONS.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] || s }))}
        />
        <Input.Search
          placeholder="搜索订单号/买家"
          allowClear
          style={{ width: 240 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => {
            setPage(0);
            void load();
          }}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(0);
            void load();
          }}
        >
          查询
        </Button>
      </Space>
      <Table
        rowKey="orderId"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page + 1,
          pageSize: size,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p - 1),
        }}
      />
    </>
  );
};

// ==================== 卖家概览 ====================

const SellerTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStorefrontSeller[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storefrontAdminService.sellers();
      setRows(res || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AdminStorefrontSeller> = [
    { title: '卖家', dataIndex: 'displayName', width: 160 },
    {
      title: '联系方式',
      width: 200,
      render: (_, r) => r.contact || r.email || '-',
    },
    { title: '上架数', dataIndex: 'listingCount', width: 90, align: 'right' },
    { title: '在售', dataIndex: 'publishedCount', width: 80, align: 'right' },
    { title: '销量', dataIndex: 'soldCount', width: 80, align: 'right' },
    {
      title: '可提现',
      dataIndex: 'availableBalance',
      width: 110,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '待结算',
      dataIndex: 'pendingBalance',
      width: 110,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '累计收益',
      dataIndex: 'totalEarned',
      width: 110,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '已提现',
      dataIndex: 'totalWithdrawn',
      width: 110,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
  ];

  return (
    <Table
      rowKey="accountId"
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
    />
  );
};

// ==================== 提现记录 ====================

const WithdrawalTab: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminStorefrontWithdrawal[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await storefrontAdminService.withdrawals();
      setRows(res || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AdminStorefrontWithdrawal> = [
    { title: '单号', dataIndex: 'id', width: 90 },
    { title: '卖家', dataIndex: 'sellerDisplayName', width: 180 },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (v: number) => fmtMoney(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Tag color={v === 'PAID' ? 'green' : 'orange'}>{v === 'PAID' ? '已到账' : v}</Tag>,
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v: string) => fmtTime(v),
    },
  ];

  return (
    <>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        提现为模拟即时到账，本列表只读。
      </Text>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />
    </>
  );
};

// ==================== 页面 ====================

const StorefrontAdminPage: React.FC = () => {
  return (
    <Card style={{ margin: 16 }}>
      <Title level={4} style={{ marginTop: 0 }}>
        独立站商城管理
      </Title>
      <Tabs
        defaultActiveKey="listings"
        items={[
          { key: 'listings', label: '商品管理', children: <ListingTab /> },
          { key: 'orders', label: '商城订单', children: <OrderTab /> },
          { key: 'sellers', label: '卖家概览', children: <SellerTab /> },
          { key: 'withdrawals', label: '提现记录', children: <WithdrawalTab /> },
        ]}
      />
    </Card>
  );
};

export default StorefrontAdminPage;
