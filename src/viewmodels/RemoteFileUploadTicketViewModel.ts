import { RemoteFileUploadTicket } from '../models/RemoteFileBrowserModel';

export interface TicketGenerationRequest {
  fileName: string;
  fileSize: number;
  contentType: string;
  expiryHours?: number;
}

export interface TicketValidationResult {
  isValid: boolean;
  isExpired: boolean;
  canUpload: boolean;
  error?: string;
}

export class RemoteFileUploadTicketViewModel {
  private tickets: Map<string, RemoteFileUploadTicket> = new Map();
  private apiEndpoint: string;
  private authToken?: string;

  constructor(apiEndpoint: string, authToken?: string) {
    this.apiEndpoint = apiEndpoint;
    this.authToken = authToken;
  }

  async generateUploadTicket(request: TicketGenerationRequest): Promise<RemoteFileUploadTicket | null> {
    try {
      const response = await fetch(`${this.apiEndpoint}/upload-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        },
        body: JSON.stringify({
          fileName: request.fileName,
          fileSize: request.fileSize,
          contentType: request.contentType,
          expiryHours: request.expiryHours || 24,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate ticket: ${response.status} ${response.statusText}`);
      }

      const ticketData = await response.json();
      const ticket: RemoteFileUploadTicket = {
        id: ticketData.id,
        fileName: ticketData.fileName,
        fileSize: ticketData.fileSize,
        uploadUrl: ticketData.uploadUrl,
        expiryDate: new Date(ticketData.expiryDate),
        status: 'active',
      };

      this.tickets.set(ticket.id, ticket);
      return ticket;
    } catch (error) {
      console.error('Error generating upload ticket:', error);
      return null;
    }
  }

  async validateTicket(ticketId: string): Promise<TicketValidationResult> {
    try {
      const response = await fetch(`${this.apiEndpoint}/upload-tickets/${ticketId}/validate`, {
        method: 'GET',
        headers: {
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        },
      });

      if (!response.ok) {
        return {
          isValid: false,
          isExpired: false,
          canUpload: false,
          error: `Validation failed: ${response.status} ${response.statusText}`,
        };
      }

      const validationData = await response.json();
      return {
        isValid: validationData.isValid,
        isExpired: validationData.isExpired,
        canUpload: validationData.canUpload,
      };
    } catch (error) {
      return {
        isValid: false,
        isExpired: false,
        canUpload: false,
        error: error instanceof Error ? error.message : 'Validation error',
      };
    }
  }

  async markTicketAsUsed(ticketId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/upload-tickets/${ticketId}/use`, {
        method: 'POST',
        headers: {
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        },
      });

      if (response.ok) {
        const ticket = this.tickets.get(ticketId);
        if (ticket) {
          ticket.status = 'used';
          this.tickets.set(ticketId, ticket);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking ticket as used:', error);
      return false;
    }
  }

  getTicket(ticketId: string): RemoteFileUploadTicket | undefined {
    return this.tickets.get(ticketId);
  }

  getAllTickets(): RemoteFileUploadTicket[] {
    return Array.from(this.tickets.values());
  }

  getActiveTickets(): RemoteFileUploadTicket[] {
    return this.getAllTickets().filter(ticket => 
      ticket.status === 'active' && !this.isTicketExpired(ticket)
    );
  }

  getExpiredTickets(): RemoteFileUploadTicket[] {
    return this.getAllTickets().filter(ticket => this.isTicketExpired(ticket));
  }

  cleanupExpiredTickets(): void {
    const expiredTicketIds: string[] = [];
    
    this.tickets.forEach((ticket, id) => {
      if (this.isTicketExpired(ticket)) {
        expiredTicketIds.push(id);
      }
    });

    expiredTicketIds.forEach(id => {
      const ticket = this.tickets.get(id);
      if (ticket) {
        ticket.status = 'expired';
        this.tickets.set(id, ticket);
      }
    });
  }

  private isTicketExpired(ticket: RemoteFileUploadTicket): boolean {
    return new Date() > ticket.expiryDate;
  }

  async refreshTicket(ticketId: string, expiryHours = 24): Promise<RemoteFileUploadTicket | null> {
    const existingTicket = this.tickets.get(ticketId);
    if (!existingTicket) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/upload-tickets/${ticketId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        },
        body: JSON.stringify({ expiryHours }),
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh ticket: ${response.status} ${response.statusText}`);
      }

      const refreshedData = await response.json();
      const refreshedTicket: RemoteFileUploadTicket = {
        ...existingTicket,
        uploadUrl: refreshedData.uploadUrl,
        expiryDate: new Date(refreshedData.expiryDate),
        status: 'active',
      };

      this.tickets.set(ticketId, refreshedTicket);
      return refreshedTicket;
    } catch (error) {
      console.error('Error refreshing ticket:', error);
      return null;
    }
  }

  getTicketStats(): {
    total: number;
    active: number;
    used: number;
    expired: number;
  } {
    const tickets = this.getAllTickets();
    return {
      total: tickets.length,
      active: this.getActiveTickets().length,
      used: tickets.filter(t => t.status === 'used').length,
      expired: this.getExpiredTickets().length,
    };
  }

  formatExpiryTime(ticket: RemoteFileUploadTicket): string {
    const now = new Date();
    const expiry = ticket.expiryDate;
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Expired';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m remaining`;
    } else {
      return `${diffMinutes}m remaining`;
    }
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }
}