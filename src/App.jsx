import RemoteFileBrowser from './components/RemoteFileBrowser'
import RemoteFileUploadTicketView from './components/RemoteFileUploadTicketView'
import { RemoteFileUploadTicketViewModel } from './viewmodels/RemoteFileUploadTicketViewModel'
import { StorageConfig } from './models/RemoteFileBrowserModel'
import './App.css'

function App() {
  // Example configuration - replace with your actual values
  const storageConfig: StorageConfig = {
    containerName: 'uploads',
    accountName: 'yourstorageaccount',
    sasToken: 'your-sas-token-here'
  };

  // Example API configuration for upload tickets
  const ticketViewModel = new RemoteFileUploadTicketViewModel(
    'https://your-api-endpoint.com/api',
    'your-auth-token-here'
  );

  return (
    <div className="App">
      <h1>Remote File Manager</h1>
      
      <div style={{ marginBottom: '2rem' }}>
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
