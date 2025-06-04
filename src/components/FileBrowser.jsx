import { useState, useRef } from 'react'
import './FileBrowser.scss'

const FileBrowser = () => {
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return '🖼️'
    if (type.startsWith('video/')) return '🎥'
    if (type.startsWith('audio/')) return '🎵'
    if (type.includes('pdf')) return '📄'
    if (type.includes('text')) return '📝'
    if (type.includes('zip') || type.includes('rar')) return '📦'
    return '📁'
  }

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      file: file
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const handleFileInput = (e) => {
    handleFiles(e.target.files)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const deleteFile = (id) => {
    setFiles(prev => prev.filter(file => file.id !== id))
  }

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file.file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h2>File Browser</h2>
        <button 
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Files
        </button>
      </div>

      <div 
        className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
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
        />
        <div className="drop-zone-content">
          <p>Drag and drop files here or click to upload</p>
          <span className="drop-zone-icon">📁</span>
        </div>
      </div>

      <div className="file-list">
        {files.length === 0 ? (
          <p className="no-files">No files uploaded yet</p>
        ) : (
          files.map(file => (
            <div key={file.id} className="file-item">
              <div className="file-info">
                <span className="file-icon">{getFileIcon(file.type)}</span>
                <div className="file-details">
                  <span className="file-name">{file.name}</span>
                  <span className="file-meta">
                    {formatFileSize(file.size)} • {file.lastModified.toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="file-actions">
                <button 
                  className="action-btn download-btn"
                  onClick={() => downloadFile(file)}
                  title="Download"
                >
                  ⬇️
                </button>
                <button 
                  className="action-btn delete-btn"
                  onClick={() => deleteFile(file.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default FileBrowser