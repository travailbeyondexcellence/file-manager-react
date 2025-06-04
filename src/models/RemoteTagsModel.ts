export interface RemoteTag {
  id: string;
  name: string;
  type: 'upload' | 'download' | 'process' | 'other';
  value: string;
  customTags?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadTag extends RemoteTag {
  type: 'upload';
  customTags: {
    folder: string;
    allowedTypes?: string[];
    maxFileSize?: number;
    maxFiles?: number;
  };
}

export interface RemoteTagsResponse {
  tags: RemoteTag[];
  total: number;
  hasUploadTag: boolean;
  uploadTag?: UploadTag;
}

export interface PostFilesRequest {
  files: PostFile[];
  metadata?: Record<string, any>;
  tagId?: string;
}

export interface PostFile {
  name: string;
  size: number;
  type: string;
  content: string | Blob;
  url?: string;
}

export interface PostFilesResponse {
  success: boolean;
  message: string;
  processedFiles: number;
  errors?: string[];
}