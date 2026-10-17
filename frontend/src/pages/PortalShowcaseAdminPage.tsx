import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Segmented,
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
  portalAdminService,
  type HomeBlock,
  type PortalJewelryCategory,
  type PortalScope,
  type PortalShowcaseItemAdmin,
} from '@/services/portalAdminService';
import { resolvePublicSites } from '@/utils/publicSites';

const { Title, Text } = Typography;
const { TextArea } = Input;

const LANGS = ['zh-CN', 'en', 'fr', 'de', 'es', 'ja', 'ko', 'zh-TW'];

/** C 端首页核心文案清单（i18n key + 中文默认值），供「输入中文 → AI 翻译 → 微调」 */
const C_HOME_TEXT_KEYS: { key: string; label: string; zh: string }[] = [
  { key: 'hero.eyebrow', label: 'Hero 眉题', zh: '单件定制珠宝' },
  { key: 'hero.title1', label: 'Hero 标题1', zh: '每一件' },
  { key: 'hero.title2', label: 'Hero 标题2', zh: '都为你而生' },
  { key: 'hero.desc', label: 'Hero 描述', zh: '从灵感到交付，全程在线透明沟通。支付定金，即刻开启您的专属定制之旅。' },
  { key: 'hero.cta1', label: 'Hero 按钮1', zh: '立即咨询设计师' },
  { key: 'hero.cta2', label: 'Hero 按钮2', zh: '浏览作品集' },
  { key: 'svc.title', label: '服务标题', zh: '选择你的定制方式' },
  { key: 'svc.sub', label: '服务副标题', zh: '支付定金即可解锁专属设计团队' },
  { key: 'svc.custom.title', label: '来图定制-标题', zh: '来图定制' },
  { key: 'svc.custom.desc', label: '来图定制-描述', zh: '提交您自带的設計图，我们为您打造为实物。' },
  { key: 'svc.custom.note', label: '来图定制-注意', zh: '注意：设计图可能不符合生产标准，成品可能存在一定偏差。' },
  { key: 'svc.designer.title', label: '设计师设计-标题', zh: '设计师设计' },
  { key: 'svc.designer.desc', label: '设计师设计-描述', zh: '委托我们的设计师，从您的灵感出发设计专属款式。' },
  { key: 'svc.designer.note', label: '设计师设计-注意', zh: '包含一对一咨询、设计手稿与制作前3D预览。' },
  { key: 'works.title', label: '作品集标题', zh: '精选作品' },
  { key: 'works.sub', label: '作品集副标题', zh: '每一件都是独一无二的故事' },
  { key: 'work1.name', label: '作品1名称', zh: '星河' },
  { key: 'work1.desc', label: '作品1描述', zh: '蓝宝石 · 18K白金 · 钻石镶嵌' },
  { key: 'work2.name', label: '作品2名称', zh: '翠羽' },
  { key: 'work2.desc', label: '作品2描述', zh: '祖母绿 · 18K黄金 · 个性定制' },
  { key: 'work3.name', label: '作品3名称', zh: '流光' },
  { key: 'work3.desc', label: '作品3描述', zh: '钻石 · 18K白金 · 精密切割' },
  { key: 'work4.name', label: '作品4名称', zh: '晨露' },
  { key: 'work4.desc', label: '作品4描述', zh: 'Akoya珍珠 · 18K黄金 · 手工锻造' },
  { key: 'process.title', label: '流程标题', zh: '定制之旅' },
  { key: 'process.sub', label: '流程副标题', zh: '从灵感到成品，每一步都清晰可见' },
  { key: 'step1.title', label: '步骤1标题', zh: '咨询沟通' },
  { key: 'step1.desc', label: '步骤1描述', zh: '与设计师一对一交流需求、风格偏好与预算。' },
  { key: 'step2.title', label: '步骤2标题', zh: '方案确认' },
  { key: 'step2.desc', label: '步骤2描述', zh: '设计手稿、3D建模预览、材料明细与透明报价。' },
  { key: 'step3.title', label: '步骤3标题', zh: '支付定金' },
  { key: 'step3.desc', label: '步骤3描述', zh: '支付定金锁定服务，专属订单群聊即时开启。' },
  { key: 'step4.title', label: '步骤4标题', zh: '交付验收' },
  { key: 'step4.desc', label: '步骤4描述', zh: '成品交付，尾款结清。终身保养，让珠宝历久弥新。' },
  { key: 'craft.title', label: '工艺标题', zh: '匠心传承' },
  { key: 'craft.text', label: '工艺描述', zh: '每一件珠宝都由资深工匠手工锻造，从选石到镶嵌，历经数十道工序。' },
  { key: 'cta.title', label: 'CTA 标题', zh: '开启你的定制之旅' },
  { key: 'cta.desc', label: 'CTA 描述', zh: '预约咨询，让设计师为你讲述属于你的珠宝故事。' },
];

