import React, { useState, useRef, useEffect } from 'react';
import { RemoteFileBrowserField } from '../fields/RemoteFileBrowserField';
import { RemoteUploadStrategy } from '../strategies/RemoteUploadStrategy';
import { AzureStorageService } from '../services/AzureStorageService';
import { 
  RemoteFileBrowserState, 
  StorageConfig, 
  FileFilter,
  FileSortOptions,
  SortField,
  SortDirection 
} from '../models/RemoteFileBrowserModel';
import './RemoteFileBrowser.scss';

interface RemoteFileBrowserProps {
  storageConfig: StorageConfig;
  fileFilter?: FileFilter;
  onFilesChange?: (files: any[]) => void;
  disabled?: boolean;
  showUploadProgress?: boolean;
}

const RemoteFileBrowser: React.FC<RemoteFileBrowserProps> = ({
  storageConfig,
  fileFilter,
  onFilesChange,
  disabled = false,
  showUploadProgress = true,
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
        onStateChange: (newState) => {
          setState(newState);
          onFilesChange?.(newState.files);
        },
      }
    );
  }, [storageConfig, fileFilter, onFilesChange]);

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
          <button 
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || state.isUploading}
          >
            {state.isUploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default RemoteFileBrowser;