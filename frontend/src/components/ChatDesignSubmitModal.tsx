import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import OrderPieceSwitcher from '@/components/OrderPieceSwitcher';
import { DownloadOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import UploadWithImagePreview from '@/components/UploadWithImagePreview';
import { orderService } from '@/services/orderService';
import { userService } from '@/services/userService';
import {
  collectDoneImageUrlsFromFileList,
  normalizeDoneImageUploadFileList,
  savedImageUrlsToUploadFileList,
} from '@/utils/orderUploadFileList';
import {
  buildProcessInfoFromSelectKeys,
  craftSelectOptionsFrom,
  processSelectValuesFromDesign,
} from '@/utils/designProcessSelect';
import type {
  OrderDesignUpdateRequest,
  OrderDesignVersion,
  OrderInfo,
  OrderPieceInfo,
  ProcessInfo,
} from '@/types/order';
import { JEWELRY_TYPE_OPTIONS, handSizeFieldMeta } from '@/constants/jewelryType';
import { UserRole } from '@/types/auth';
import type { UserInfo } from '@/types/auth';
import {
  firstCustomerRejectPieceId,
  hasDesignPiecesForCustomerSubmit,
  pieceHasCustomerDesignReject,
  piecesMissingCustomerSubmitImages,
  sameImageList,
} from '@/utils/pieceCustomerSubmit';

const { Text, Paragraph } = Typography;

type Props = {
  open: boolean;
  orderId: number | null;
  designerUserId: number | undefined;
  onClose: () => void;
  onSubmitted: () => void;
};

const ChatDesignSubmitModal: React.FC<Props> = ({
  open,
  orderId,
  designerUserId,
  onClose,
  onSubmitted,
}) => {
  const [form] = Form.useForm();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [activePieceId, setActivePieceId] = useState<number | null>(null);
  const [designImageFileList, setDesignImageFileList] = useState<UploadFile[]>([]);
  const [engravingImageFileList, setEngravingImageFileList] = useState<UploadFile[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [materialConfig, setMaterialConfig] = useState<{ type: string; name: string; priceFormula: string }[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [processConfig, setProcessConfig] = useState<ProcessInfo[]>([]);
  const [designers, setDesigners] = useState<UserInfo[]>([]);
  const [versions, setVersions] = useState<OrderDesignVersion[]>([]);
  const [versionLabel, setVersionLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const pieces: OrderPieceInfo[] = order?.pieces ?? [];

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) ?? null,
    [versions, selectedVersionId]
  );

  const activePiece = useMemo(
    () => pieces.find((x) => x.id === activePieceId) ?? pieces[0],
    [pieces, activePieceId]
  );

  const handSizeMeta = useMemo(
    () => handSizeFieldMeta(activePiece?.jewelryType),
    [activePiece?.jewelryType]
  );

  const activePieceDesign = useMemo(() => {
    return activePiece?.design ?? order?.designInfo;
  }, [activePiece, order?.designInfo]);

  const craftSelectOptions = useMemo(
    () => craftSelectOptionsFrom(processConfig, activePieceDesign?.processInfo as ProcessInfo[]),
    [processConfig, activePieceDesign?.processInfo]
  );

  const applyPieceToForm = useCallback(
    (o: OrderInfo, pieceId: number | null) => {
      const piece = o.pieces?.find((p) => p.id === pieceId) ?? o.pieces?.[0];
      const design = piece?.design ?? o.designInfo;
      setDesignImageFileList(savedImageUrlsToUploadFileList(design?.designImages || [], '设计图'));
      setEngravingImageFileList(savedImageUrlsToUploadFileList(design?.engravingImages || [], '字印图'));
      setSelectedProcesses(processSelectValuesFromDesign(design?.processInfo as ProcessInfo[], processConfig));
      form.setFieldsValue({
        designerId: design?.designerId ?? designerUserId,
        engravingText: design?.engravingText,
        materialType: design?.materialType,
        jewelryType: piece?.jewelryType,
        handSize: design?.handSize,
        designNotes: design?.designNotes,
      });
    },
    [form, designerUserId, processConfig]
  );

  const loadVersions = useCallback(async (oid: number, pieceId: number) => {
    try {
      const list = await orderService.listDesignVersions(oid, pieceId);
      setVersions(list);
      setSelectedVersionId(list.length > 0 ? list[0].id : null);
    } catch {
      setVersions([]);
      setSelectedVersionId(null);
    }
  }, []);

  const refreshOrder = useCallback(async (preferRejected = false) => {
    if (orderId == null) return;
    setLoading(true);
    try {
      const [o, materials, processes, designerList] = await Promise.all([
        orderService.getOrderById(orderId),
        orderService.getMaterialConfig(true),
        orderService.getProcessConfig(true),
        userService.getUsers({ page: 0, size: 500, role: UserRole.DESIGNER }).then((r) => r.content || []),
      ]);
      setOrder(o);
      setMaterialConfig(materials);
      setProcessConfig(processes);
      setDesigners(designerList);
      const rejectedId = firstCustomerRejectPieceId(o.pieces, 'design');
      const keepCurrent = !preferRejected && activePieceId && o.pieces?.some((p) => p.id === activePieceId);
      const pid = keepCurrent ? activePieceId : (rejectedId ?? o.pieces?.[0]?.id ?? null);
      setActivePieceId(pid);
      applyPieceToForm(o, pid);
      if (pid != null) {
        await loadVersions(orderId, pid);
      }
    } catch {
      message.error('加载订单设计信息失败');
    } finally {
      setLoading(false);
    }
  }, [orderId, activePieceId, applyPieceToForm, loadVersions]);

  useEffect(() => {
    if (open && orderId != null) {
      setVersionLabel('');
      void refreshOrder(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  useEffect(() => {
    if (order && activePieceId != null && processConfig.length > 0) {
      applyPieceToForm(order, activePieceId);
    }
  }, [processConfig, order, activePieceId, applyPieceToForm]);

  const switchPiece = async (pieceId: number) => {
    if (!order) return;
    setActivePieceId(pieceId);
    applyPieceToForm(order, pieceId);
    if (orderId != null) {
      await loadVersions(orderId, pieceId);
    }
  };

  const afterPiecesChanged = async (focusPieceId?: number) => {
    if (orderId == null) return;
    const o = await orderService.getOrderById(orderId);
    setOrder(o);
    const pid =
      focusPieceId && o.pieces?.some((p) => p.id === focusPieceId)
        ? focusPieceId
        : activePieceId && o.pieces?.some((p) => p.id === activePieceId)
          ? activePieceId
          : o.pieces?.[0]?.id ?? null;
    setActivePieceId(pid);
    applyPieceToForm(o, pid);
    if (pid != null) {
      await loadVersions(orderId, pid);
    }
  };

  const buildPayload = async (strict = true): Promise<OrderDesignUpdateRequest> => {
    const v = strict ? await form.validateFields() : form.getFieldsValue();
    const processInfo = buildProcessInfoFromSelectKeys(selectedProcesses, processConfig);
    const designImages = collectDoneImageUrlsFromFileList(designImageFileList);
    return {
      pieceId: activePieceId ?? undefined,
      designerId: v.designerId,
      engravingText: v.engravingText,
      engravingImages: collectDoneImageUrlsFromFileList(engravingImageFileList),
      materialType: v.materialType,
      handSize: v.handSize,
      designNotes: v.designNotes,
      designImages,
      processInfo,
      versionLabel: versionLabel.trim() || undefined,
    };
  };

  const handleDesignUploadChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setDesignImageFileList(normalizeDoneImageUploadFileList(fileList));
  }, []);

  const handleEngravingUploadChange = useCallback<NonNullable<UploadProps['onChange']>>(({ fileList }) => {
    setEngravingImageFileList(normalizeDoneImageUploadFileList(fileList));
  }, []);

  const uploadDesignRequest = useCallback<NonNullable<UploadProps['customRequest']>>(
    async (options) => {
      const { file, onError, onSuccess } = options;
      if (orderId == null) return;
      try {
        const res = await orderService.uploadDesignFile(orderId, file as File);
        onSuccess?.(res);
      } catch {
        message.error('设计图片上传失败');
        onError?.(new Error('上传失败'));
      }
    },
    [orderId]
  );

  const saveDraft = async (createVersion: boolean) => {
    if (orderId == null) return;
    if (activePiece?.designConfirmed) {
      message.warning(`「${activePiece.name}」客户已确认，请勿修改`);
      return;
    }
    const payload = await buildPayload();
    if (createVersion && !payload.designImages?.length) {
      message.warning('新建版本请至少上传一张设计图');
      return;
    }
    setBusy(true);
    try {
      await orderService.updateOrderDesign(orderId, {
        ...payload,
        submitToCustomer: false,
        createVersion,
      });
      message.success(createVersion ? '已保存为新版本' : '草稿已保存');
      const o = await orderService.getOrderById(orderId);
      setOrder(o);
      if (activePieceId != null) {
        await loadVersions(orderId, activePieceId);
      }
    } catch (e) {
      message.error(`保存失败：${String((e as Error)?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const submitToCustomer = async () => {
    if (orderId == null) return;
    const images = collectDoneImageUrlsFromFileList(designImageFileList);
    if (!hasDesignPiecesForCustomerSubmit(pieces)) {
      message.warning('没有待提交给客户的单件。已确认且未被建模师驳回的件不会再次发送。');
      return;
    }
    const missing = piecesMissingCustomerSubmitImages(pieces, 'design', activePieceId, images);
    if (missing.length) {
      message.error(`以下单件还没有设计图，须这些件都有图后才能提交：${missing.join('、')}`);
      return;
    }
    const sentBack = !!activePiece?.model?.lastRejectToDesignerMessage?.trim();
    if (activePiece?.designConfirmed && !sentBack && !sameImageList(activePiece.design?.designImages, images)) {
      message.error(`「${activePiece.name}」客户已确认，提交给客户时不能修改该件，也不会再次发送。`);
      return;
    }
    const payload = await buildPayload(!activePiece?.designConfirmed);
    setBusy(true);
    try {
      await orderService.updateOrderDesign(orderId, {
        ...payload,
        submitToCustomer: true,
        createVersion: true,
      });
      message.success('已将未确认的单件一起提交，客户将按件收到确认卡片');
      onSubmitted();
      onClose();
    } catch (e) {
      message.error(`提交失败：${String((e as Error)?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const restoreVersion = async (versionId: number) => {
    if (orderId == null || activePieceId == null) return;
    if (activePiece?.designConfirmed) {
      message.warning(`「${activePiece.name}」客户已确认，不能回退设计图`);
      return;
    }
    setBusy(true);
    try {
      const o = await orderService.restoreDesignVersion(orderId, activePieceId, versionId);
      setOrder(o);
      applyPieceToForm(o, activePieceId);
      message.success('已恢复为该版本内容（未自动提交客户）');
    } catch (e) {
      message.error(`回退失败：${String((e as Error)?.message || e)}`);
    } finally {
      setBusy(false);
    }
  };

  const previewVersion = async (versionId: number) => {
    if (orderId == null || activePieceId == null) return;
    try {
      const v = await orderService.getDesignVersion(orderId, activePieceId, versionId);
      Modal.info({
        title: `${v.label || '版本'} · v${v.versionNo}`,
        width: 560,
        content: (
          <div>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              {v.createdAt} · {v.createdByName || '设计师'}
              {v.submittedToCustomer ? ' · 已提交客户' : ''}
            </Paragraph>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 120, overflow: 'auto' }}>
              {[v.engravingText, v.materialType, v.handSize, v.designNotes].filter(Boolean).join('\n')}
            </pre>
          </div>
        ),
      });
    } catch {
      message.error('无法加载版本详情');
    }
  };

  const downloadVersionAssets = async (versionId: number) => {
    if (orderId == null || activePieceId == null) return;
    try {
      const v = await orderService.getDesignVersion(orderId, activePieceId, versionId);
      const urls = [...(v.designImages || []), ...(v.engravingImages || [])];
      if (urls.length === 0) {
        message.info('该版本没有可下载的图片');
        return;
      }
      urls.forEach((url, i) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.download = `design-v${v.versionNo}-${i + 1}`;
        a.click();
      });
      message.success(`已开始下载 ${urls.length} 个文件`);
    } catch {
      message.error('下载失败');
    }
  };

  const designRejectPieces = pieces.filter((piece) => pieceHasCustomerDesignReject(piece));
  const activeDesignReject = activePiece && pieceHasCustomerDesignReject(activePiece) ? activePiece : null;
  const pieceLocked = !!activePiece?.designConfirmed && !activePiece?.model?.lastRejectToDesignerMessage?.trim();
  const designImageUrls = collectDoneImageUrlsFromFileList(designImageFileList);
  const designMissing = piecesMissingCustomerSubmitImages(pieces, 'design', activePieceId, designImageUrls);
  const designHasPending = hasDesignPiecesForCustomerSubmit(pieces);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <Modal
      title="提交设计稿"
      open={open}
      onCancel={onClose}
      width={narrow ? '100%' : 760}
      style={narrow ? { top: 12, maxWidth: 'calc(100vw - 16px)', paddingBottom: 0 } : undefined}
      destroyOnClose
      confirmLoading={busy}
      footer={
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <Button key="cancel" onClick={onClose} style={{ minHeight: 40 }}>
            取消
          </Button>
          <Button key="draft" loading={busy} disabled={pieceLocked} style={{ minHeight: 40 }} onClick={() => void saveDraft(false)}>
            保存草稿
          </Button>
          <Button key="version" loading={busy} disabled={pieceLocked} style={{ minHeight: 40 }} onClick={() => void saveDraft(true)}>
            保存为新版本
          </Button>
          <Button
            key="submit"
            type="primary"
            loading={busy}
            disabled={!designHasPending || designMissing.length > 0}
            style={{ minHeight: 40 }}
            onClick={() => void submitToCustomer()}
          >
            提交给客户确认
          </Button>
        </div>
      }
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        须全部未确认的单件都有设计图后才能一起提交；已确认的件不会再次发送。草稿仍按件保存。
        {designMissing.length > 0 ? ` 还缺：${designMissing.join('、')}` : ''}
        {!designHasPending ? ' 当前没有待提交的单件。' : ''}
      </Paragraph>

      {orderId != null && (
        <OrderPieceSwitcher
          orderId={orderId}
          pieces={pieces}
          activePieceId={activePieceId}
          canEdit={!loading}
          nestedModalZIndex={2100}
          onSelectPiece={(pieceId) => void switchPiece(pieceId)}
          onPiecesChanged={afterPiecesChanged}
        />
      )}

      {designRejectPieces.length > 0 ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`有单件待修改：${designRejectPieces.map((p) => p.name).join('、')}`}
          description={
            activeDesignReject?.design?.lastCustomerDesignRejectReason ? (
              <div>
                <Text strong>{activeDesignReject.name}</Text>
                <Paragraph style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {activeDesignReject.design.lastCustomerDesignRejectReason}
                </Paragraph>
              </div>
            ) : (
              <Text type="secondary">切换到标有「待修改」的单件，可看到客户原话。</Text>
            )
          }
        />
      ) : null}
      {pieceLocked ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          message={`客户已确认「${activePiece?.name || '该单件'}」，请勿修改`}
          description="已确认的件不会再次发送。"
        />
      ) : null}

      <Space wrap style={{ marginBottom: 12 }} align="start">
        <Select
          size="small"
          style={{ minWidth: 220 }}
          placeholder={versions.length === 0 ? '暂无历史版本' : '选择版本'}
          value={selectedVersionId ?? undefined}
          options={versions.map((v) => ({
            value: v.id,
            label: `${v.label || 'v' + v.versionNo}${v.submittedToCustomer ? ' · 已提交' : ''}`,
          }))}
          onChange={(id) => setSelectedVersionId(id)}
        />
        {selectedVersion && (
          <Text type="secondary" style={{ fontSize: 12, maxWidth: 280 }}>
            当前：{selectedVersion.label || `v${selectedVersion.versionNo}`}
            {selectedVersion.createdAt ? ` · ${selectedVersion.createdAt}` : ''}
            {selectedVersion.submittedToCustomer ? ' · 已提交客户' : ''}
          </Text>
        )}
        <Button
          size="small"
          icon={<RollbackOutlined />}
          disabled={selectedVersionId == null || pieceLocked}
          onClick={() => selectedVersionId != null && void restoreVersion(selectedVersionId)}
        >
          恢复
        </Button>
        <Button
          size="small"
          icon={<DownloadOutlined />}
          disabled={selectedVersionId == null}
          onClick={() => selectedVersionId != null && void downloadVersionAssets(selectedVersionId)}
        >
          下载素材
        </Button>
        <Button
          size="small"
          type="link"
          disabled={selectedVersionId == null}
          onClick={() => selectedVersionId != null && void previewVersion(selectedVersionId)}
        >
          查看
        </Button>
        <Input
          size="small"
          style={{ width: 200 }}
          placeholder="版本备注（可选）"
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
        />
      </Space>

      <Form form={form} layout="vertical" disabled={loading || pieceLocked}>
        <Form.Item name="designerId" label="设计师">
          <Select
            options={designers.map((u) => ({
              value: u.id,
              label: u.realName || u.username,
            }))}
          />
        </Form.Item>
        <Form.Item name="engravingText" label="字印">
          <Input placeholder="文字内容，如姓名 / 日期 / 字母" />
        </Form.Item>
        <Form.Item label="字印图片（最多 5 张）" extra="支持文字与图片；最多 5 张。">
          <UploadWithImagePreview
            listType="picture-card"
            multiple
            maxCount={5}
            accept="image/*"
            fileList={engravingImageFileList}
            onChange={handleEngravingUploadChange}
            customRequest={uploadDesignRequest}
          >
            <div style={{ marginTop: 8 }}>上传</div>
          </UploadWithImagePreview>
        </Form.Item>
        <Form.Item name="jewelryType" label="珠宝类型" rules={[{ required: true, message: '请选择珠宝类型' }]}>
          <Select
            placeholder="请选择类型"
            options={JEWELRY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(val) => {
              if (orderId != null && activePiece) {
                void orderService.updateOrderPieceMeta(orderId, activePiece.id, { jewelryType: val });
              }
            }}
          />
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
        {handSizeMeta.visible && (
          <Form.Item
            name="handSize"
            label={handSizeMeta.label}
            rules={
              handSizeMeta.required
                ? [{ required: true, message: `请填写${handSizeMeta.label}` }]
                : []
            }
          >
            <Input placeholder={handSizeMeta.placeholder} />
          </Form.Item>
        )}
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
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="设计图片" extra="本单每一件未确认的单件都要有图，才能一起提交给客户。">
          <UploadWithImagePreview
            listType="picture-card"
            accept="image/*"
            multiple
            fileList={designImageFileList}
            onChange={handleDesignUploadChange}
            customRequest={uploadDesignRequest}
          >
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>上传</div>
            </div>
          </UploadWithImagePreview>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChatDesignSubmitModal;
