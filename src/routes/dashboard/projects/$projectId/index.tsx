import { Link, useParams } from 'react-router';

export default function ProjectDetailPage() {
  const { projectId } = useParams();

  // Mock environment data - in real app, fetch from tRPC
  const environments = [
    { id: 'dev', name: 'Development', status: 'healthy', deployments: 142 },
    { id: 'staging', name: 'Staging', status: 'healthy', deployments: 98 },
    { id: 'prod', name: 'Production', status: 'healthy', deployments: 75 },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="flex mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1">
          <li>
            <Link to="/dashboard/projects" className="text-gray-500 hover:text-gray-700">
              Projects
            </Link>
          </li>
          <li className="flex items-center">
            <svg className="w-4 h-4 text-gray-400 mx-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-700 font-medium">Project #{projectId}</span>
          </li>
        </ol>
      </nav>

      {/* Project Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Project #{projectId}
            </h1>
            <p className="text-gray-600">
              Manage environments and configurations for this project
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Environments Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Environments</h2>
            <p className="text-sm text-gray-500">Click to view environment details and metrics</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {environments.map((env) => (
            <Link
              key={env.id}
              to={`/dashboard/projects/${projectId}/envs/${env.id}`}
              className="group bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-indigo-300 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {env.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{env.id}</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  {env.status}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Deployments</span>
                  <span className="font-semibold text-gray-900">{env.deployments}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium group-hover:underline">
                View Details
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Total Environments</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{environments.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Active Deployments</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {environments.reduce((sum, env) => sum + env.deployments, 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Health Status</div>
          <div className="text-2xl font-bold text-green-600 mt-1">All Healthy</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Last Updated</div>
          <div className="text-sm font-medium text-gray-900 mt-2">2 minutes ago</div>
        </div>
      </div>
    </div>
  );
}
