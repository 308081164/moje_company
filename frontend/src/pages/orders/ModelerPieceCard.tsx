import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, Tag, message } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { PlusOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import UploadWithImagePreview from '@/components/UploadWithImagePreview';
import UploadWithModelSourcePreview from '@/components/UploadWithModelSourcePreview';
import { PieceDesignCard } from '@/pages/orders/PieceDesignBrief';
import { StoneEditor, stonesForSave, stonesFromSaved, type StoneDraft } from '@/pages/orders/StoneEditor';
import {
  collectDoneImageUrlsFromFileList,
  normalizeDoneImageUploadFileList,
  normalizeModelSourceUploadFileList,
  savedImageUrlsToUploadFileList,
} from '@/utils/orderUploadFileList';
import { isRasterImageFileName } from '@/utils/isRasterImageFileName';
import type { FileInfo, OrderModelVersion, OrderPieceInfo } from '@/types/order';
import type { UserInfo } from '@/types/auth';
import './ModelerPieceCard.css';

function modelSourceUploadListFromSaved(modelFiles: unknown): UploadFile[] {
  if (!modelFiles || !Array.isArray(modelFiles)) return [];
  const rows = modelFiles as { fileId?: number; id?: number; fileName?: string; fileUrl?: string }[];
  return rows
    .filter((x) => (x.fileId ?? x.id) != null && x.fileUrl)
    .map((x, i) => {
      const id = (x.fileId ?? x.id) as number;
      const name = x.fileName || '';
      const isImg = isRasterImageFileName(name);
      return {
        uid: `src-${id}-${i}`,
        name: name || `file-${id}`,
        status: 'done' as const,
        url: x.fileUrl,
        thumbUrl: isImg ? x.fileUrl : undefined,
        response: { id } as FileInfo,
      };
    });
}

function sourceIdsOf(fileList: UploadFile[]): number[] {
  return fileList
    .filter((file) => file.status === 'done')
    .map((file) => (file.response as FileInfo | undefined)?.id)
    .filter((id): id is number => id != null && !Number.isNaN(Number(id)));
}

export function ModelerPieceCard({
  orderId,
  piece,
  modelers,
  disabled,
  locked,
  active,
  onFocus,
  onSaved,
}: {
  orderId: number;
  piece: OrderPieceInfo;
  modelers: UserInfo[];
  disabled: boolean;
  locked: boolean;
  active: boolean;
  onFocus: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [form] = Form.useForm();
  const [stones, setStones] = useState<StoneDraft[]>(() => stonesFromSaved(piece.design?.stoneInfo));
  const [effects, setEffects] = useState<UploadFile[]>(() =>
    savedImageUrlsToUploadFileList(piece.model?.modelEffectImages || [], '效果图'));
  const [sources, setSources] = useState<UploadFile[]>(() => modelSourceUploadListFromSaved(piece.model?.modelFiles));
  const [versions, setVersions] = useState<OrderModelVersion[]>([]);
  const [versionPick, setVersionPick] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const stamp = `${piece.model?.updatedAt || ''}|${(piece.model?.modelEffectImages || []).join(',')}|${piece.model?.modelNotes || ''}|${piece.model?.weight ?? ''}|${piece.model?.modelerId ?? ''}|${JSON.stringify(piece.design?.stoneInfo || [])}`;

  useEffect(() => {
    if (dirty.current) return;
    form.setFieldsValue({
      modelerId: piece.model?.modelerId,
      weight: piece.model?.weight,
      modelNotes: piece.model?.modelNotes,
    });
    setStones(stonesFromSaved(piece.design?.stoneInfo));
    setEffects(savedImageUrlsToUploadFileList(piece.model?.modelEffectImages || [], '效果图'));
    setSources(modelSourceUploadListFromSaved(piece.model?.modelFiles));
  }, [form, piece.id, stamp]);

  useEffect(() => {
    let cancelled = false;
    orderService.listModelVersions(orderId, piece.id).then((list) => {
      if (!cancelled) setVersions(list || []);
    }).catch(() => {
      if (!cancelled) setVersions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, piece.id, stamp]);

  const uploadEffect: NonNullable<UploadProps['customRequest']> = async (options) => {
    const { file, onError, onSuccess } = options;
    try {
      const res = await orderService.uploadModelEffectFile(orderId, file as File);
      let url = res.fileUrl?.trim();
      if (!url) url = (await orderService.previewFile(res.id))?.trim();
      if (!url) throw new Error('未返回图片地址');
      dirty.current = true;
      onSuccess?.({ ...res, url });
      message.success(`「${piece.name}」效果图已上传，请保存这一件`);
    } catch {
      message.error('效果图上传失败');
      onError?.(new Error('上传失败'));
    }
  };

  const uploadSource: NonNullable<UploadProps['customRequest']> = async (options) => {
    const { file, onError, onSuccess } = options;
    try {
      const res = await orderService.uploadModelFile(orderId, file as File);
      let url = res.fileUrl?.trim();
      if (!url) url = (await orderService.previewFile(res.id))?.trim();
      dirty.current = true;
      onSuccess?.(url ? { ...res, url } : res);
      message.success(`「${piece.name}」源文件已上传，请保存这一件`);
    } catch {
      message.error('源文件上传失败');
      onError?.(new Error('上传失败'));
    }
  };

  const save = async () => {
    if (locked) {
      message.warning(`「${piece.name}」客户已确认，请勿修改`);
      return;
    }
    try {
      setSaving(true);
      const values = form.getFieldsValue();
      await orderService.updatePieceStones(orderId, piece.id, stonesForSave(stones));
      await orderService.updateOrderModel(orderId, {
        pieceId: piece.id,
        modelerId: values.modelerId,
        weight: values.weight,
        modelNotes: values.modelNotes,
        modelEffectImageUrls: collectDoneImageUrlsFromFileList(effects),
        modelSourceFileIds: sourceIdsOf(sources),
        createVersion: true,
        submitToCustomer: false,
      });
      dirty.current = false;
      message.success(`「${piece.name}」已保存，未发送客户`);
      await onSaved();
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    if (versionPick == null) {
      message.info('请选择要恢复的历史版本');
      return;
    }
    try {
      await orderService.restoreModelVersion(orderId, piece.id, versionPick);
      dirty.current = false;
      message.success(`「${piece.name}」已恢复为所选版本`);
      await onSaved();
    } catch (error) {
      message.error(String((error as Error)?.message || error));
    }
  };

  const readOnly = disabled || locked;
  return (
    <article
      id={`model-piece-${piece.id}`}
      className={`modeler-piece${active ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}
      onFocusCapture={onFocus}
    >
      <div className="modeler-piece__design">
        <PieceDesignCard piece={piece} active={active} onSelect={() => onFocus()} />
      </div>
      <Form
        form={form}
        layout="vertical"
        className="modeler-piece__form"
        disabled={readOnly}
        onValuesChange={() => {
          dirty.current = true;
        }}
      >
        <div className="modeler-piece__form-head">
          <strong>建模 · {piece.name}</strong>
          {piece.modelConfirmed ? <Tag color="success">模型已确认</Tag> : <Tag>待提交</Tag>}
        </div>
        {versions.length > 0 ? (
          <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
            <Select
              placeholder="历史版本"
              style={{ flex: 1 }}
              value={versionPick ?? undefined}
              onChange={setVersionPick}
              options={versions.map((ver) => ({
                value: ver.id,
                label: `${ver.label || `v${ver.versionNo}`}${ver.submittedToCustomer ? ' · 已提交' : ' · 草稿'} · ${ver.createdAt ? dayjs(ver.createdAt).format('MM-DD HH:mm') : ''}`,
              }))}
            />
            <Button disabled={readOnly || versionPick == null} onClick={() => void restore()}>恢复</Button>
          </Space.Compact>
        ) : null}
        <div className="modeler-piece__fields">
          <Form.Item name="modelerId" label="建模师">
            <Select
              allowClear
              options={modelers.map((user) => ({ value: user.id, label: user.realName || user.username }))}
            />
          </Form.Item>
          <Form.Item name="weight" label="克重">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item label="石料" extra="设计师已填的石料可以在这里改。保存这一件时一起写入。">
          <StoneEditor rows={stones} disabled={readOnly} onChange={(rows) => { dirty.current = true; setStones(rows); }} />
        </Form.Item>
        <Form.Item name="modelNotes" label="建模备注">
          <Input.TextArea rows={2} placeholder="修改说明会随这一件的建模稿发给客户" />
        </Form.Item>
        <Form.Item label="效果图" extra="只属于这一件。上传后要点「保存这一件」。">
          <UploadWithImagePreview
            listType="picture-card"
            accept="image/*"
            multiple
            disabled={readOnly}
            fileList={effects}
            onChange={({ fileList }) => {
              dirty.current = true;
              setEffects(normalizeDoneImageUploadFileList(fileList));
            }}
            customRequest={uploadEffect}
          >
            <div>
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>上传</div>
            </div>
          </UploadWithImagePreview>
        </Form.Item>
        <Form.Item label="源文件" style={{ marginBottom: 8 }}>
          <UploadWithModelSourcePreview
            multiple
            disabled={readOnly}
            fileList={sources}
            onChange={({ fileList }) => {
              dirty.current = true;
              setSources(normalizeModelSourceUploadFileList(fileList));
            }}
            customRequest={uploadSource}
            onDownloadFile={(fileId, fileName) => {
              void orderService.downloadFile(fileId).then((blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName || `model-${fileId}`;
                link.click();
                URL.revokeObjectURL(link.href);
              }).catch((error: unknown) => message.error(String((error as Error)?.message || error)));
            }}
          >
            <Button icon={<PlusOutlined />}>上传源文件</Button>
          </UploadWithModelSourcePreview>
        </Form.Item>
        <Button type="primary" block disabled={readOnly} loading={saving} onClick={() => void save()}>
          保存「{piece.name}」
        </Button>
      </Form>
    </article>
  );
}
