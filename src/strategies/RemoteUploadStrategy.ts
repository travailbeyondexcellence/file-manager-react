import { IStorageService, StorageConfig, UploadResult, RemoteFile } from '../models/RemoteFileBrowserModel';

export interface UploadStrategy {
  uploadFile(file: File, config: StorageConfig): Promise<UploadResult>;
  uploadFiles(files: File[], config: StorageConfig): Promise<UploadResult[]>;
  validateFile(file: File): { valid: boolean; error?: string };
}

export class RemoteUploadStrategy implements UploadStrategy {
  private maxFileSize = 100 * 1024 * 1024; // 100MB
  private allowedTypes: string[] = [];
  private storageService: IStorageService;

  constructor(storageService: IStorageService, options?: {
    maxFileSize?: number;
    allowedTypes?: string[];
  }) {
    this.storageService = storageService;
    if (options?.maxFileSize) {
      this.maxFileSize = options.maxFileSize;
    }
    if (options?.allowedTypes) {
      this.allowedTypes = options.allowedTypes;
    }
  }

  validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.formatFileSize(this.maxFileSize)}`,
      };
    }

    if (this.allowedTypes.length > 0 && !this.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      };
    }

    if (file.name.length > 255) {
      return {
        valid: false,
        error: 'File name is too long (maximum 255 characters)',
      };
    }

    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(file.name)) {
      return {
        valid: false,
        error: 'File name contains invalid characters',
      };
    }

    return { valid: true };
  }

  async uploadFile(file: File, config: StorageConfig): Promise<UploadResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    try {
      return await this.storageService.uploadFile(file, config);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async uploadFiles(files: File[], config: StorageConfig): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    // Upload files in parallel with concurrency limit
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(files, concurrencyLimit);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(file => this.uploadFile(file, config))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  setMaxFileSize(size: number): void {
    this.maxFileSize = size;
  }

  setAllowedTypes(types: string[]): void {
    this.allowedTypes = types;
  }

  getMaxFileSize(): number {
    return this.maxFileSize;
  }

  getAllowedTypes(): string[] {
    return [...this.allowedTypes];
  }
}

export class BatchUploadStrategy extends RemoteUploadStrategy {
  private batchSize: number;

  constructor(storageService: IStorageService, batchSize = 5, options?: {
    maxFileSize?: number;
    allowedTypes?: string[];
  }) {
    super(storageService, options);
    this.batchSize = batchSize;
  }

  async uploadFiles(files: File[], config: StorageConfig): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const batches = this.chunkArray(files, this.batchSize);
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(file => this.uploadFile(file, config))
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming the server
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}