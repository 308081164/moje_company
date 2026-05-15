import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  portalAdminService,
  type PortalJewelryCategory,
  type PortalShowcaseItemAdmin,
} from '@/services/portalAdminService';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PortalShowcaseAdminPage: React.FC = () => {
  const [cats, setCats] = useState<PortalJewelryCategory[]>([]);
  const [siteForm] = Form.useForm();
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<PortalJewelryCategory | null>(null);
  const [catForm] = Form.useForm();
  const [showCatId, setShowCatId] = useState<number | undefined>();
  const [showItems, setShowItems] = useState<PortalShowcaseItemAdmin[]>([]);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [reorderText, setReorderText] = useState('');

  const loadSite = useCallback(async () => {
    const s = await portalAdminService.getSiteSettings();
    siteForm.setFieldsValue({
      ...s,
      carouselFileIds: (s.carouselFileIds || []).join(','),
      companyPhotoFileIds: (s.companyPhotoFileIds || []).join(','),
    });
  }, [siteForm]);

  const loadCats = useCallback(async () => {
    const list = await portalAdminService.listCategories();
    setCats(list);
    setShowCatId((prev) => prev ?? (list[0]?.id as number | undefined));
  }, []);

  useEffect(() => {
    void loadSite().catch((e) => message.error(String(e)));
    void loadCats().catch((e) => message.error(String(e)));
  }, [loadSite, loadCats]);

  const loadShowcase = useCallback(async () => {
    if (!showCatId) return;
    const list = await portalAdminService.listShowcaseItems(showCatId);
    setShowItems(list);
    setReorderText(list.map((x) => x.id).join(','));
  }, [showCatId]);

  useEffect(() => {
    if (showCatId) void loadShowcase().catch((e) => message.error(String(e)));
  }, [showCatId, loadShowcase]);

  const saveSite = async () => {
    const v = await siteForm.validateFields();
    const parseIds = (s: string) =>
      String(s || '')
        .split(/[,，\s]+/)
        .map((x) => Number(x.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0);
    await portalAdminService.updateSiteSettings({
      heroTitle: v.heroTitle,
      heroSubtitle: v.heroSubtitle,
      aboutHtml: v.aboutHtml,
      businessHours: v.businessHours,
      contactPhone: v.contactPhone,
      contactWechat: v.contactWechat,
      contactEmail: v.contactEmail,
      address: v.address,
      carouselFileIds: parseIds(v.carouselFileIds),
      companyPhotoFileIds: parseIds(v.companyPhotoFileIds),
    });
    message.success('已保存门户站点配置');
    void loadSite();
  };

  const openCatModal = (c?: PortalJewelryCategory) => {
    setEditingCat(c || null);
    catForm.resetFields();
    if (c) catForm.setFieldsValue(c);
    setCatModal(true);
  };

  const saveCat = async () => {
    const v = await catForm.validateFields();
    if (editingCat) {
      await portalAdminService.updateCategory(editingCat.id, v);
      message.success('已更新分类');
    } else {
      await portalAdminService.createCategory(v);
      message.success('已创建分类');
    }
    setCatModal(false);
    void loadCats();
  };

  const fetchCandidates = async () => {
    const id = Number(orderIdInput);
    if (!id) {
      message.warning('请输入订单 ID');
      return;
    }
    const list = await portalAdminService.listShowcaseCandidates(id);
    setCandidates(list);
    message.info(`找到 ${list.length} 个候选图片`);
  };

  const addCandidate = async (fileId: number) => {
    if (!showCatId) {
      message.warning('请先选择分类');
      return;
    }
    await portalAdminService.addShowcaseItem({ categoryId: showCatId, fileId });
    message.success('已加入橱窗');
    void loadShowcase();
  };

  const applyReorder = async () => {
    if (!showCatId) return;
    const ids = reorderText
      .split(/[,，\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (!ids.length) {
      message.warning('请输入橱窗项 ID 顺序，逗号分隔');
      return;
    }
    await portalAdminService.reorderShowcase(showCatId, ids);
    message.success('排序已更新');
    void loadShowcase();
  };

  const catColumns: ColumnsType<PortalJewelryCategory> = [
    { title: 'slug', dataIndex: 'slug', width: 120 },
    { title: '中文名', dataIndex: 'nameCn' },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" onClick={() => openCatModal(r)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() =>
              Modal.confirm({
                title: '删除分类？',
                content: '将同时删除该分类下橱窗项',
                onOk: async () => {
                  await portalAdminService.deleteCategory(r.id);
                  message.success('已删除');
                  void loadCats();
                },
              })
            }
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const showColumns: ColumnsType<PortalShowcaseItemAdmin> = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '文件', dataIndex: 'fileName', ellipsis: true },
    { title: '类型', dataIndex: 'fileType', width: 110 },
    {
      title: '预览',
      width: 90,
      render: (_, r) =>
        r.fileUrl ? (
          <a href={r.fileUrl} target="_blank" rel="noreferrer">
            打开
          </a>
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      width: 90,
      render: (_, r) => (
        <Button
          type="link"
          danger
          size="small"
          onClick={() =>
            Modal.confirm({
              title: '移除橱窗项？',
              onOk: async () => {
                await portalAdminService.deleteShowcaseItem(r.id);
                void loadShowcase();
              },
            })
          }
        >
          移除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>B 端门户展示配置</Title>
      <Text type="secondary">保存后，门户网站通过公开接口自动读取最新内容。</Text>
      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'site',
            label: '站点与轮播',
            children: (
              <Card>
                <Form form={siteForm} layout="vertical" onFinish={() => void saveSite()}>
                  <Form.Item name="heroTitle" label="主标题">
                    <Input />
                  </Form.Item>
                  <Form.Item name="heroSubtitle" label="副标题">
                    <Input />
                  </Form.Item>
                  <Form.Item name="aboutHtml" label="关于我们（支持 HTML）">
                    <TextArea rows={6} />
                  </Form.Item>
                  <Form.Item name="businessHours" label="营业时间">
                    <Input />
                  </Form.Item>
                  <Form.Item name="contactPhone" label="联系电话">
                    <Input />
                  </Form.Item>
                  <Form.Item name="contactWechat" label="微信">
                    <Input />
                  </Form.Item>
                  <Form.Item name="contactEmail" label="邮箱">
                    <Input />
                  </Form.Item>
                  <Form.Item name="address" label="地址">
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="carouselFileIds"
                    label="轮播图文件 ID（逗号分隔，可先上传后复制 ID）"
                  >
                    <TextArea rows={2} />
                  </Form.Item>
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    customRequest={async (o) => {
                      try {
                        const res = await portalAdminService.uploadPortalFile(o.file as File, 'carousel');
                        message.success(`已上传，文件 ID=${res.id}`);
                        const cur = String(siteForm.getFieldValue('carouselFileIds') || '')
                          .split(/[,，\s]+/)
                          .filter(Boolean);
                        cur.push(String(res.id));
                        siteForm.setFieldsValue({ carouselFileIds: cur.join(',') });
                        o.onSuccess?.({}, o.file);
                      } catch (e) {
                        o.onError?.(e as Error);
                      }
                    }}
                  >
                    <Button>上传轮播图</Button>
                  </Upload>
                  <Form.Item
                    name="companyPhotoFileIds"
                    label="企业实拍文件 ID（逗号分隔）"
                    style={{ marginTop: 16 }}
                  >
                    <TextArea rows={2} />
                  </Form.Item>
                  <Upload
                    showUploadList={false}
                    accept="image/*"
                    customRequest={async (o) => {
                      try {
                        const res = await portalAdminService.uploadPortalFile(o.file as File, 'company');
                        message.success(`已上传，文件 ID=${res.id}`);
                        const cur = String(siteForm.getFieldValue('companyPhotoFileIds') || '')
                          .split(/[,，\s]+/)
                          .filter(Boolean);
                        cur.push(String(res.id));
                        siteForm.setFieldsValue({ companyPhotoFileIds: cur.join(',') });
                        o.onSuccess?.({}, o.file);
                      } catch (e) {
                        o.onError?.(e as Error);
                      }
                    }}
                  >
                    <Button>上传企业实拍</Button>
                  </Upload>
                  <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>
                    保存站点配置
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: 'cats',
            label: '珠宝分类',
            children: (
              <Card
                extra={
                  <Button type="primary" onClick={() => openCatModal()}>
                    新建分类
                  </Button>
                }
              >
                <Table rowKey="id" columns={catColumns} dataSource={cats} pagination={false} />
              </Card>
            ),
          },
          {
            key: 'show',
            label: '橱窗素材',
            children: (
              <Card>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Text>分类</Text>
                  <Select
                    style={{ minWidth: 200 }}
                    value={showCatId}
                    options={cats.map((c) => ({ value: c.id, label: `${c.nameCn} (${c.slug})` }))}
                    onChange={(v) => setShowCatId(v)}
                  />
                  <Button onClick={() => void loadShowcase()}>刷新橱窗</Button>
                </Space>
                <Title level={5}>从订单设计图 / 建模预览图挑选</Title>
                <Space wrap>
                  <Input
                    style={{ width: 160 }}
                    placeholder="订单 ID"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                  />
                  <Button onClick={() => void fetchCandidates()}>加载候选图</Button>
                </Space>
                <Table
                  style={{ marginTop: 12 }}
                  size="small"
                  rowKey="id"
                  dataSource={candidates}
                  pagination={false}
                  columns={[
                    { title: '文件 ID', dataIndex: 'id', width: 90 },
                    { title: '类型', dataIndex: 'fileType', width: 120 },
                    {
                      title: '预览',
                      render: (_, r: any) =>
                        r.fileUrl ? (
                          <a href={r.fileUrl} target="_blank" rel="noreferrer">
                            查看
                          </a>
                        ) : (
                          '—'
                        ),
                    },
                    {
                      title: '操作',
                      width: 100,
                      render: (_, r: any) => (
                        <Button type="link" size="small" onClick={() => void addCandidate(r.id)}>
                          加入橱窗
                        </Button>
                      ),
                    },
                  ]}
                />
                <Title level={5} style={{ marginTop: 24 }}>
                  当前分类橱窗
                </Title>
                <Table rowKey="id" columns={showColumns} dataSource={showItems} pagination={false} />
                <Space style={{ marginTop: 12 }} align="start">
                  <TextArea
                    rows={2}
                    style={{ width: 360 }}
                    value={reorderText}
                    onChange={(e) => setReorderText(e.target.value)}
                    placeholder="橱窗项 ID 顺序，逗号分隔"
                  />
                  <Button onClick={() => void applyReorder()}>应用排序</Button>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editingCat ? '编辑分类' : '新建分类'}
        open={catModal}
        onCancel={() => setCatModal(false)}
        onOk={() => void saveCat()}
        destroyOnClose
      >
        <Form form={catForm} layout="vertical">
          <Form.Item name="slug" label="slug（URL）" rules={[{ required: true }]}>
            <Input disabled={!!editingCat} />
          </Form.Item>
          <Form.Item name="nameCn" label="中文名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nameEn" label="英文名">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PortalShowcaseAdminPage;
