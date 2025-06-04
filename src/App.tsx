import RemoteFileBrowser from './components/RemoteFileBrowser'
import RemoteFileUploadTicketView from './components/RemoteFileUploadTicketView'
import ConfigurationPanel from './components/ConfigurationPanel'
import { RemoteFileUploadTicketViewModel } from './viewmodels/RemoteFileUploadTicketViewModel'
import { RemoteTagsService } from './services/RemoteTagsService'
import { StorageConfig } from './models/RemoteFileBrowserModel'
import './App.css'

function App() {
  // Configuration from environment variables
  const storageConfig: StorageConfig = {
    containerName: import.meta.env.VITE_AZURE_CONTAINER_NAME || 'uploads',
    accountName: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT || 'yourstorageaccount',
    sasToken: import.meta.env.VITE_AZURE_SAS_TOKEN || 'your-sas-token-here',
    credential: 'sas'
  };

  // API configuration from environment variables
  const authToken = import.meta.env.VITE_API_AUTH_TOKEN || 'your-auth-token-here';
  
  const ticketViewModel = new RemoteFileUploadTicketViewModel(
    import.meta.env.VITE_REPO_TAGS_ENDPOINT || 'https://your-api-endpoint.com/api',
    authToken
  );

  // Remote Tags Service configuration from environment variables
  const tagsService = new RemoteTagsService(
    import.meta.env.VITE_REPO_TAGS_ENDPOINT || 'https://your-api-endpoint.com/api/tags',
    import.meta.env.VITE_UPLOAD_CLOUD_ENDPOINT || 'https://your-api-endpoint.com/api/upload',
    authToken
  );

  const handleConfigUpdate = (newConfig: any) => {
    console.log('Configuration updated:', newConfig);
    // In a real app, you might want to store this in state and recreate the services
  };

  return (
    <div className="App">
      <h1>Remote File Manager</h1>
      
      <ConfigurationPanel onConfigUpdate={handleConfigUpdate} />
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Complete Workflow Demo</h2>
        <p>This demonstrates the full remote tags workflow:</p>
        <ol>
          <li>Click "Load from Tags" to fetch remote tags and load files from the specified folder</li>
          <li>Files from the remote folder will be displayed in the file manager</li>
          <li>Click "Post File URLs" or "Post with Content" to submit files to the server endpoint</li>
        </ol>
        
        <RemoteFileBrowser 
          storageConfig={storageConfig}
          fileFilter={{
            accept: 'image/*,application/pdf,.txt',
            maxSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10
          }}
          tagsService={tagsService}
          autoLoadFromTags={false} // Set to true to auto-load on component mount
          onFilesChange={(files) => {
            console.log('Files changed:', files);
          }}
          onPostSuccess={(result) => {
            console.log('Files posted successfully:', result);
            alert('Files posted successfully!');
          }}
          onPostError={(error) => {
            console.error('Error posting files:', error);
            alert(`Error: ${error}`);
          }}
        />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Standard File Upload</h2>
        <p>This is the standard file browser without remote tags integration:</p>
        
        <RemoteFileBrowser 
          storageConfig={storageConfig}
          fileFilter={{
            accept: 'image/*,application/pdf,.txt',
            maxSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10
          }}
          onFilesChange={(files) => {
            console.log('Files changed:', files);
          }}
        />
      </div>

      <div>
        <h2>Upload Ticket Management</h2>
        <RemoteFileUploadTicketView 
          viewModel={ticketViewModel}
          onTicketGenerated={(ticket) => {
            console.log('Ticket generated:', ticket);
          }}
          onTicketUsed={(ticketId) => {
            console.log('Ticket used:', ticketId);
          }}
          showHistory={true}
        />
      </div>
    </div>
  )
}

export default App
