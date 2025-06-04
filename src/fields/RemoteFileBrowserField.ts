import { 
  RemoteFile, 
  RemoteFileBrowserState, 
  StorageConfig, 
  FileFilter, 
  FileSortOptions,
  SortField,
  SortDirection 
} from '../models/RemoteFileBrowserModel';
import { RemoteUploadStrategy } from '../strategies/RemoteUploadStrategy';

export class RemoteFileBrowserField {
  private state: RemoteFileBrowserState;
  private uploadStrategy: RemoteUploadStrategy;
  private storageConfig: StorageConfig;
  private fileFilter: FileFilter;
  private onStateChange?: (state: RemoteFileBrowserState) => void;

  constructor(
    uploadStrategy: RemoteUploadStrategy,
    storageConfig: StorageConfig,
    options?: {
      fileFilter?: FileFilter;
      onStateChange?: (state: RemoteFileBrowserState) => void;
    }
  ) {
    this.uploadStrategy = uploadStrategy;
    this.storageConfig = storageConfig;
    this.fileFilter = options?.fileFilter || {};
    this.onStateChange = options?.onStateChange;
    
    this.state = {
      files: [],
      isDragActive: false,
      isUploading: false,
      selectedFiles: [],
    };
  }

  getState(): RemoteFileBrowserState {
    return { ...this.state };
  }

  setDragActive(isDragActive: boolean): void {
    this.updateState({ isDragActive });
  }

  async addFiles(fileList: FileList | File[]): Promise<void> {
    const files = Array.from(fileList);
    
    // Filter files based on file filter
    const filteredFiles = this.filterFiles(files);
    
    if (filteredFiles.length === 0) {
      return;
    }

    // Convert to RemoteFile objects
    const remoteFiles: RemoteFile[] = filteredFiles.map(file => ({
      id: this.generateFileId(),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      status: 'pending',
      file,
    }));

    // Add to state
    this.updateState({
      files: [...this.state.files, ...remoteFiles],
    });

    // Start upload
    await this.uploadFiles(remoteFiles);
  }

  private async uploadFiles(files: RemoteFile[]): Promise<void> {
    this.updateState({ isUploading: true });

    try {
      // Update files to uploading status
      const uploadingFiles = files.map(file => ({ ...file, status: 'uploading' as const }));
      this.updateFiles(uploadingFiles);

      // Upload files
      const fileObjects = files.map(f => f.file!);
      const results = await this.uploadStrategy.uploadFiles(fileObjects, this.storageConfig);

      // Update files with results
      const updatedFiles = files.map((file, index) => ({
        ...file,
        status: results[index].success ? 'completed' as const : 'failed' as const,
        url: results[index].url,
      }));

      this.updateFiles(updatedFiles);
    } finally {
      this.updateState({ isUploading: false });
    }
  }

  removeFile(fileId: string): void {
    const updatedFiles = this.state.files.filter(file => file.id !== fileId);
    this.updateState({ files: updatedFiles });
  }

  selectFile(fileId: string): void {
    const selectedFiles = [...this.state.selectedFiles];
    const index = selectedFiles.indexOf(fileId);
    
    if (index === -1) {
      selectedFiles.push(fileId);
    } else {
      selectedFiles.splice(index, 1);
    }
    
    this.updateState({ selectedFiles });
  }

  selectAllFiles(): void {
    const allFileIds = this.state.files.map(file => file.id);
    this.updateState({ selectedFiles: allFileIds });
  }

  clearSelection(): void {
    this.updateState({ selectedFiles: [] });
  }

  getSelectedFiles(): RemoteFile[] {
    return this.state.files.filter(file => 
      this.state.selectedFiles.includes(file.id)
    );
  }

  sortFiles(sortOptions: FileSortOptions): void {
    const sortedFiles = [...this.state.files].sort((a, b) => {
      let aValue: any = a[sortOptions.field];
      let bValue: any = b[sortOptions.field];

      if (sortOptions.field === 'lastModified') {
        aValue = aValue.getTime();
        bValue = bValue.getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortOptions.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOptions.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.updateState({ files: sortedFiles });
  }

  searchFiles(searchTerm: string): RemoteFile[] {
    if (!searchTerm.trim()) {
      return this.state.files;
    }

    const term = searchTerm.toLowerCase();
    return this.state.files.filter(file =>
      file.name.toLowerCase().includes(term) ||
      file.type.toLowerCase().includes(term)
    );
  }

  getFileStats(): {
    totalFiles: number;
    totalSize: number;
    completedFiles: number;
    failedFiles: number;
  } {
    const files = this.state.files;
    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      completedFiles: files.filter(file => file.status === 'completed').length,
      failedFiles: files.filter(file => file.status === 'failed').length,
    };
  }

  retryFailedUploads(): Promise<void> {
    const failedFiles = this.state.files.filter(file => file.status === 'failed');
    return this.uploadFiles(failedFiles);
  }

  private filterFiles(files: File[]): File[] {
    let filtered = files;

    if (this.fileFilter.accept) {
      const acceptedTypes = this.fileFilter.accept.split(',').map(type => type.trim());
      filtered = filtered.filter(file => {
        return acceptedTypes.some(acceptedType => {
          if (acceptedType.startsWith('.')) {
            return file.name.toLowerCase().endsWith(acceptedType.toLowerCase());
          }
          if (acceptedType.includes('*')) {
            const pattern = acceptedType.replace('*', '.*');
            return new RegExp(pattern).test(file.type);
          }
          return file.type === acceptedType;
        });
      });
    }

    if (this.fileFilter.maxSize) {
      filtered = filtered.filter(file => file.size <= this.fileFilter.maxSize!);
    }

    if (this.fileFilter.maxFiles) {
      const remainingSlots = this.fileFilter.maxFiles - this.state.files.length;
      filtered = filtered.slice(0, Math.max(0, remainingSlots));
    }

    return filtered;
  }

  private updateFiles(updatedFiles: RemoteFile[]): void {
    const fileMap = new Map(updatedFiles.map(file => [file.id, file]));
    const newFiles = this.state.files.map(file => 
      fileMap.get(file.id) || file
    );
    this.updateState({ files: newFiles });
  }

  private updateState(updates: Partial<RemoteFileBrowserState>): void {
    this.state = { ...this.state, ...updates };
    this.onStateChange?.(this.state);
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileIcon(type: string): string {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('text')) return '📝';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📁';
  }
}