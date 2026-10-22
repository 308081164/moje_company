import React, { useCallback, useState } from 'react';
import { Image, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  isLikelyRasterImageFile,
  resolveUploadFileImageSrc,
} from '@/utils/orderUploadFileList';
import { meshPreviewKind } from '@/utils/modelSourcePreview';
import ModelMeshPreviewModal from '@/components/ModelMeshPreviewModal';

export type UploadWithModelSourcePreviewProps = Omit<UploadProps, 'onPreview' | 'fileList'> & {
  fileList: UploadFile[];
  onDownloadFile?: (fileId: number, fileName: string) => void;
};

/**
 * 建模源文件上传：栅格图走 Image 预览；STL/OBJ 走三维预览；其它格式提示下载。
 */
const UploadWithModelSourcePreview: React.FC<UploadWithModelSourcePreviewProps> = ({
  fileList,
  onDownloadFile,
  ...rest
}) => {
  const [imgOpen, setImgOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [meshFile, setMeshFile] = useState<UploadFile | null>(null);
  const [meshOpen, setMeshOpen] = useState(false);

  const onPreview = useCallback<NonNullable<UploadProps['onPreview']>>(
    (file) => {
      if (file.status !== 'done' && !file.originFileObj) {
        message.info('请等待上传完成后再预览');
        return;
      }
      if (isLikelyRasterImageFile(file)) {
        const u = resolveUploadFileImageSrc(file)?.trim();
        if (!u) {
          message.warning('暂无可预览地址');
          return;
        }
        setImgSrc(u);
        setImgOpen(true);
        return;
      }
      const kind = meshPreviewKind(file.name || '');
      if (kind === 'stl' || kind === 'obj' || kind === 'none') {
        setMeshFile(file);
        setMeshOpen(true);
        return;
      }
      message.warning('暂不支持预览该格式');
    },
    []
  );

  return (
    <>
      <Upload
        {...rest}
        fileList={fileList}
        onPreview={onPreview}
        showUploadList={{ showPreviewIcon: true, showRemoveIcon: true }}
      />
      {imgSrc ? (
        <Image
          key={imgSrc}
          alt="预览"
          style={{ display: 'none' }}
          src={imgSrc}
          preview={{
            visible: imgOpen,
            onVisibleChange: (v) => {
              setImgOpen(v);
              if (!v) setImgSrc('');
            },
          }}
        />
      ) : null}
      <ModelMeshPreviewModal
        open={meshOpen}
        file={meshFile}
        onClose={() => {
          setMeshOpen(false);
          setMeshFile(null);
        }}
        onDownload={onDownloadFile}
      />
    </>
  );
};

export default UploadWithModelSourcePreview;
