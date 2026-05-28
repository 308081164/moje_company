import axios from 'axios';
import { message } from 'antd';

// 文件上传配置
export interface UploadConfig {
  maxSize?: number; // 最大文件大小（字节）
  allowedTypes?: string[]; // 允许的文件类型
  maxFiles?: number; // 最大文件数量
  chunkSize?: number; // 分片大小（字节）
  retryTimes?: number; // 重试次数
}

// 上传进度回调
export interface UploadProgressCallback {
  (progress: number): void;
}

// 上传结果
export interface UploadResult {
  success: boolean;
  message?: string;
  data?: {
    url: string;
    filename: string;
    size: number;
    type: string;
    id?: string;
  };
  error?: string;
}

// 分片上传参数
export interface ChunkUploadParams {
  file: File;
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  fileId: string;
  fileName: string;
}


const RASTER_IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i;

function isAllowedImageMimeOrExtension(file: File, allowedTypes: string[]): boolean {
  if (allowedTypes.includes(file.type)) {
    return true;
  }
  if (file.type && file.type !== 'application/octet-stream') {
    return false;
  }
  return RASTER_IMAGE_EXT.test(file.name);
}

// 默认配置
const DEFAULT_CONFIG: UploadConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/x-ms-bmp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'model/stl',
    'model/obj',
    'application/octet-stream', // 3D模型文件
  ],
  maxFiles: 10,
  chunkSize: 2 * 1024 * 1024, // 2MB
  retryTimes: 3,
};

class UploadService {
  private config: UploadConfig;

