export interface RemoteFile {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  url?: string;
  uploadProgress?: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  file?: File;
}

export interface RemoteFileBrowserState {
  files: RemoteFile[];
  isDragActive: boolean;
  isUploading: boolean;
  selectedFiles: string[];
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface StorageConfig {
  containerName: string;
  accountName: string;
  sasToken?: string;
  connectionString?: string;
  credential?: 'anonymous' | 'sas' | 'connectionString' | 'defaultAzureCredential';
}

export interface IStorageService {
  uploadFile(file: File, config: StorageConfig, onProgress?: (progress: number) => void): Promise<UploadResult>;
  deleteFile(fileName: string, config: StorageConfig): Promise<boolean>;
  getFileUrl(fileName: string, config: StorageConfig): string;
  listFiles(config: StorageConfig, prefix?: string): Promise<BlobItem[]>;
  downloadFile(fileName: string, config: StorageConfig): Promise<Blob | null>;
}

export interface BlobItem {
  name: string;
  size: number;
  lastModified: Date;
  contentType: string;
  url: string;
}

export interface RemoteFileUploadTicket {
  id: string;
  fileName: string;
  fileSize: number;
  uploadUrl: string;
  expiryDate: Date;
  status: 'active' | 'expired' | 'used';
}

export type FileFilter = {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
};

export type SortField = 'name' | 'size' | 'lastModified' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface FileSortOptions {
  field: SortField;
  direction: SortDirection;
}