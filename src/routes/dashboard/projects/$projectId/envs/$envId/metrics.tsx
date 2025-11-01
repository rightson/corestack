import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { useUrlState, useShareableUrl } from '../../../../../../lib/url-state';

const metricsFilterSchema = z.object({
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
  metric: z.enum(['cpu', 'memory', 'network', 'requests']).default('cpu'),
  refresh: z.enum(['off', '10s', '30s', '1m']).default('off'),
});

export default function EnvironmentMetricsPage() {
  const { projectId, envId } = useParams();
  const [filters, setFilters] = useUrlState(metricsFilterSchema);
  const shareableUrl = useShareableUrl();

  const handleShare = () => {
    navigator.clipboard.writeText(shareableUrl);
    alert('Metrics URL with filters copied to clipboard!');
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1">
          <li>
            <Link to="/dashboard/projects" className="text-gray-500 hover:text-gray-700 text-sm">
              Projects
            </Link>
          </li>
          <li className="flex items-center">
            <svg className="w-4 h-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <Link to={`/dashboard/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              Project #{projectId}
            </Link>
          </li>
          <li className="flex items-center">
            <svg className="w-4 h-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <Link to={`/dashboard/projects/${projectId}/envs/${envId}`} className="text-gray-500 hover:text-gray-700 text-sm">
              {envId}
            </Link>
          </li>
          <li className="flex items-center">
            <svg className="w-4 h-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-700 font-medium text-sm">Metrics</span>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Metrics Dashboard
            </h1>
            <p className="text-gray-600">
              Real-time monitoring for {envId} environment
            </p>
          </div>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
          >
            Share View
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4 px-6">
            <Link
              to={`/dashboard/projects/${projectId}/envs/${envId}`}
              className="py-4 px-1 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium text-sm"
            >
              Overview
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/envs/${envId}/metrics`}
              className="py-4 px-1 border-b-2 border-indigo-600 text-indigo-600 font-medium text-sm"
            >
              Metrics
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/envs/${envId}/logs`}
              className="py-4 px-1 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium text-sm"
            >
              Logs
            </Link>
            <Link
              to={`/dashboard/projects/${projectId}/envs/${envId}/deployments`}
              className="py-4 px-1 border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 font-medium text-sm"
            >
              Deployments
            </Link>
          </nav>
        </div>
      </div>

      {/* Filters - URL State Management Demo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters (Stored in URL)</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
            <select
              value={filters.timeRange}
              onChange={(e) => setFilters({ timeRange: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Metric Type</label>
            <select
              value={filters.metric}
              onChange={(e) => setFilters({ metric: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="cpu">CPU Usage</option>
              <option value="memory">Memory Usage</option>
              <option value="network">Network I/O</option>
              <option value="requests">Request Rate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Auto Refresh</label>
            <select
              value={filters.refresh}
              onChange={(e) => setFilters({ refresh: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="off">Off</option>
              <option value="10s">Every 10s</option>
              <option value="30s">Every 30s</option>
              <option value="1m">Every 1m</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleShare}
              className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition-all font-medium"
            >
              Share This View
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Charts Placeholder */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {filters.metric.toUpperCase()} - {filters.timeRange}
          </h3>
          <div className="h-64 flex items-center justify-center bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg">
            <div className="text-center">
              <svg className="w-12 h-12 text-indigo-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-gray-600">Chart would render here</p>
              <p className="text-xs text-gray-500 mt-1">
                Showing {filters.metric} for {filters.timeRange}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Stats</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Current Value</span>
              <span className="text-2xl font-bold text-blue-600">45.2%</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Average</span>
              <span className="text-2xl font-bold text-green-600">38.7%</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Peak</span>
              <span className="text-2xl font-bold text-orange-600">67.3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* URL State Demo */}
      <div className="mt-6 bg-cyan-50 border-l-4 border-cyan-500 p-4 rounded-r-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-cyan-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-cyan-900">URL State Management Demo</h3>
            <p className="text-sm text-cyan-700 mt-1">
              All filters are stored in the URL query parameters. Try changing filters and sharing the URL with a colleague!
            </p>
            <div className="mt-2 p-2 bg-white rounded border border-cyan-200">
              <code className="text-xs text-gray-700 break-all">{window.location.href}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
