import React, { useState, useRef, useEffect } from 'react';
import { RemoteFileBrowserField } from '../fields/RemoteFileBrowserField';
import { RemoteUploadStrategy } from '../strategies/RemoteUploadStrategy';
import { AzureStorageService } from '../services/AzureStorageService';
import { RemoteTagsService } from '../services/RemoteTagsService';
import { 
  RemoteFileBrowserState, 
  StorageConfig, 
  FileFilter,
  FileSortOptions,
  SortField,
  SortDirection 
} from '../models/RemoteFileBrowserModel';
import { UploadTag } from '../models/RemoteTagsModel';
import './RemoteFileBrowser.scss';

interface RemoteFileBrowserProps {
  storageConfig: StorageConfig;
  fileFilter?: FileFilter;
  onFilesChange?: (files: any[]) => void;
  disabled?: boolean;
  showUploadProgress?: boolean;
  tagsService?: RemoteTagsService;
  autoLoadFromTags?: boolean;
  onPostSuccess?: (result: any) => void;
  onPostError?: (error: string) => void;
}

const RemoteFileBrowser: React.FC<RemoteFileBrowserProps> = ({
  storageConfig,
  fileFilter,
  onFilesChange,
  disabled = false,
  showUploadProgress = true,
  tagsService,
  autoLoadFromTags = false,
  onPostSuccess,
  onPostError,
}) => {
  const [state, setState] = useState<RemoteFileBrowserState>({
    files: [],
    isDragActive: false,
    isUploading: false,
    selectedFiles: [],
  });
  const [sortOptions, setSortOptions] = useState<FileSortOptions>({
    field: 'name',
    direction: 'asc',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFromTags, setIsLoadingFromTags] = useState(false);
  const [currentUploadTag, setCurrentUploadTag] = useState<UploadTag | undefined>();
  const [isPosting, setIsPosting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileBrowserField = useRef<RemoteFileBrowserField | null>(null);

  useEffect(() => {
    const azureService = new AzureStorageService();
    const uploadStrategy = new RemoteUploadStrategy(azureService, {
      maxFileSize: fileFilter?.maxSize,
      allowedTypes: fileFilter?.accept?.split(',').map(t => t.trim()),
    });
    
    fileBrowserField.current = new RemoteFileBrowserField(
      uploadStrategy,
      storageConfig,
      {
        fileFilter,
        tagsService,
        onStateChange: (newState) => {
          setState(newState);
          onFilesChange?.(newState.files);
          // Update current upload tag when state changes
          const uploadTag = fileBrowserField.current?.getCurrentUploadTag();
          setCurrentUploadTag(uploadTag);
        },
      }
    );

    // Auto-load from tags if enabled
    if (autoLoadFromTags && tagsService) {
      handleLoadFromTags();
    }
  }, [storageConfig, fileFilter, onFilesChange, tagsService, autoLoadFromTags]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && fileBrowserField.current) {
      fileBrowserField.current.addFiles(e.target.files);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || !fileBrowserField.current) return;
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      fileBrowserField.current.setDragActive(true);
    } else if (e.type === 'dragleave') {
      fileBrowserField.current.setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || !fileBrowserField.current) return;
    
    fileBrowserField.current.setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileBrowserField.current.addFiles(e.dataTransfer.files);
    }
  };

  const handleSort = (field: SortField) => {
    const newDirection: SortDirection = 
      sortOptions.field === field && sortOptions.direction === 'asc' ? 'desc' : 'asc';
    
    const newSortOptions = { field, direction: newDirection };
    setSortOptions(newSortOptions);
    fileBrowserField.current?.sortFiles(newSortOptions);
  };

  const handleDeleteFile = (fileId: string) => {
    fileBrowserField.current?.removeFile(fileId);
  };

  const handleSelectFile = (fileId: string) => {
    fileBrowserField.current?.selectFile(fileId);
  };

  const handleDownloadFile = (file: any) => {
    if (file.file) {
      const url = URL.createObjectURL(file.file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  const displayedFiles = searchTerm
    ? fileBrowserField.current?.searchFiles(searchTerm) || []
    : state.files;

  const stats = fileBrowserField.current?.getFileStats() || {
    totalFiles: 0,
    totalSize: 0,
    completedFiles: 0,
    failedFiles: 0,
  };

  const getSortIcon = (field: SortField) => {
    if (sortOptions.field !== field) return '↕️';
    return sortOptions.direction === 'asc' ? '↑' : '↓';
  };

  const handleLoadFromTags = async () => {
    if (!fileBrowserField.current || !tagsService) return;
    
    setIsLoadingFromTags(true);
    try {
      const success = await fileBrowserField.current.initializeFromRemoteTags();
      if (!success) {
        onPostError?.('Failed to load files from remote tags');
      }
    } catch (error) {
      console.error('Error loading from tags:', error);
      onPostError?.('Error loading files from remote tags');
    } finally {
      setIsLoadingFromTags(false);
    }
  };

  const handlePostFiles = async (includeContent = false) => {
    if (!fileBrowserField.current) return;
    
    setIsPosting(true);
    try {
      const success = includeContent 
        ? await fileBrowserField.current.postFilesToServerWithContent()
        : await fileBrowserField.current.postFilesToServer();
      
      if (success) {
        onPostSuccess?.(success);
      } else {
        onPostError?.('Failed to post files to server');
      }
    } catch (error) {
      console.error('Error posting files:', error);
      onPostError?.('Error posting files to server');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h2>Remote File Browser</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {tagsService && (
            <button 
              className="load-btn"
              onClick={handleLoadFromTags}
              disabled={disabled || isLoadingFromTags}
            >
              {isLoadingFromTags ? 'Loading...' : 'Load from Tags'}
            </button>
          )}
          <button 
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || state.isUploading}
          >
            {state.isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

      {currentUploadTag && (
        <div className="upload-tag-info">
          <div className="tag-details">
            <span className="tag-name">📂 {currentUploadTag.name}</span>
            <span className="tag-folder">Folder: {currentUploadTag.customTags.folder}</span>
          </div>
        </div>
      )}

      {showUploadProgress && stats.totalFiles > 0 && (
        <div className="upload-stats">
          <span>Files: {stats.totalFiles}</span>
          <span>Completed: {stats.completedFiles}</span>
          <span>Failed: {stats.failedFiles}</span>
          <span>Size: {fileBrowserField.current?.formatFileSize(stats.totalSize)}</span>
        </div>
      )}

      <div 
        className={`drop-zone ${state.isDragActive ? 'drag-active' : ''} ${disabled ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="file-input"
          disabled={disabled}
          accept={fileFilter?.accept}
        />
        <div className="drop-zone-content">
          <p>Drag and drop files here or click to upload</p>
          <span className="drop-zone-icon">📁</span>
        </div>
      </div>

      <div className="file-list">
        {displayedFiles.length === 0 ? (
          <p className="no-files">
            {searchTerm ? 'No files match your search' : 'No files uploaded yet'}
          </p>
        ) : (
          <>
            <div className="file-list-header">
              <button 
                className="sort-btn"
                onClick={() => handleSort('name')}
              >
                Name {getSortIcon('name')}
              </button>
              <button 
                className="sort-btn"
                onClick={() => handleSort('size')}
              >
                Size {getSortIcon('size')}
              </button>
              <button 
                className="sort-btn"
                onClick={() => handleSort('lastModified')}
              >
                Modified {getSortIcon('lastModified')}
              </button>
              <span>Actions</span>
            </div>
            
            {displayedFiles.map(file => (
              <div 
                key={file.id} 
                className={`file-item ${file.status} ${
                  state.selectedFiles.includes(file.id) ? 'selected' : ''
                }`}
              >
                <div className="file-info">
                  <input
                    type="checkbox"
                    checked={state.selectedFiles.includes(file.id)}
                    onChange={() => handleSelectFile(file.id)}
                    className="file-checkbox"
                  />
                  <span className="file-icon">
                    {fileBrowserField.current?.getFileIcon(file.type)}
                  </span>
                  <div className="file-details">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-meta">
                      {fileBrowserField.current?.formatFileSize(file.size)} • {file.lastModified.toLocaleDateString()}
                    </span>
                    {file.status === 'uploading' && (
                      <div className="upload-progress">
                        <div className="progress-bar">
                          <div className="progress-fill"></div>
                        </div>
                      </div>
                    )}
                    {file.status === 'failed' && (
                      <span className="error-message">Upload failed</span>
                    )}
                  </div>
                </div>
                <div className="file-actions">
                  {file.status === 'completed' && (
                    <button 
                      className="action-btn download-btn"
                      onClick={() => handleDownloadFile(file)}
                      title="Download"
                    >
                      ⬇️
                    </button>
                  )}
                  {file.status === 'failed' && (
                    <button 
                      className="action-btn retry-btn"
                      onClick={() => fileBrowserField.current?.retryFailedUploads()}
                      title="Retry"
                    >
                      🔄
                    </button>
                  )}
                  <button 
                    className="action-btn delete-btn"
                    onClick={() => handleDeleteFile(file.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {state.selectedFiles.length > 0 && (
        <div className="bulk-actions">
          <span>{state.selectedFiles.length} files selected</span>
          <button 
            className="bulk-action-btn"
            onClick={() => fileBrowserField.current?.clearSelection()}
          >
            Clear Selection
          </button>
        </div>
      )}

      {fileBrowserField.current?.hasRemoteFiles() && (
        <div className="post-actions">
          <div className="post-info">
            <span>Remote files ready: {fileBrowserField.current?.getRemoteFilesCount()}</span>
          </div>
          <div className="post-buttons">
            <button 
              className="post-btn post-urls"
              onClick={() => handlePostFiles(false)}
              disabled={isPosting || state.isUploading}
            >
              {isPosting ? 'Posting...' : 'Post File URLs'}
            </button>
            <button 
              className="post-btn post-content"
              onClick={() => handlePostFiles(true)}
              disabled={isPosting || state.isUploading}
            >
              {isPosting ? 'Posting...' : 'Post with Content'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteFileBrowser;