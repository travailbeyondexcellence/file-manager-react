import { 
  RemoteFile, 
  RemoteFileBrowserState, 
  StorageConfig, 
  FileFilter, 
  FileSortOptions,
  SortField,
  SortDirection,
  BlobItem 
} from '../models/RemoteFileBrowserModel';
import { RemoteUploadStrategy } from '../strategies/RemoteUploadStrategy';
import { RemoteTagsService } from '../services/RemoteTagsService';
import { UploadTag, PostFilesRequest } from '../models/RemoteTagsModel';

export class RemoteFileBrowserField {
  private state: RemoteFileBrowserState;
  private uploadStrategy: RemoteUploadStrategy;
  private storageConfig: StorageConfig;
  private fileFilter: FileFilter;
  private onStateChange?: (state: RemoteFileBrowserState) => void;
  private tagsService?: RemoteTagsService;
  private currentUploadTag?: UploadTag;

  constructor(
    uploadStrategy: RemoteUploadStrategy,
    storageConfig: StorageConfig,
    options?: {
      fileFilter?: FileFilter;
      onStateChange?: (state: RemoteFileBrowserState) => void;
      tagsService?: RemoteTagsService;
    }
  ) {
    this.uploadStrategy = uploadStrategy;
    this.storageConfig = storageConfig;
    this.fileFilter = options?.fileFilter || {};
    this.onStateChange = options?.onStateChange;
    this.tagsService = options?.tagsService;
    
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

  // Remote tags workflow methods
  async initializeFromRemoteTags(): Promise<boolean> {
    if (!this.tagsService) {
      console.warn('No tags service configured');
      return false;
    }

    try {
      this.updateState({ isUploading: true });
      
      // Fetch upload tag
      const uploadTag = await this.tagsService.getUploadTag();
      if (!uploadTag) {
        console.warn('No upload tag found');
        return false;
      }

      this.currentUploadTag = uploadTag;
      
      // Extract folder path
      const folderPath = this.tagsService.extractFolderPath(uploadTag);
      if (!folderPath) {
        console.warn('No folder path found in upload tag');
        return false;
      }

      // Update file filter from upload tag
      const tagFileFilter = this.tagsService.getFileFilterFromUploadTag(uploadTag);
      this.fileFilter = { ...this.fileFilter, ...tagFileFilter };

      // Load files from remote folder
      await this.loadFilesFromRemoteFolder(folderPath);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize from remote tags:', error);
      return false;
    } finally {
      this.updateState({ isUploading: false });
    }
  }

  async loadFilesFromRemoteFolder(folderPath: string): Promise<void> {
    try {
      // Use storage service to list files in the folder
      const blobItems = await this.uploadStrategy['storageService'].listFiles(
        this.storageConfig, 
        folderPath
      );

      // Convert blob items to remote files
      const remoteFiles: RemoteFile[] = blobItems.map(item => ({
        id: this.generateFileId(),
        name: item.name.replace(folderPath + '/', ''), // Remove folder prefix
        size: item.size,
        type: item.contentType,
        lastModified: item.lastModified,
        status: 'completed',
        url: item.url,
      }));

      this.updateState({ files: remoteFiles });
    } catch (error) {
      console.error('Failed to load files from remote folder:', error);
      throw error;
    }
  }

  async postFilesToServer(): Promise<boolean> {
    if (!this.tagsService || !this.currentUploadTag) {
      console.error('No tags service or upload tag available for posting');
      return false;
    }

    try {
      this.updateState({ isUploading: true });

      // Get files to post (only completed files)
      const filesToPost = this.state.files.filter(file => file.status === 'completed');
      
      if (filesToPost.length === 0) {
        console.warn('No completed files to post');
        return false;
      }

      // Option 1: Post file URLs only (recommended for large files)
      const postFiles = filesToPost.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
        content: file.url || '', // Use URL as content
        url: file.url,
      }));

      const request: PostFilesRequest = {
        files: postFiles,
        metadata: {
          uploadTagId: this.currentUploadTag.id,
          folderPath: this.tagsService.extractFolderPath(this.currentUploadTag),
          totalFiles: filesToPost.length,
          timestamp: new Date().toISOString(),
        },
        tagId: this.currentUploadTag.id,
      };

      const result = await this.tagsService.postFilesToServer(request);
      
      if (result.success) {
        console.log(`Successfully posted ${result.processedFiles} files`);
        return true;
      } else {
        console.error('Failed to post files:', result.message, result.errors);
        return false;
      }
    } catch (error) {
      console.error('Error posting files to server:', error);
      return false;
    } finally {
      this.updateState({ isUploading: false });
    }
  }

  async postFilesToServerWithContent(): Promise<boolean> {
    if (!this.tagsService || !this.currentUploadTag) {
      console.error('No tags service or upload tag available for posting');
      return false;
    }

    try {
      this.updateState({ isUploading: true });

      // Get files to post (only completed files)
      const filesToPost = this.state.files.filter(file => file.status === 'completed');
      
      if (filesToPost.length === 0) {
        console.warn('No completed files to post');
        return false;
      }

      // Download file contents and create post files
      const postFiles = await this.tagsService.downloadAndConvertBlobItems(
        filesToPost.map(file => ({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          contentType: file.type,
          url: file.url || '',
        })),
        (url) => this.uploadStrategy['storageService'].downloadFile(
          this.extractFileNameFromUrl(url), 
          this.storageConfig
        )
      );

      const request: PostFilesRequest = {
        files: postFiles,
        metadata: {
          uploadTagId: this.currentUploadTag.id,
          folderPath: this.tagsService.extractFolderPath(this.currentUploadTag),
          totalFiles: filesToPost.length,
          timestamp: new Date().toISOString(),
        },
        tagId: this.currentUploadTag.id,
      };

      const result = await this.tagsService.postFilesToServerAsJSON(request);
      
      if (result.success) {
        console.log(`Successfully posted ${result.processedFiles} files with content`);
        return true;
      } else {
        console.error('Failed to post files:', result.message, result.errors);
        return false;
      }
    } catch (error) {
      console.error('Error posting files to server:', error);
      return false;
    } finally {
      this.updateState({ isUploading: false });
    }
  }

  private extractFileNameFromUrl(url: string): string {
    const urlParts = url.split('/');
    return decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
  }

  getCurrentUploadTag(): UploadTag | undefined {
    return this.currentUploadTag;
  }

  hasRemoteFiles(): boolean {
    return this.state.files.some(file => file.status === 'completed' && file.url);
  }

  getRemoteFilesCount(): number {
    return this.state.files.filter(file => file.status === 'completed' && file.url).length;
  }
}