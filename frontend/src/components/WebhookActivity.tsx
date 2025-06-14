import React, { useState, useEffect } from 'react';
import { apiService, type WebhookEvent, type WebhookStats } from '../services/apiService';
import Button from './ui/Button';
import Alert from './ui/Alert';

interface WebhookActivityProps {
  projectId: string;
  projectName: string;
}

const WebhookActivity: React.FC<WebhookActivityProps> = ({ projectId, projectName }) => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);  const [searchTerm, setSearchTerm] = useState('');
  const [showEventDetails, setShowEventDetails] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadWebhookStats = async () => {
    try {
      const response = await apiService.getWebhookStats(projectId);
      setStats(response.stats);
    } catch (error) {
      console.error('Failed to load webhook stats:', error);
      setAlert({
        type: 'error',
        message: 'Failed to load webhook statistics'
      });
    }
  };

  const loadWebhookEvents = async (eventType?: string) => {
    try {
      setEventsLoading(true);
      const options = eventType && eventType !== 'all' ? { event: eventType, limit: 20 } : { limit: 20 };
      const response = await apiService.getWebhookEvents(projectId, options);
      setEvents(response.events);
    } catch (error) {
      console.error('Failed to load webhook events:', error);
      setAlert({
        type: 'error',
        message: 'Failed to load webhook events'
      });
    } finally {
      setEventsLoading(false);
    }
  };
  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadWebhookStats(),
      loadWebhookEvents(selectedEventType)
    ]);
    setLoading(false);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadWebhookStats(),
      loadWebhookEvents(selectedEventType)
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    loadWebhookEvents(selectedEventType);
  }, [selectedEventType]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedEventType]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'push':
        return (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
          </div>
        );
      case 'pull_request':
        return (
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        );
      case 'release':
        return (
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
        );
      case 'issues':
        return (
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.18 14.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        );
      case 'ping':
        return (
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const eventTypes = stats ? Object.keys(stats.eventCounts) : [];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Webhook Activity - {projectName}</h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              Auto-refresh
            </label>            <Button 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      {alert && (
        <div className="px-6 py-4 border-b border-gray-200">
          <Alert
            type={alert.type}
            message={alert.message}
            onClose={() => setAlert(null)}
          />
        </div>
      )}

      {stats && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
              <div className="text-sm text-gray-500">Total Events</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.recentEvents}</div>
              <div className="text-sm text-gray-500">Last 24h</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${stats.webhookConnected ? 'text-green-600' : 'text-red-600'}`}>
                {stats.webhookConnected ? 'Connected' : 'Disconnected'}
              </div>
              <div className="text-sm text-gray-500">Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.lastEvent ? formatRelativeTime(stats.lastEvent.receivedAt) : 'Never'}
              </div>
              <div className="text-sm text-gray-500">Last Event</div>
            </div>
          </div>          <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Filter by event:</label>
              <select
                value={selectedEventType}
                onChange={(e) => setSelectedEventType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Events</option>
                {eventTypes.map(type => (
                  <option key={type} value={type}>
                    {type} ({stats.eventCounts[type]})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Search:</label>
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm w-48"
              />
            </div>
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        {eventsLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-500">No webhook events found</p>
            <p className="text-sm text-gray-400">Webhook events will appear here when GitHub sends them</p>
          </div>
        ) : (          <div className="space-y-4">
            {events
              .filter(event => 
                !searchTerm || 
                event.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                event.event.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg hover:bg-gray-50">
                <div 
                  className="flex items-start space-x-3 p-3 cursor-pointer"
                  onClick={() => setShowEventDetails(showEventDetails === event.id ? null : event.id)}
                >
                  {getEventIcon(event.event)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{event.summary}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{formatRelativeTime(event.receivedAt)}</span>
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${showEventDetails === event.id ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">by {event.actor}</p>
                    {Object.keys(event.details).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        {Object.entries(event.details).slice(0, 2).map(([key, value]) => (
                          value && (
                            <span key={key} className="mr-3">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {showEventDetails === event.id && (
                  <div className="px-6 pb-4 border-t border-gray-100">
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Event Details</h4>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div><span className="font-medium">Event Type:</span> {event.event}</div>
                          <div><span className="font-medium">Received:</span> {new Date(event.receivedAt).toLocaleString()}</div>
                          {Object.entries(event.details).map(([key, value]) => (
                            value && (
                              <div key={key}>
                                <span className="font-medium">{key}:</span> {String(value)}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                      
                      {event.rawPayload && (
                        <div className="mt-3">
                          <h5 className="text-xs font-medium text-gray-600 mb-1">Raw Payload (truncated)</h5>
                          <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(event.rawPayload, null, 2).substring(0, 500)}
                            {JSON.stringify(event.rawPayload, null, 2).length > 500 && '...'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {events.filter(event => 
              !searchTerm || 
              event.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
              event.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
              event.event.toLowerCase().includes(searchTerm.toLowerCase())
            ).length === 0 && searchTerm && (
              <div className="text-center py-8">
                <p className="text-gray-500">No events match your search</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WebhookActivity;
