import { RemoteTag, RemoteTagsResponse, UploadTag, PostFilesRequest, PostFilesResponse } from '../models/RemoteTagsModel';
import { BlobItem } from '../models/RemoteFileBrowserModel';

export class RemoteTagsService {
  private tagsEndpoint: string;
  private postEndpoint: string;
  private authToken?: string;

  constructor(tagsEndpoint: string, postEndpoint: string, authToken?: string) {
    this.tagsEndpoint = tagsEndpoint;
    this.postEndpoint = postEndpoint;
    this.authToken = authToken;
  }

  async fetchRemoteTags(): Promise<RemoteTagsResponse> {
    try {
      console.log('Fetching remote tags from:', this.tagsEndpoint);
      
      const response = await fetch(this.tagsEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(this.authToken && this.authToken !== 'your-api-token-here' && { 'Authorization': `Bearer ${this.authToken}` }),
        },
        mode: 'cors', // Enable CORS
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      const tags: RemoteTag[] = Array.isArray(data) ? data : data.tags || [];
      
      // Parse dates
      const parsedTags = tags.map(tag => ({
        ...tag,
        createdAt: new Date(tag.createdAt),
        updatedAt: new Date(tag.updatedAt),
      }));

      // Find upload tag
      const uploadTag = parsedTags.find(tag => tag.type === 'upload') as UploadTag | undefined;
      
      return {
        tags: parsedTags,
        total: parsedTags.length,
        hasUploadTag: !!uploadTag,
        uploadTag,
      };
    } catch (error) {
      console.error('Error fetching remote tags:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          console.error('CORS error - the server may not allow cross-origin requests');
        } else if (error.message.includes('Failed to fetch')) {
          console.error('Network error - check if the endpoint is accessible');
        }
      }
      
      return {
        tags: [],
        total: 0,
        hasUploadTag: false,
      };
    }
  }

  async getUploadTag(): Promise<UploadTag | null> {
    const tagsResponse = await this.fetchRemoteTags();
    return tagsResponse.uploadTag || null;
  }

  extractFolderPath(uploadTag: UploadTag): string {
    return uploadTag.customTags.folder || '';
  }

  getFileFilterFromUploadTag(uploadTag: UploadTag): {
    accept?: string;
    maxSize?: number;
    maxFiles?: number;
  } {
    return {
      accept: uploadTag.customTags.allowedTypes?.join(','),
      maxSize: uploadTag.customTags.maxFileSize,
      maxFiles: uploadTag.customTags.maxFiles,
    };
  }

  async postFilesToServer(request: PostFilesRequest): Promise<PostFilesResponse> {
    try {
      const formData = new FormData();
      
      // Add files to form data
      request.files.forEach((file, index) => {
        if (file.content instanceof Blob) {
          formData.append(`files[${index}]`, file.content, file.name);
        } else if (typeof file.content === 'string') {
          // If content is base64 or text, convert to blob
          const blob = new Blob([file.content], { type: file.type });
          formData.append(`files[${index}]`, blob, file.name);
        }
        
        // Add file metadata
        formData.append(`metadata[${index}][name]`, file.name);
        formData.append(`metadata[${index}][size]`, file.size.toString());
        formData.append(`metadata[${index}][type]`, file.type);
        if (file.url) {
          formData.append(`metadata[${index}][url]`, file.url);
        }
      });

      // Add general metadata
      if (request.metadata) {
        Object.entries(request.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, JSON.stringify(value));
        });
      }

      // Add tag ID if provided
      if (request.tagId) {
        formData.append('tagId', request.tagId);
      }

      const response = await fetch(this.postEndpoint, {
        method: 'POST',
        headers: {
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`POST failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Files posted successfully',
        processedFiles: result.processedFiles || request.files.length,
        errors: result.errors,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to post files',
        processedFiles: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  async postFilesToServerAsJSON(request: PostFilesRequest): Promise<PostFilesResponse> {
    try {
      // Convert files to base64 for JSON transmission
      const filesWithBase64 = await Promise.all(
        request.files.map(async (file) => {
          let content = file.content;
          
          if (file.content instanceof Blob) {
            // Convert blob to base64
            const buffer = await file.content.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            content = `data:${file.type};base64,${base64}`;
          }
          
          return {
            ...file,
            content,
          };
        })
      );

      const payload = {
        ...request,
        files: filesWithBase64,
      };

      const response = await fetch(this.postEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`POST failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Files posted successfully',
        processedFiles: result.processedFiles || request.files.length,
        errors: result.errors,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to post files',
        processedFiles: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  convertBlobItemsToPostFiles(blobItems: BlobItem[], includeContent = false): PostFile[] {
    return blobItems.map(item => ({
      name: item.name,
      size: item.size,
      type: item.contentType,
      content: includeContent ? '' : item.url, // Use URL if not including content
      url: item.url,
    }));
  }

  async downloadAndConvertBlobItems(
    blobItems: BlobItem[], 
    downloadFunction: (url: string) => Promise<Blob | null>
  ): Promise<PostFile[]> {
    const postFiles: PostFile[] = [];
    
    for (const item of blobItems) {
      try {
        const blob = await downloadFunction(item.url);
        if (blob) {
          postFiles.push({
            name: item.name,
            size: item.size,
            type: item.contentType,
            content: blob,
            url: item.url,
          });
        } else {
          // Fallback to URL only
          postFiles.push({
            name: item.name,
            size: item.size,
            type: item.contentType,
            content: item.url,
            url: item.url,
          });
        }
      } catch (error) {
        console.error(`Failed to download ${item.name}:`, error);
        // Add as URL reference
        postFiles.push({
          name: item.name,
          size: item.size,
          type: item.contentType,
          content: item.url,
          url: item.url,
        });
      }
    }
    
    return postFiles;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }

  updateEndpoints(tagsEndpoint?: string, postEndpoint?: string): void {
    if (tagsEndpoint) this.tagsEndpoint = tagsEndpoint;
    if (postEndpoint) this.postEndpoint = postEndpoint;
  }
}