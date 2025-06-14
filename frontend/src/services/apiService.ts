const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Project {
  id: string;
  name: string;
  githubRepo: string;
  githubBranch: string;
  webhookSecret?: string;
  webhookConnected?: boolean;
  createdAt: string;
  updatedAt: string;
  deployments?: Deployment[];
  _count?: {
    deployments: number;
  };
}

export interface Deployment {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  commitHash: string;
  commitMsg?: string;
  triggeredBy?: string;
  deployedAt?: string;
  createdAt: string;
  project?: {
    name: string;
    githubRepo?: string;
  };
}

export interface CreateProjectData {
  name: string;
  githubRepo: string;
  githubBranch?: string;
}

export interface CreateDeploymentData {
  projectId: string;
  commitHash: string;
  commitMsg?: string;
}

export interface WebhookEvent {
  id: string;
  event: string;
  summary: string;
  actor: string;
  details: Record<string, any>;
  receivedAt: string;
  rawPayload?: any;
}

export interface WebhookStats {
  totalEvents: number;
  recentEvents: number;
  lastEvent?: {
    event: string;
    receivedAt: string;
  };
  eventCounts: Record<string, number>;
  webhookConnected: boolean;
}

class ApiService {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: this.getAuthHeader(),
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  }

  // Project endpoints
  async getProjects(): Promise<{ projects: Project[] }> {
    return this.makeRequest<{ projects: Project[] }>('/api/v1/projects');
  }

  async getProject(id: string): Promise<{ project: Project }> {
    return this.makeRequest<{ project: Project }>(`/api/v1/projects/${id}`);
  }
  async createProject(data: CreateProjectData): Promise<{ message: string; project: Project; webhookUrl: string; webhookSecret: string }> {
    return this.makeRequest<{ message: string; project: Project; webhookUrl: string; webhookSecret: string }>('/api/v1/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: Partial<CreateProjectData>): Promise<{ message: string; project: Project }> {
    return this.makeRequest<{ message: string; project: Project }>(`/api/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deleteProject(id: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/api/v1/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Check webhook connection status for a project
  async checkWebhookStatus(projectId: string): Promise<{ webhookConnected: boolean }> {
    const response = await this.getProject(projectId);
    return { webhookConnected: response.project.webhookConnected || false };
  }

  // Deployment endpoints
  async getDeployments(): Promise<{ deployments: Deployment[] }> {
    return this.makeRequest<{ deployments: Deployment[] }>('/api/v1/deployments');
  }

  async getProjectDeployments(projectId: string): Promise<{ deployments: Deployment[] }> {
    return this.makeRequest<{ deployments: Deployment[] }>(`/api/v1/projects/${projectId}/deployments`);
  }

  async createDeployment(data: CreateDeploymentData): Promise<{ message: string; deployment: Deployment }> {
    return this.makeRequest<{ message: string; deployment: Deployment }>('/api/v1/deployments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateDeploymentStatus(id: string, status: Deployment['status']): Promise<{ message: string; deployment: Deployment }> {
    return this.makeRequest<{ message: string; deployment: Deployment }>(`/api/v1/deployments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // Webhook endpoints
  async getWebhookEvents(projectId: string, options?: { limit?: number; event?: string }): Promise<{ events: WebhookEvent[] }> {
    const queryParams = new URLSearchParams();
    if (options?.limit) queryParams.append('limit', options.limit.toString());
    if (options?.event) queryParams.append('event', options.event);
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.makeRequest<{ events: WebhookEvent[] }>(`/api/v1/webhook/events/${projectId}${query}`);
  }
  async getWebhookStats(projectId: string): Promise<{ stats: WebhookStats }> {
    return this.makeRequest<{ stats: WebhookStats }>(`/api/v1/webhook/stats/${projectId}`);
  }

  // Webhook management endpoints
  async regenerateWebhookSecret(projectId: string): Promise<{ message: string; webhookSecret: string; webhookUrl: string }> {
    return this.makeRequest<{ message: string; webhookSecret: string; webhookUrl: string }>(`/api/v1/projects/${projectId}/regenerate-webhook-secret`, {
      method: 'POST',
    });
  }

  async triggerManualDeployment(projectId: string): Promise<{ message: string; deployment: Deployment }> {
    return this.makeRequest<{ message: string; deployment: Deployment }>(`/api/v1/projects/${projectId}/deploy`, {
      method: 'POST',
    });
  }

  async testWebhook(projectId: string, eventType: string = 'ping'): Promise<{ message: string; success: boolean }> {
    return this.makeRequest<{ message: string; success: boolean }>(`/api/v1/webhook/test/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ eventType }),
    });
  }
}

export const apiService = new ApiService();
