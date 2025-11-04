import { Link } from 'react-router';

export default function DashboardHome() {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to CoreStack
        </h1>
        <p className="text-lg text-gray-600">
          Enterprise web platform with React Router 7, tRPC, and Fastify
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Link
          to="/dashboard/projects"
          className="group bg-white p-8 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-indigo-300 transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                Projects
              </h3>
              <p className="text-gray-600 mt-1">
                Manage your projects with advanced filtering and nested environments
              </p>
            </div>
          </div>
        </Link>

        <div className="group bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">
                Features
              </h3>
              <p className="text-gray-600 mt-1">
                Type-safe APIs, real-time updates, and background job processing
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stack Overview</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">React Router 7</div>
              <div className="text-sm text-gray-600 mt-1">Modern routing with URL state</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">tRPC + Fastify</div>
              <div className="text-sm text-gray-600 mt-1">Type-safe API layer</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">Vite</div>
              <div className="text-sm text-gray-600 mt-1">Lightning-fast development</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
