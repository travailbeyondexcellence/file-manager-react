import React, { useState, useEffect } from 'react';
import { RemoteFileUploadTicketViewModel, TicketGenerationRequest } from '../viewmodels/RemoteFileUploadTicketViewModel';
import { RemoteFileUploadTicket } from '../models/RemoteFileBrowserModel';

interface RemoteFileUploadTicketViewProps {
  viewModel: RemoteFileUploadTicketViewModel;
  onTicketGenerated?: (ticket: RemoteFileUploadTicket) => void;
  onTicketUsed?: (ticketId: string) => void;
  showHistory?: boolean;
}

const RemoteFileUploadTicketView: React.FC<RemoteFileUploadTicketViewProps> = ({
  viewModel,
  onTicketGenerated,
  onTicketUsed,
  showHistory = true,
}) => {
  const [tickets, setTickets] = useState<RemoteFileUploadTicket[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTicketRequest, setNewTicketRequest] = useState<TicketGenerationRequest>({
    fileName: '',
    fileSize: 0,
    contentType: '',
    expiryHours: 24,
  });
  const [stats, setStats] = useState({ total: 0, active: 0, used: 0, expired: 0 });
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  useEffect(() => {
    refreshTickets();
    const interval = setInterval(() => {
      viewModel.cleanupExpiredTickets();
      refreshTickets();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [viewModel]);

  const refreshTickets = () => {
    const allTickets = viewModel.getAllTickets();
    setTickets(allTickets);
    setStats(viewModel.getTicketStats());
  };

  const handleGenerateTicket = async () => {
    if (!newTicketRequest.fileName || newTicketRequest.fileSize <= 0) {
      alert('Please provide valid file name and size');
      return;
    }

    setIsGenerating(true);
    try {
      const ticket = await viewModel.generateUploadTicket(newTicketRequest);
      if (ticket) {
        refreshTickets();
        onTicketGenerated?.(ticket);
        
        // Reset form
        setNewTicketRequest({
          fileName: '',
          fileSize: 0,
          contentType: '',
          expiryHours: 24,
        });
      } else {
        alert('Failed to generate upload ticket');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseTicket = async (ticketId: string) => {
    const success = await viewModel.markTicketAsUsed(ticketId);
    if (success) {
      refreshTickets();
      onTicketUsed?.(ticketId);
    } else {
      alert('Failed to use ticket');
    }
  };

  const handleRefreshTicket = async (ticketId: string) => {
    const refreshedTicket = await viewModel.refreshTicket(ticketId);
    if (refreshedTicket) {
      refreshTickets();
    } else {
      alert('Failed to refresh ticket');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#28a745';
      case 'used': return '#6c757d';
      case 'expired': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const activeTickets = tickets.filter(t => t.status === 'active' && new Date() <= t.expiryDate);
  const expiredTickets = tickets.filter(t => t.status === 'expired' || new Date() > t.expiryDate);
  const usedTickets = tickets.filter(t => t.status === 'used');

  return (
    <div className="upload-ticket-view">
      <div className="ticket-stats">
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.used}</span>
          <span className="stat-label">Used</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.expired}</span>
          <span className="stat-label">Expired</span>
        </div>
      </div>

      <div className="tab-controls">
        <button 
          className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate Ticket
        </button>
        {showHistory && (
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Ticket History
          </button>
        )}
      </div>

      {activeTab === 'generate' && (
        <div className="generate-ticket-form">
          <h3>Generate Upload Ticket</h3>
          <div className="form-group">
            <label htmlFor="fileName">File Name:</label>
            <input
              id="fileName"
              type="text"
              value={newTicketRequest.fileName}
              onChange={(e) => setNewTicketRequest({
                ...newTicketRequest,
                fileName: e.target.value
              })}
              placeholder="Enter file name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="fileSize">File Size (bytes):</label>
            <input
              id="fileSize"
              type="number"
              value={newTicketRequest.fileSize || ''}
              onChange={(e) => setNewTicketRequest({
                ...newTicketRequest,
                fileSize: parseInt(e.target.value) || 0
              })}
              placeholder="Enter file size"
            />
            <span className="file-size-display">
              {newTicketRequest.fileSize > 0 && formatFileSize(newTicketRequest.fileSize)}
            </span>
          </div>
          
          <div className="form-group">
            <label htmlFor="contentType">Content Type:</label>
            <input
              id="contentType"
              type="text"
              value={newTicketRequest.contentType}
              onChange={(e) => setNewTicketRequest({
                ...newTicketRequest,
                contentType: e.target.value
              })}
              placeholder="e.g., image/jpeg, application/pdf"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="expiryHours">Expiry (hours):</label>
            <select
              id="expiryHours"
              value={newTicketRequest.expiryHours}
              onChange={(e) => setNewTicketRequest({
                ...newTicketRequest,
                expiryHours: parseInt(e.target.value)
              })}
            >
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>
          
          <button 
            className="generate-btn"
            onClick={handleGenerateTicket}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Ticket'}
          </button>
        </div>
      )}

      {activeTab === 'history' && showHistory && (
        <div className="ticket-history">
          <h3>Upload Tickets</h3>
          
          {activeTickets.length > 0 && (
            <div className="ticket-section">
              <h4>Active Tickets ({activeTickets.length})</h4>
              {activeTickets.map(ticket => (
                <div key={ticket.id} className="ticket-item active">
                  <div className="ticket-header">
                    <span className="ticket-filename">{ticket.fileName}</span>
                    <span 
                      className="ticket-status"
                      style={{ color: getStatusColor(ticket.status) }}
                    >
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="ticket-details">
                    <span>Size: {formatFileSize(ticket.fileSize)}</span>
                    <span>Expires: {viewModel.formatExpiryTime(ticket)}</span>
                    <span>ID: {ticket.id}</span>
                  </div>
                  <div className="ticket-actions">
                    <button 
                      className="action-btn use-btn"
                      onClick={() => handleUseTicket(ticket.id)}
                    >
                      Use Ticket
                    </button>
                    <button 
                      className="action-btn refresh-btn"
                      onClick={() => handleRefreshTicket(ticket.id)}
                    >
                      Refresh
                    </button>
                    <button 
                      className="action-btn copy-btn"
                      onClick={() => navigator.clipboard.writeText(ticket.uploadUrl)}
                    >
                      Copy URL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {usedTickets.length > 0 && (
            <div className="ticket-section">
              <h4>Used Tickets ({usedTickets.length})</h4>
              {usedTickets.map(ticket => (
                <div key={ticket.id} className="ticket-item used">
                  <div className="ticket-header">
                    <span className="ticket-filename">{ticket.fileName}</span>
                    <span 
                      className="ticket-status"
                      style={{ color: getStatusColor(ticket.status) }}
                    >
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="ticket-details">
                    <span>Size: {formatFileSize(ticket.fileSize)}</span>
                    <span>ID: {ticket.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {expiredTickets.length > 0 && (
            <div className="ticket-section">
              <h4>Expired Tickets ({expiredTickets.length})</h4>
              {expiredTickets.map(ticket => (
                <div key={ticket.id} className="ticket-item expired">
                  <div className="ticket-header">
                    <span className="ticket-filename">{ticket.fileName}</span>
                    <span 
                      className="ticket-status"
                      style={{ color: getStatusColor('expired') }}
                    >
                      EXPIRED
                    </span>
                  </div>
                  <div className="ticket-details">
                    <span>Size: {formatFileSize(ticket.fileSize)}</span>
                    <span>Expired: {ticket.expiryDate.toLocaleDateString()}</span>
                    <span>ID: {ticket.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tickets.length === 0 && (
            <p className="no-tickets">No upload tickets found</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RemoteFileUploadTicketView;