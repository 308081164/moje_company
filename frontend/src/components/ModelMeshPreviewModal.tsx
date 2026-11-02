import React from 'react';
import { Modal, Typography, Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { fileIdFromUpload, meshPreviewKind } from '@/utils/modelSourcePreview';
import ModelMeshViewport from '@/components/ModelMeshViewport';

export type ModelMeshPreviewModalProps = {
  open: boolean;
  file: UploadFile | null;
  onClose: () => void;
  onDownload?: (fileId: number, fileName: string) => void;
};

/** 上传列表点预览时的弹层；工艺验证页请用内嵌 ModelMeshViewport，勿依赖此弹窗。 */
const ModelMeshPreviewModal: React.FC<ModelMeshPreviewModalProps> = ({
  open,
  file,
  onClose,
  onDownload,
}) => {
  const name = file?.name || '模型文件';
  const kind = meshPreviewKind(name);
  const fileId = file ? fileIdFromUpload(file) : undefined;

  return (
    <Modal
      title={`三维预览：${name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
    >
      {!file || kind === 'none' ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            ZIP / JCD 等格式暂不支持在线三维预览。STEP / STL / OBJ / GLB 可旋转查看。
          </Typography.Text>
          {fileId != null && onDownload && (
            <Button icon={<DownloadOutlined />} onClick={() => onDownload(fileId, name)}>
              下载文件
            </Button>
          )}
        </Space>
      ) : (
        <ModelMeshViewport file={file} height={480} onDownload={onDownload} defaultAutoRotate />
      )}
    </Modal>
  );
};

export default ModelMeshPreviewModal;
