import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService, type Project } from '../services/apiService';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import WebhookActivity from '../components/WebhookActivity';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showWebhookDetails, setShowWebhookDetails] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const loadProject = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await apiService.getProject(id);
      setProject(response.project);
      
      // Generate webhook URL for this project
      setWebhookUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/webhook/github/${id}`);
    } catch (error) {
      console.error('Failed to load project:', error);
      setAlert({
        type: 'error',
        message: 'Failed to load project details'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkWebhookConnection = async () => {
    if (!id) return;
    
    try {
      setChecking(true);
      const response = await apiService.checkWebhookStatus(id);
      setProject(prev => prev ? { ...prev, webhookConnected: response.webhookConnected } : null);
      
      if (response.webhookConnected) {
        setAlert({
          type: 'success',
          message: 'Webhook connection confirmed!'
        });
      }
    } catch (error) {
      console.error('Failed to check webhook status:', error);
      setAlert({
        type: 'error',
        message: 'Failed to check webhook status'
      });
    } finally {
      setChecking(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setAlert({
        type: 'success',
        message: `${label} copied to clipboard!`
      });
    } catch (error) {
      setAlert({
        type: 'error',
        message: `Failed to copy ${label.toLowerCase()}`
      });
    }
  };
  const regenerateWebhookSecret = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await apiService.regenerateWebhookSecret(id);
      
      // Update the project with new secret
      setProject(prev => prev ? { ...prev, webhookSecret: response.webhookSecret } : null);
      
      setAlert({
        type: 'success',
        message: 'Webhook secret regenerated successfully! Please update your GitHub webhook configuration.'
      });
    } catch (error) {
      console.error('Failed to regenerate webhook secret:', error);
      setAlert({
        type: 'error',
        message: 'Failed to regenerate webhook secret'
      });
    } finally {
      setLoading(false);
    }
  };
  const triggerManualDeployment = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      await apiService.triggerManualDeployment(id);
      
      setAlert({
        type: 'success',
        message: 'Manual deployment triggered successfully!'
      });
    } catch (error) {
      console.error('Failed to trigger deployment:', error);
      setAlert({
        type: 'error',
        message: 'Failed to trigger manual deployment'
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await apiService.testWebhook(id, 'ping');
      
      if (response.success) {
        setAlert({
          type: 'success',
          message: 'Test webhook event sent successfully! Check the webhook activity below.'
        });
        
        // Refresh project data to update webhook connection status
        setTimeout(() => {
          loadProject();
        }, 1000);
      } else {
        setAlert({
          type: 'error',
          message: 'Webhook test failed'
        });
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      setAlert({
        type: 'error',
        message: 'Failed to test webhook connection'
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async () => {
    if (!id) return;
    
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await apiService.deleteProject(id);
      
      setAlert({
        type: 'success',
        message: 'Project deleted successfully!'
      });
      
      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Failed to delete project:', error);
      setAlert({
        type: 'error',
        message: 'Failed to delete project'
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded mb-6"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
              <Button onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
              >
                ← Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600">{project.githubRepo}</p>
              </div>
            </div>            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                project.webhookConnected
                  ? 'text-green-700 bg-green-100'
                  : 'text-yellow-700 bg-yellow-100'
              }`}>
                {project.webhookConnected ? 'Webhook Connected' : 'Webhook Not Connected'}
              </span>
              {!project.webhookConnected && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowWebhookDetails(!showWebhookDetails)}
                >
                  Setup Webhook
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={checkWebhookConnection}
                disabled={checking}
              >
                {checking ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">          {alert && (
            <div className="mb-6">
              <Alert
                type={alert.type}
                message={alert.message}
                onClose={() => setAlert(null)}
              />
            </div>
          )}

          {/* Webhook Setup Section */}
          {(!project.webhookConnected || showWebhookDetails) && (
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Webhook Configuration</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Configure GitHub webhook to enable automatic deployments
                </p>
              </div>
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook URL
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={webhookUrl}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Webhook Secret
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        value={project.webhookSecret || 'Not available'}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(project.webhookSecret || '', 'Webhook Secret')}
                        disabled={!project.webhookSecret}
                      >
                        Copy
                      </Button>                      <Button
                        variant="outline"
                        size="sm"
                        onClick={regenerateWebhookSecret}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700"
                      >
                        {loading ? 'Regenerating...' : 'Regenerate'}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Setup Instructions:</h4>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                      <li>Go to your GitHub repository settings</li>
                      <li>Navigate to "Webhooks" in the sidebar</li>
                      <li>Click "Add webhook"</li>
                      <li>Paste the webhook URL above</li>
                      <li>Set Content type to "application/json"</li>
                      <li>Paste the webhook secret above</li>
                      <li>Select events you want to trigger deployments</li>
                      <li>Click "Add webhook"</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}          {/* Project Info */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Repository</label>
                  <p className="mt-1 text-sm text-gray-900">{project.githubRepo}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Branch</label>
                  <p className="mt-1 text-sm text-gray-900">{project.githubBranch}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Deployments</label>
                  <p className="mt-1 text-sm text-gray-900">{project._count?.deployments || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Project Actions */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Project Actions</h3>
            </div>
            <div className="px-6 py-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => window.open(`https://github.com/${project.githubRepo}`, '_blank')}
                >
                  View Repository
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://github.com/${project.githubRepo}/settings/hooks`, '_blank')}
                >
                  Manage Webhooks
                </Button>                <Button
                  variant="outline"
                  onClick={triggerManualDeployment}
                  disabled={loading}
                >
                  {loading ? 'Deploying...' : 'Deploy Latest'}
                </Button>
                <Button
                  variant="outline"
                  onClick={testWebhook}
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Webhook'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={deleteProject}
                  disabled={loading}
                  className="text-red-600 hover:text-red-700"
                >
                  {loading ? 'Deleting...' : 'Delete Project'}
                </Button>
              </div>
            </div>
          </div>

          {/* Webhook Activity */}
          <WebhookActivity projectId={project.id} projectName={project.name} />
        </div>
      </main>
    </div>
  );
};

export default ProjectDetail;
