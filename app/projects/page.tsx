'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/Provider';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectVersion, setProjectVersion] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');

  const router = useRouter();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      router.push('/login');
    } else {
      setToken(authToken);
    }
  }, [router]);

  const utils = trpc.useUtils();

  const { data: myProjects, isLoading: myLoading } =
    trpc.project.getMyProjects.useQuery({ token: token! }, { enabled: !!token });

  const { data: allProjects, isLoading: allLoading } =
    trpc.project.getAllProjects.useQuery({ token: token! }, { enabled: !!token });

  const { data: searchResults, isLoading: searchLoading } =
    trpc.project.searchProjects.useQuery(
      { token: token!, query: searchQuery },
      { enabled: !!token && searchQuery.length > 0 }
    );

  const createProject = trpc.project.create.useMutation({
    onSuccess: () => {
      utils.project.getMyProjects.invalidate();
      utils.project.getAllProjects.invalidate();
      setShowCreateModal(false);
      setProjectVersion('');
      setProjectCode('');
      setProjectName('');
      setDescription('');
    },
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.getMyProjects.invalidate();
      utils.project.getAllProjects.invalidate();
    },
  });

  const requestPermission = trpc.project.requestPermission.useMutation({
    onSuccess: () => {
      utils.project.getAllProjects.invalidate();
      utils.project.searchProjects.invalidate();
    },
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    await createProject.mutateAsync({
      token,
      projectVersion,
      projectCode,
      name: projectName || undefined,
      description: description || undefined,
      visibility,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleRequestPermission = async (projectId: number) => {
    if (!token) return;
    try {
      await requestPermission.mutateAsync({ token, projectId });
    } catch (error: any) {
      alert(error.message || 'Failed to request permission');
    }
  };

  if (!token) {
    return null;
  }

  const ProjectCard = ({ project, showDelete = false, showPermission = false }: any) => (
    <div className="group bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-indigo-300 transition-all duration-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-gray-900">{project.name || 'Untitled Project'}</h3>
                {!project.hasPermission && showPermission && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">
                    No Access
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-medium">
                  v{project.projectVersion}
                </span>
                <span className="text-xs px-2 py-1 bg-cyan-50 text-cyan-700 rounded font-medium">
                  {project.projectCode}
                </span>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                  {project.visibility}
                </span>
              </div>
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{project.description}</p>
          )}
          <p className="text-xs text-gray-500 mt-3">
            Created: {new Date(project.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="ml-4 flex gap-2">
          {showDelete && (
            <button
              onClick={() => deleteProject.mutate({ token, id: project.id })}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              Delete
            </button>
          )}
          {showPermission && !project.hasPermission && (
            project.permissionRequested ? (
              <span className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg">
                Requested
              </span>
            ) : (
              <button
                onClick={() => handleRequestPermission(project.id)}
                disabled={requestPermission.isPending}
                className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                Request Access
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );

  const displayProjects = searchQuery ? searchResults : allProjects;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                Project Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">Manage and explore your projects</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-md transition-all duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* My Projects Column */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">My Projects</h2>
                  <p className="text-sm text-gray-500">Sorted by recent access</p>
                </div>
              </div>
              {myLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
                  {myProjects && myProjects.length > 0 ? (
                    myProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} showDelete />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">No projects yet</p>
                      <p className="text-sm text-gray-400 mt-1">Create your first project to get started</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Explore All Projects Column */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Explore Projects</h2>
                  <p className="text-sm text-gray-500">Search and discover all available projects</p>
                </div>
              </div>

              {/* Search Box */}
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                    placeholder="Search by version, code, or name..."
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className="mt-2 text-xs text-gray-500">
                    {searchLoading ? 'Searching...' : `Found ${searchResults?.length || 0} results`}
                  </p>
                )}
              </div>

              {allLoading || searchLoading ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-8 w-8 text-cyan-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto pr-2">
                  {displayProjects && displayProjects.length > 0 ? (
                    displayProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} showPermission />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">
                        {searchQuery ? 'No projects found' : 'No public projects available'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery ? 'Try adjusting your search' : 'Check back later for new projects'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
              <p className="text-sm text-gray-600 mt-1">Fill in the project details below</p>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Project Version <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectVersion}
                    onChange={(e) => setProjectVersion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 1.0.0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Project Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., PROJ-001"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Project Name <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe your project..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Visibility
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`py-2 px-4 rounded-lg font-medium transition-all ${
                      visibility === 'private'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`py-2 px-4 rounded-lg font-medium transition-all ${
                      visibility === 'public'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Public
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={createProject.isPending}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 transition-all"
                >
                  {createProject.isPending ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
