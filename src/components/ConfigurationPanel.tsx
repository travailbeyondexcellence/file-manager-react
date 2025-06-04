import React, { useState } from 'react';

interface ConfigurationPanelProps {
  onConfigUpdate: (config: {
    repoTagsEndpoint: string;
    filesAvailableEndpoint: string;
    uploadCloudEndpoint: string;
    authToken: string;
    azureStorageAccount: string;
    azureContainerName: string;
    azureSasToken: string;
  }) => void;
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState({
    repoTagsEndpoint: import.meta.env.VITE_REPO_TAGS_ENDPOINT || '',
    filesAvailableEndpoint: import.meta.env.VITE_FILES_AVAILABLE_ENDPOINT || '',
    uploadCloudEndpoint: import.meta.env.VITE_UPLOAD_CLOUD_ENDPOINT || '',
    authToken: import.meta.env.VITE_API_AUTH_TOKEN || '',
    azureStorageAccount: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT || '',
    azureContainerName: import.meta.env.VITE_AZURE_CONTAINER_NAME || '',
    azureSasToken: import.meta.env.VITE_AZURE_SAS_TOKEN || '',
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
  };

  const handleSave = () => {
    onConfigUpdate(config);
    alert('Configuration updated! Please refresh the page to apply changes.');
  };

  const extractActualEndpoint = (postmanUrl: string): string => {
    // Try to extract actual API endpoint from Postman URL
    // This is a placeholder - you'll need to provide the actual API endpoints
    if (postmanUrl.includes('postman.co')) {
      return ''; // Return empty for manual input
    }
    return postmanUrl;
  };

  return (
    <div style={{ 
      background: '#f5f5f5', 
      padding: '20px', 
      margin: '20px 0', 
      borderRadius: '8px',
      border: '1px solid #ddd'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          cursor: 'pointer', 
          fontWeight: 'bold', 
          marginBottom: isExpanded ? '20px' : '0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <span>{isExpanded ? '🔽' : '▶️'}</span>
        <span>API Configuration Panel</span>
      </div>
      
      {isExpanded && (
        <div style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Repository Tags Endpoint:
            </label>
            <input
              type="text"
              value={config.repoTagsEndpoint}
              onChange={(e) => handleInputChange('repoTagsEndpoint', e.target.value)}
              placeholder="https://your-api-domain.com/api/tags"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Files Available Endpoint:
            </label>
            <input
              type="text"
              value={config.filesAvailableEndpoint}
              onChange={(e) => handleInputChange('filesAvailableEndpoint', e.target.value)}
              placeholder="https://your-api-domain.com/api/files"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Upload Cloud Endpoint:
            </label>
            <input
              type="text"
              value={config.uploadCloudEndpoint}
              onChange={(e) => handleInputChange('uploadCloudEndpoint', e.target.value)}
              placeholder="https://your-api-domain.com/api/upload"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              API Authentication Token:
            </label>
            <input
              type="password"
              value={config.authToken}
              onChange={(e) => handleInputChange('authToken', e.target.value)}
              placeholder="your-api-token-here"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Azure Storage Account:
            </label>
            <input
              type="text"
              value={config.azureStorageAccount}
              onChange={(e) => handleInputChange('azureStorageAccount', e.target.value)}
              placeholder="yourstorageaccount"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Azure Container Name:
            </label>
            <input
              type="text"
              value={config.azureContainerName}
              onChange={(e) => handleInputChange('azureContainerName', e.target.value)}
              placeholder="uploads"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
              Azure SAS Token:
            </label>
            <input
              type="password"
              value={config.azureSasToken}
              onChange={(e) => handleInputChange('azureSasToken', e.target.value)}
              placeholder="your-sas-token-here"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={handleSave}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Save Configuration
            </button>
          </div>

          <div style={{ 
            background: '#fff3cd', 
            border: '1px solid #ffeaa7', 
            padding: '10px', 
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            <strong>⚠️ Note:</strong> The current endpoints in your .env file appear to be Postman collection links. 
            Please replace them with the actual API endpoints. For example:
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li>Repository Tags: <code>GET /api/repository/tags</code></li>
              <li>Files Available: <code>GET /api/files/available</code></li>
              <li>Upload Cloud: <code>POST /api/files/upload</code></li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigurationPanel;