import { 
  BlobServiceClient, 
  ContainerClient, 
  BlockBlobClient,
  AnonymousCredential,
  StorageSharedKeyCredential
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { IStorageService, StorageConfig, UploadResult, BlobItem } from '../models/RemoteFileBrowserModel';

export class AzureStorageService implements IStorageService {
  private getBlobServiceClient(config: StorageConfig): BlobServiceClient {
    const baseUrl = `https://${config.accountName}.blob.core.windows.net`;

    if (config.connectionString) {
      return BlobServiceClient.fromConnectionString(config.connectionString);
    }

    if (config.sasToken) {
      return new BlobServiceClient(`${baseUrl}?${config.sasToken}`);
    }

    switch (config.credential) {
      case 'defaultAzureCredential':
        return new BlobServiceClient(baseUrl, new DefaultAzureCredential());
      case 'anonymous':
        return new BlobServiceClient(baseUrl, new AnonymousCredential());
      default:
        throw new Error('No valid credential provided');
    }
  }

  private getContainerClient(config: StorageConfig): ContainerClient {
    const blobServiceClient = this.getBlobServiceClient(config);
    return blobServiceClient.getContainerClient(config.containerName);
  }

  private getBlobClient(fileName: string, config: StorageConfig): BlockBlobClient {
    const containerClient = this.getContainerClient(config);
    return containerClient.getBlockBlobClient(fileName);
  }

  async uploadFile(
    file: File, 
    config: StorageConfig, 
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    try {
      const blobClient = this.getBlobClient(file.name, config);
      
      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: file.type || 'application/octet-stream',
        },
        onProgress: onProgress ? (ev: any) => {
          if (ev.loadedBytes && file.size) {
            const progress = Math.round((ev.loadedBytes / file.size) * 100);
            onProgress(progress);
          }
        } : undefined,
      };

      const uploadResponse = await blobClient.uploadData(file, uploadOptions);

      if (uploadResponse._response.status >= 200 && uploadResponse._response.status < 300) {
        return {
          success: true,
          url: blobClient.url,
        };
      } else {
        throw new Error(`Upload failed with status: ${uploadResponse._response.status}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async deleteFile(fileName: string, config: StorageConfig): Promise<boolean> {
    try {
      const blobClient = this.getBlobClient(fileName, config);
      const deleteResponse = await blobClient.deleteIfExists();
      return deleteResponse.succeeded;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  }

  getFileUrl(fileName: string, config: StorageConfig): string {
    const blobClient = this.getBlobClient(fileName, config);
    return blobClient.url;
  }

  async listFiles(config: StorageConfig, prefix?: string): Promise<BlobItem[]> {
    try {
      const containerClient = this.getContainerClient(config);
      const blobs: BlobItem[] = [];

      const listOptions = prefix ? { prefix } : undefined;
      
      for await (const blob of containerClient.listBlobsFlat(listOptions)) {
        blobs.push({
          name: blob.name,
          size: blob.properties.contentLength || 0,
          lastModified: blob.properties.lastModified || new Date(),
          contentType: blob.properties.contentType || 'application/octet-stream',
          url: containerClient.getBlockBlobClient(blob.name).url,
        });
      }

      return blobs;
    } catch (error) {
      console.error('List files failed:', error);
      return [];
    }
  }

  async downloadFile(fileName: string, config: StorageConfig): Promise<Blob | null> {
    try {
      const blobClient = this.getBlobClient(fileName, config);
      const downloadResponse = await blobClient.download();
      
      if (downloadResponse.readableStreamBody) {
        const response = new Response(downloadResponse.readableStreamBody);
        return await response.blob();
      }
      
      return null;
    } catch (error) {
      console.error('Download failed:', error);
      return null;
    }
  }

  async validateConnection(config: StorageConfig): Promise<boolean> {
    try {
      const containerClient = this.getContainerClient(config);
      const exists = await containerClient.exists();
      return exists;
    } catch (error) {
      console.error('Connection validation failed:', error);
      return false;
    }
  }

  async createContainer(config: StorageConfig, publicAccess: 'blob' | 'container' | 'none' = 'none'): Promise<boolean> {
    try {
      const containerClient = this.getContainerClient(config);
      const createResponse = await containerClient.createIfNotExists({
        access: publicAccess === 'none' ? undefined : publicAccess,
      });
      return createResponse.succeeded;
    } catch (error) {
      console.error('Container creation failed:', error);
      return false;
    }
  }

  async getBlobProperties(fileName: string, config: StorageConfig): Promise<any> {
    try {
      const blobClient = this.getBlobClient(fileName, config);
      const properties = await blobClient.getProperties();
      return properties;
    } catch (error) {
      console.error('Get blob properties failed:', error);
      return null;
    }
  }

  async setBlobMetadata(fileName: string, config: StorageConfig, metadata: Record<string, string>): Promise<boolean> {
    try {
      const blobClient = this.getBlobClient(fileName, config);
      await blobClient.setMetadata(metadata);
      return true;
    } catch (error) {
      console.error('Set blob metadata failed:', error);
      return false;
    }
  }

  generateSasUrl(fileName: string, config: StorageConfig, expiryHours = 24): string {
    try {
      const blobClient = this.getBlobClient(fileName, config);
      
      // Note: This requires the account key to be available
      // For SAS generation with the SDK, you'll need proper credentials
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + expiryHours);
      
      // This is a simplified example - actual SAS generation requires account key
      return blobClient.url + `?se=${expiryDate.toISOString()}&sp=r`;
    } catch (error) {
      console.error('SAS URL generation failed:', error);
      return blobClient.url;
    }
  }
}