  constructor(config?: UploadConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 验证文件
   */
  private validateFile(file: File): { valid: boolean; message?: string } {
    // 检查文件大小
    if (file.size > this.config.maxSize!) {
      return {
        valid: false,
        message: `文件大小不能超过 ${this.formatFileSize(this.config.maxSize!)}`,
      };
    }

    // 检查文件类型
    if (this.config.allowedTypes && !this.config.allowedTypes.includes(file.type)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const extAllowed = ext && this.config.allowedTypes.some((t) => t.endsWith('/' + ext) || t === 'image/' + ext || t === 'image/x-ms-' + ext);
      if (!extAllowed && !RASTER_IMAGE_EXT.test(file.name)) {
        return {
          valid: false,
          message: `不支持的文件类型: ${file.type || file.name}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 生成文件ID
   */
  private generateFileId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 普通文件上传
   */
  async uploadFile(
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<UploadResult> {
    try {
      // 验证文件
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message,
        };
      }

      // 创建 FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('type', file.type);
      formData.append('size', file.size.toString());

      // 上传文件
      const response = await axios.post('/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(progress);
          }
        },
      });

      return {
        success: true,
        message: '文件上传成功',
        data: response.data,
      };
    } catch (error: any) {
      console.error('文件上传失败:', error);
      return {
        success: false,
        message: '文件上传失败',
        error: error.message,
      };
    }
  }

  /**
   * 分片上传
   */
  async uploadFileChunked(
    file: File,
    onProgress?: UploadProgressCallback
  ): Promise<UploadResult> {
    try {
      // 验证文件
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message,
        };
      }

      // 生成文件ID
      const fileId = this.generateFileId();
      const chunkSize = this.config.chunkSize!;
      const totalChunks = Math.ceil(file.size / chunkSize);

      // 初始化上传
      await this.initChunkUpload(fileId, file.name, file.size, totalChunks);

      // 上传所有分片
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkParams: ChunkUploadParams = {
          file: chunk as File,
          chunkIndex,
          totalChunks,
          chunkSize,
          fileId,
          fileName: file.name,
        };

        // 上传分片（带重试）
        await this.uploadChunkWithRetry(chunkParams);

        // 更新进度
        if (onProgress) {
          const progress = Math.round(((chunkIndex + 1) * 100) / totalChunks);
          onProgress(progress);
        }
      }

      // 完成上传
      const result = await this.completeChunkUpload(fileId);

      return {
        success: true,
        message: '文件上传成功',
        data: result,
      };
    } catch (error: any) {
      console.error('分片上传失败:', error);
      return {
        success: false,
        message: '文件上传失败',
        error: error.message,
      };
    }
  }

  /**
   * 初始化分片上传
   */
  private async initChunkUpload(
    fileId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number
  ): Promise<void> {
    await axios.post('/upload/chunk/init', {
      fileId,
      fileName,
      fileSize,
      totalChunks,
    });
  }

  /**
   * 上传分片（带重试）
   */
  private async uploadChunkWithRetry(
    params: ChunkUploadParams,
    retryCount = 0
  ): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', params.file);
      formData.append('fileId', params.fileId);
      formData.append('chunkIndex', params.chunkIndex.toString());
      formData.append('totalChunks', params.totalChunks.toString());
      formData.append('chunkSize', params.chunkSize.toString());
      formData.append('fileName', params.fileName);

      await axios.post('/upload/chunk', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (error) {
      if (retryCount < this.config.retryTimes!) {
        console.warn(`分片上传失败，第${retryCount + 1}次重试...`);
        await this.uploadChunkWithRetry(params, retryCount + 1);
      } else {
        throw error;
      }
    }
  }

  /**
   * 完成分片上传
   */
  private async completeChunkUpload(fileId: string): Promise<any> {
    const response = await axios.post('/upload/chunk/complete', { fileId });
    return response.data;
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    // 验证文件数量
    if (files.length > this.config.maxFiles!) {
      message.error(`最多只能上传 ${this.config.maxFiles} 个文件`);
      return results;
    }

    // 逐个上传文件
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 更新进度
      if (onProgress) {
        onProgress(Math.round((i * 100) / files.length), file.name);
      }

      // 上传文件
      const result = await this.uploadFile(file);
      results.push(result);

      // 更新进度
      if (onProgress) {
        onProgress(Math.round(((i + 1) * 100) / files.length), file.name);
      }
    }

    return results;
  }

  /**
   * 上传设计图
   */
  async uploadDesignImage(
    file: File,
    orderId: string,
    description?: string
  ): Promise<UploadResult> {
    try {
      // 验证文件（只允许图片）
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/x-ms-bmp',
        'image/svg+xml',
      ];

      if (!isAllowedImageMimeOrExtension(file, allowedTypes)) {
        return {
          success: false,
          message: '只支持图片文件（JPEG、PNG、GIF、WebP、BMP、SVG）',
        };
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId);
      formData.append('type', 'design');
      if (description) {
        formData.append('description', description);
      }

      const response = await axios.post('/upload/design', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        message: '设计图上传成功',
        data: response.data,
      };
    } catch (error: any) {
      console.error('设计图上传失败:', error);
      return {
        success: false,
        message: '设计图上传失败',
        error: error.message,
      };
    }
  }

  /**
   * 上传建模文件
   */
  async uploadModelFile(
    file: File,
    orderId: string,
    fileType: 'stl' | 'obj' | 'step' | 'iges',
    description?: string
  ): Promise<UploadResult> {
    try {
      // 验证文件（只允许3D模型文件）
      const allowedTypes = [
        'model/stl',
        'model/obj',
        'application/octet-stream',
      ];
      
      if (!allowedTypes.includes(file.type)) {
        // 检查文件扩展名
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (!['stl', 'obj', 'step', 'iges'].includes(ext || '')) {
          return {
            success: false,
            message: '只支持3D模型文件（STL、OBJ、STEP、IGES）',
          };
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId);
      formData.append('type', 'model');
      formData.append('fileType', fileType);
      if (description) {
        formData.append('description', description);
      }

      const response = await axios.post('/upload/model', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        message: '建模文件上传成功',
        data: response.data,
      };
    } catch (error: any) {
      console.error('建模文件上传失败:', error);
      return {
        success: false,
        message: '建模文件上传失败',
        error: error.message,
      };
    }
  }

  /**
   * 上传订单附件
   */
  async uploadOrderAttachment(
    file: File,
    orderId: string,
    attachmentType: 'contract' | 'invoice' | 'certificate' | 'other',
    description?: string
  ): Promise<UploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderId', orderId);
      formData.append('type', 'attachment');
      formData.append('attachmentType', attachmentType);
      if (description) {
        formData.append('description', description);
      }

      const response = await axios.post('/upload/attachment', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return {
        success: true,
        message: '附件上传成功',
        data: response.data,
      };
    } catch (error: any) {
      console.error('附件上传失败:', error);
      return {
        success: false,
        message: '附件上传失败',
        error: error.message,
      };
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      await axios.delete(`/upload/files/${fileId}`);
      return true;
    } catch (error) {
      console.error('文件删除失败:', error);
      return false;
    }
  }

  /**
   * 获取文件列表
   */
  async getFiles(params: {
    orderId?: string;
    type?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      const response = await axios.get('/upload/files', { params });
      return response.data;
    } catch (error) {
      console.error('获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(fileId: string): Promise<any> {
    try {
      const response = await axios.get(`/upload/files/${fileId}`);
      return response.data;
    } catch (error) {
      console.error('获取文件信息失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   */
  async downloadFile(fileId: string, filename?: string): Promise<void> {
    try {
      const response = await axios.get(`/upload/files/${fileId}/download`, {
        responseType: 'blob',
      });

      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('文件下载失败:', error);
      throw error;
    }
  }

  /**
   * 预览文件
   */
  async previewFile(fileId: string): Promise<string> {
    try {
      const response = await axios.get(`/upload/files/${fileId}/preview`);
      return response.data.url;
    } catch (error) {
      console.error('文件预览失败:', error);
      throw error;
    }
  }

  /**
   * 获取上传配置
   */
  getConfig(): UploadConfig {
    return { ...this.config };
  }

  /**
   * 更新上传配置
   */
  updateConfig(config: Partial<UploadConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 创建单例实例
export const uploadService = new UploadService();

export default UploadService;