const PortalShowcaseAdminPage: React.FC = () => {
  const [scope, setScope] = useState<PortalScope>('B');
  const [iframeKey, setIframeKey] = useState(0);

  const { portal, cend } = resolvePublicSites();
  const previewUrl = scope === 'B' ? portal : cend;

  const refreshPreview = () => setIframeKey((k) => k + 1);

  return (
    <div style={{ padding: 16, height: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column' }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <Title level={4} style={{ margin: 0 }}>
          门户展示配置
        </Title>
        <Segmented
          value={scope}
          onChange={(v) => setScope(v as PortalScope)}
          options={[
            { label: 'B 端门户（恒鎏）', value: 'B' },
            { label: 'C 端独立站（duxury）', value: 'C' },
          ]}
        />
        <Text type="secondary">预览：{previewUrl}</Text>
        <Button onClick={refreshPreview}>刷新预览</Button>
      </Space>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* 左侧编辑区 */}
        <div style={{ flex: '1 1 44%', overflow: 'auto', minWidth: 0 }}>
          <EditorTabs scope={scope} onSaved={refreshPreview} />
        </div>
        {/* 右侧预览区 */}
        <div
          style={{
            flex: '1 1 56%',
            border: '1px solid #e8e8e8',
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <iframe
            key={iframeKey}
            title="门户预览"
            src={previewUrl}
            style={{ flex: 1, border: 'none', width: '100%', minHeight: 0 }}
          />
        </div>
      </div>
    </div>
  );
};

// ============ 左侧 Tabs ============
const EditorTabs: React.FC<{ scope: PortalScope; onSaved: () => void }> = ({ scope, onSaved }) => {
  const items = [
    { key: 'site', label: '站点设置', children: <SiteSettingsForm scope={scope} onSaved={onSaved} /> },
    {
      key: 'texts',
      label: '首页文案（多语言）',
      children: scope === 'C' ? <CTextsPanel onSaved={onSaved} /> : <Text type="secondary">B 端门户为中文单语，无需多语言配置。</Text>,
    },
    {
      key: 'blocks',
      label: '首页区块（图片/工艺）',
      children: scope === 'B' ? <BBlocksPanel scope={scope} onSaved={onSaved} /> : <Text type="secondary">C 端独立站文案已覆盖，图片暂用站点素材。</Text>,
    },
    { key: 'cats', label: '分类与橱窗', children: <CategoriesPanel scope={scope} onSaved={onSaved} /> },
  ];
  return <Tabs defaultActiveKey="site" items={items} />;
};

// ============ 站点设置 ============
const SiteSettingsForm: React.FC<{ scope: PortalScope; onSaved: () => void }> = ({ scope, onSaved }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const s = await portalAdminService.getSiteSettings(scope);
    form.setFieldsValue({
      ...s,
      carouselFileIds: (s.carouselFileIds || []).join(','),
      companyPhotoFileIds: (s.companyPhotoFileIds || []).join(','),
    });
  }, [scope, form]);

  useEffect(() => {
    load().catch((e) => message.error(String(e)));
  }, [load]);

  const save = async () => {
    const v = await form.validateFields();
    const parseIds = (s: string) =>
      String(s || '')
        .split(/[,，\s]+/)
        .map((x) => Number(x.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0);
    setLoading(true);
    try {
      await portalAdminService.updateSiteSettings(scope, {
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
      message.success('已保存站点配置');
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={save}>
      <Form.Item name="heroTitle" label="主标题">
        <Input />
      </Form.Item>
      <Form.Item name="heroSubtitle" label="副标题">
        <Input />
      </Form.Item>
      <Form.Item name="aboutHtml" label="关于我们（支持 HTML）">
        <TextArea rows={5} />
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
      <Form.Item name="carouselFileIds" label="轮播图文件 ID（逗号分隔）">
        <TextArea rows={2} />
      </Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*"
        customRequest={async (o) => {
          try {
            const res = await portalAdminService.uploadPortalFile(o.file as File, 'carousel');
            message.success(`已上传，文件 ID=${res.id}`);
            const cur = String(form.getFieldValue('carouselFileIds') || '')
              .split(/[,，\s]+/)
              .filter(Boolean);
            cur.push(String(res.id));
            form.setFieldsValue({ carouselFileIds: cur.join(',') });
            o.onSuccess?.({}, o.file as never);
          } catch (e) {
            o.onError?.(e as Error);
          }
        }}
      >
        <Button>上传轮播图</Button>
      </Upload>
      <Form.Item name="companyPhotoFileIds" label="企业实拍文件 ID（逗号分隔）" style={{ marginTop: 16 }}>
        <TextArea rows={2} />
      </Form.Item>
      <Upload
        showUploadList={false}
        accept="image/*"
        customRequest={async (o) => {
          try {
            const res = await portalAdminService.uploadPortalFile(o.file as File, 'company');
            message.success(`已上传，文件 ID=${res.id}`);
            const cur = String(form.getFieldValue('companyPhotoFileIds') || '')
              .split(/[,，\s]+/)
              .filter(Boolean);
            cur.push(String(res.id));
            form.setFieldsValue({ companyPhotoFileIds: cur.join(',') });
            o.onSuccess?.({}, o.file as never);
          } catch (e) {
            o.onError?.(e as Error);
          }
        }}
      >
        <Button>上传企业实拍</Button>
      </Upload>
      <Form.Item style={{ marginTop: 16 }}>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存站点配置
        </Button>
      </Form.Item>
    </Form>
  );
};

// ============ C 端首页文案（多语言 + AI 翻译） ============
const CTextsPanel: React.FC<{ onSaved: () => void }> = ({ onSaved }) => {
  const [items, setItems] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);

  useEffect(() => {
    portalAdminService
      .getHomeBlocks('C')
      .then((blocks) => {
        const map: Record<string, Record<string, string>> = {};
        blocks.forEach((b) => {
          if (b.content?.texts) map[b.blockKey] = b.content.texts;
        });
        setItems(map);
      })
      .catch(() => {});
  }, []);

  const textOf = (key: string, lang: string) => items[key]?.[lang] ?? '';

  const setText = (key: string, lang: string, val: string) => {
    setItems((prev) => {
      const cur = { ...(prev[key] || {}) };
      cur[lang] = val;
      return { ...prev, [key]: cur };
    });
  };

  const doTranslate = async (item: { key: string; zh: string }) => {
    const zh = textOf(item.key, 'zh-CN') || item.zh;
    if (!zh.trim()) return;
    setTranslating(item.key);
    try {
      const r = await portalAdminService.translateBlock(zh.trim());
      setItems((prev) => ({ ...prev, [item.key]: r }));
      message.success('已翻译，请检查并微调');
    } catch (e: any) {
      message.error(e?.message || '翻译失败');
    } finally {
      setTranslating(null);
    }
  };

  const save = async () => {
    setLoading(true);
    try {
      const blocks: HomeBlock[] = C_HOME_TEXT_KEYS.filter((it) => items[it.key] && Object.values(items[it.key]).some(Boolean)).map((it) => ({
        section: it.key.split('.')[0],
        blockKey: it.key,
        enabled: true,
        content: { texts: items[it.key] },
      }));
      await portalAdminService.updateHomeBlocks('C', blocks);
      message.success('已保存首页文案');
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="C 端多语言文案"
        description="在下方中文框输入/修改文案，点击「AI 翻译」自动生成 8 语言，可展开微调。保存后独立站立即生效。"
      />
      <Collapse
        items={C_HOME_TEXT_KEYS.map((it) => ({
          key: it.key,
          label: (
            <Space>
              <Text strong>{it.label}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {it.key}
              </Text>
            </Space>
          ),
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={textOf(it.key, 'zh-CN')}
                  placeholder={it.zh}
                  onChange={(e) => setText(it.key, 'zh-CN', e.target.value)}
                  addonBefore="中文"
                />
                <Button type="primary" loading={translating === it.key} onClick={() => doTranslate(it)}>
                  AI 翻译
                </Button>
              </Space.Compact>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {LANGS.filter((l) => l !== 'zh-CN').map((lang) => (
                  <Input
                    key={lang}
                    addonBefore={lang}
                    value={textOf(it.key, lang)}
                    onChange={(e) => setText(it.key, lang, e.target.value)}
                    size="small"
                  />
                ))}
              </div>
            </Space>
          ),
        }))}
      />
      <Button type="primary" style={{ marginTop: 16 }} loading={loading} onClick={save}>
        保存全部文案
      </Button>
    </div>
  );
};

// ============ B 端首页区块（图片/工艺） ============
const BBlocksPanel: React.FC<{ scope: PortalScope; onSaved: () => void }> = ({ scope, onSaved }) => {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<HomeBlock | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setBlocks(await portalAdminService.getHomeBlocks(scope));
  }, [scope]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const openEdit = (b?: HomeBlock) => {
    setEditing(b || { section: 'craft', blockKey: '', sortOrder: 0, enabled: true, content: { texts: { 'zh-CN': '' } } });
    setModalOpen(true);
  };

  const remove = async (id: number) => {
    const next = blocks.filter((b) => b.id !== id);
    await portalAdminService.updateHomeBlocks(scope, next);
    message.success('已删除');
    load();
    onSaved();
  };

  const columns: ColumnsType<HomeBlock> = [
    { title: '区块', dataIndex: 'section', width: 120 },
    { title: '标识', dataIndex: 'blockKey', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: boolean) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Button type="link" size="small" danger onClick={() => r.id && remove(r.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="B 端首页区块"
        description="配置「设计→建模」「高级定制横滑」「工艺展示」「关于特性」等区块的文案与图片 URL，保存后 B 端门户立即生效。"
      />
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => openEdit()}>
        新增区块
      </Button>
      <Table rowKey={(r) => String(r.id ?? r.blockKey)} size="small" columns={columns} dataSource={blocks} pagination={false} />
      <BlockEditModal
        open={modalOpen}
        block={editing}
        onClose={() => setModalOpen(false)}
        onSave={async (b) => {
          const exists = blocks.some((x) => x.id === b.id);
          const next = exists ? blocks.map((x) => (x.id === b.id ? b : x)) : [...blocks, b];
          setLoading(true);
          try {
            await portalAdminService.updateHomeBlocks(scope, next);
            message.success('已保存区块');
            setModalOpen(false);
            await load();
            onSaved();
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
};

const BlockEditModal: React.FC<{
  open: boolean;
  block: HomeBlock | null;
  onClose: () => void;
  onSave: (b: HomeBlock) => void;
}> = ({ open, block, onClose, onSave }) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && block) {
      form.setFieldsValue({
        section: block.section,
        blockKey: block.blockKey,
        sortOrder: block.sortOrder ?? 0,
        enabled: block.enabled ?? true,
        titleZh: block.content?.texts?.['zh-CN'] || '',
        image: block.content?.image || '',
        images: (block.content?.images || []).join('\n'),
        text: (block.content?.extra?.text as string) || '',
        note: (block.content?.extra?.note as string) || '',
      });
    }
  }, [open, block, form]);

  const submit = async () => {
    const v = await form.validateFields();
    const images = String(v.images || '')
      .split('\n')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const extra: Record<string, unknown> = {};
    if (v.text) extra.text = v.text;
    if (v.note) extra.note = v.note;
    onSave({
      id: block?.id,
      section: v.section,
      blockKey: v.blockKey,
      sortOrder: v.sortOrder ?? 0,
      enabled: v.enabled ?? true,
      content: {
        texts: v.titleZh ? { 'zh-CN': v.titleZh } : undefined,
        image: v.image || undefined,
        images: images.length ? images : undefined,
        extra: Object.keys(extra).length ? extra : undefined,
      },
    });
  };

  return (
    <Modal title={block?.id ? '编辑区块' : '新增区块'} open={open} onCancel={onClose} onOk={submit} destroyOnClose width={640}>
      <Form form={form} layout="vertical">
        <Form.Item name="section" label="区块类型" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'process', label: 'process 设计→建模' },
              { value: 'haute', label: 'haute 高级定制横滑' },
              { value: 'craft', label: 'craft 工艺展示' },
              { value: 'about', label: 'about 关于特性' },
              { value: 'cta', label: 'cta 行动号召' },
            ]}
          />
        </Form.Item>
        <Form.Item name="blockKey" label="标识（英文唯一键）" rules={[{ required: true }]}>
          <Input placeholder="如 craft-01" />
        </Form.Item>
        <Space size="large">
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="titleZh" label="标题（中文）">
          <Input />
        </Form.Item>
        <Form.Item name="image" label="单图 URL">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="images" label="多图 URL（每行一个，用于设计→建模双图、横滑多图）">
          <TextArea rows={3} placeholder={'https://.../design.jpg\nhttps://.../model.jpg'} />
        </Form.Item>
        <Form.Item name="text" label="描述文本">
          <TextArea rows={2} />
        </Form.Item>
        <Form.Item name="note" label="备注（如 haute 顶部说明）">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// ============ 分类与橱窗 ============
const CategoriesPanel: React.FC<{ scope: PortalScope; onSaved: () => void }> = ({ scope, onSaved }) => {
  const [cats, setCats] = useState<PortalJewelryCategory[]>([]);
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<PortalJewelryCategory | null>(null);
  const [catForm] = Form.useForm();
  const [showCatId, setShowCatId] = useState<number | undefined>();
  const [showItems, setShowItems] = useState<PortalShowcaseItemAdmin[]>([]);
  const [orderIdInput, setOrderIdInput] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [reorderText, setReorderText] = useState('');

  const loadCats = useCallback(async () => {
    const list = await portalAdminService.listCategories(scope);
    setCats(list);
    setShowCatId((prev) => prev ?? (list[0]?.id as number | undefined));
  }, [scope]);

  useEffect(() => {
    loadCats().catch((e) => message.error(String(e)));
  }, [loadCats]);

  const loadShowcase = useCallback(async () => {
    if (!showCatId) return;
    const list = await portalAdminService.listShowcaseItems(showCatId);
    setShowItems(list);
    setReorderText(list.map((x) => x.id).join(','));
  }, [showCatId]);

  useEffect(() => {
    if (showCatId) loadShowcase().catch(() => {});
  }, [showCatId, loadShowcase]);

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
    } else {
      await portalAdminService.createCategory(scope, v);
    }
    setCatModal(false);
    loadCats();
    onSaved();
  };

  const fetchCandidates = async () => {
    const id = Number(orderIdInput);
    if (!id) return message.warning('请输入订单 ID');
    const list = await portalAdminService.listShowcaseCandidates(id);
    setCandidates(list);
  };

  const addCandidate = async (fileId: number) => {
    if (!showCatId) return message.warning('请先选择分类');
    await portalAdminService.addShowcaseItem({ categoryId: showCatId, fileId });
    loadShowcase();
    onSaved();
  };

  const applyReorder = async () => {
    if (!showCatId) return;
    const ids = reorderText.split(/[,，\s]+/).map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    await portalAdminService.reorderShowcase(showCatId, ids);
    loadShowcase();
    onSaved();
  };

  const catColumns: ColumnsType<PortalJewelryCategory> = [
    { title: 'slug', dataIndex: 'slug', width: 120 },
    { title: '中文名', dataIndex: 'nameCn' },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    {
      title: '操作',
      width: 140,
      render: (_, r) => (
        <Space size="small">
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
                onOk: async () => {
                  await portalAdminService.deleteCategory(r.id);
                  loadCats();
                  onSaved();
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

  return (
    <div>
      <Card
        size="small"
        title="珠宝分类"
        extra={
          <Button type="primary" size="small" onClick={() => openCatModal()}>
            新建
          </Button>
        }
      >
        <Table rowKey="id" size="small" columns={catColumns} dataSource={cats} pagination={false} />
      </Card>

      <Card size="small" title="橱窗素材" style={{ marginTop: 12 }}>
        <Space wrap>
          <Text>分类</Text>
          <Select
            style={{ minWidth: 180 }}
            value={showCatId}
            options={cats.map((c) => ({ value: c.id, label: `${c.nameCn} (${c.slug})` }))}
            onChange={(v) => setShowCatId(v)}
          />
          <Input
            style={{ width: 140 }}
            placeholder="订单 ID"
            value={orderIdInput}
            onChange={(e) => setOrderIdInput(e.target.value)}
          />
          <Button onClick={fetchCandidates}>加载候选图</Button>
        </Space>
        <Table
          style={{ marginTop: 12 }}
          size="small"
          rowKey="id"
          dataSource={candidates}
          pagination={false}
          columns={[
            { title: '文件 ID', dataIndex: 'id', width: 90 },
            { title: '类型', dataIndex: 'fileType', width: 110 },
            {
              title: '操作',
              width: 100,
              render: (_, r: any) => (
                <Button type="link" size="small" onClick={() => addCandidate(r.id)}>
                  加入橱窗
                </Button>
              ),
            },
          ]}
        />
        <DividerPlain />
        <Table
          size="small"
          rowKey="id"
          dataSource={showItems}
          pagination={false}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70 },
            { title: '文件', dataIndex: 'fileName', ellipsis: true },
            {
              title: '操作',
              width: 90,
              render: (_, r) => (
                <Button
                  type="link"
                  size="small"
                  danger
                  onClick={() =>
                    Modal.confirm({
                      title: '移除橱窗项？',
                      onOk: async () => {
                        await portalAdminService.deleteShowcaseItem(r.id);
                        loadShowcase();
                        onSaved();
                      },
                    })
                  }
                >
                  移除
                </Button>
              ),
            },
          ]}
        />
        <Space style={{ marginTop: 12 }}>
          <TextArea
            rows={2}
            style={{ width: 320 }}
            value={reorderText}
            onChange={(e) => setReorderText(e.target.value)}
            placeholder="橱窗项 ID 顺序，逗号分隔"
          />
          <Button onClick={applyReorder}>应用排序</Button>
        </Space>
      </Card>

      <Modal title={editingCat ? '编辑分类' : '新建分类'} open={catModal} onCancel={() => setCatModal(false)} onOk={saveCat} destroyOnClose>
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

const DividerPlain: React.FC = () => <div style={{ borderTop: '1px solid #f0f0f0', margin: '12px 0' }} />;

export default PortalShowcaseAdminPage;
