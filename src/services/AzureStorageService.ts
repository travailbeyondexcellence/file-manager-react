import { IStorageService, StorageConfig, UploadResult } from '../models/RemoteFileBrowserModel';

export class AzureStorageService implements IStorageService {
  private readonly baseUrl = 'https://{accountName}.blob.core.windows.net';

  async uploadFile(file: File, config: StorageConfig): Promise<UploadResult> {
    try {
      const url = this.getUploadUrl(file.name, config);
      
      const response = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': file.type || 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      return {
        success: true,
        url: this.getFileUrl(file.name, config),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async deleteFile(fileUrl: string, config: StorageConfig): Promise<boolean> {
    try {
      const fileName = this.extractFileNameFromUrl(fileUrl);
      const deleteUrl = this.getDeleteUrl(fileName, config);

      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'x-ms-delete-type': 'permanent',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  }

  getFileUrl(fileName: string, config: StorageConfig): string {
    const baseUrl = this.baseUrl.replace('{accountName}', config.accountName);
    return `${baseUrl}/${config.containerName}/${encodeURIComponent(fileName)}`;
  }

  private getUploadUrl(fileName: string, config: StorageConfig): string {
    const fileUrl = this.getFileUrl(fileName, config);
    return `${fileUrl}?${config.sasToken}`;
  }

  private getDeleteUrl(fileName: string, config: StorageConfig): string {
    const fileUrl = this.getFileUrl(fileName, config);
    return `${fileUrl}?${config.sasToken}`;
  }

  private extractFileNameFromUrl(url: string): string {
    const urlParts = url.split('/');
    return decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
  }

  async validateConnection(config: StorageConfig): Promise<boolean> {
    try {
      const testUrl = `${this.baseUrl.replace('{accountName}', config.accountName)}/${config.containerName}?restype=container&${config.sasToken}`;
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
      });

      return response.ok;
    } catch (error) {
      console.error('Connection validation failed:', error);
      return false;
    }
  }

  async listFiles(config: StorageConfig): Promise<string[]> {
    try {
      const listUrl = `${this.baseUrl.replace('{accountName}', config.accountName)}/${config.containerName}?restype=container&comp=list&${config.sasToken}`;
      
      const response = await fetch(listUrl);
      
      if (!response.ok) {
        throw new Error(`List failed: ${response.status} ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const blobNames = Array.from(xmlDoc.querySelectorAll('Name')).map(
        (nameElement) => nameElement.textContent || ''
      );

      return blobNames.filter(name => name.length > 0);
    } catch (error) {
      console.error('List files failed:', error);
      return [];
    }
  }
}