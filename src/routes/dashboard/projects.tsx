import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { trpc } from '../../lib/trpc';
import { useUrlState, useShareableUrl } from '../../lib/url-state';

const filterSchema = z.object({
  search: z.string().default(''),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  visibility: z.enum(['private', 'public', 'all']).default('all'),
  sortBy: z.enum(['name', 'created', 'updated']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export default function ProjectsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectVersion, setProjectVersion] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');

  // URL state management for filters
  const [filters, setFilters, clearFilters] = useUrlState(filterSchema);
  const shareableUrl = useShareableUrl();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      setToken(authToken);
    }
  }, []);

  const utils = trpc.useUtils();

  const { data: myProjects, isLoading: myLoading } =
    trpc.project.getMyProjects.useQuery({ token: token! }, { enabled: !!token });

  const { data: allProjects, isLoading: allLoading } =
    trpc.project.getAllProjects.useQuery({ token: token! }, { enabled: !!token });

  const { data: searchResults, isLoading: searchLoading } =
    trpc.project.searchProjects.useQuery(
      { token: token!, query: filters.search },
      { enabled: !!token && filters.search.length > 0 }
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

  const handleRequestPermission = async (projectId: number) => {
    if (!token) return;
    try {
      await requestPermission.mutateAsync({ token, projectId });
    } catch (error: any) {
      alert(error.message || 'Failed to request permission');
    }
  };

  const handleShareFilters = () => {
    navigator.clipboard.writeText(shareableUrl);
    alert('Filter URL copied to clipboard!');
  };

  if (!token) {
    return null;
  }

  const ProjectCard = ({ project, showDelete = false, showPermission = false }: any) => (
    <Link
      to={`/dashboard/projects/${project.id}`}
      className="group bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-indigo-300 transition-all duration-200 block"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {project.name || 'Untitled Project'}
                </h3>
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
            Created: {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="ml-4 flex gap-2" onClick={(e) => e.preventDefault()}>
          {showDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteProject.mutate({ token, id: project.id });
              }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleRequestPermission(project.id);
                }}
                disabled={requestPermission.isPending}
                className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              >
                Request Access
              </button>
            )
          )}
        </div>
      </div>
    </Link>
  );

  const displayProjects = filters.search ? searchResults : allProjects;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <div className="flex gap-2">
            <button
              onClick={handleShareFilters}
              className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Share Filters
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as any })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={filters.visibility}
            onChange={(e) => setFilters({ visibility: e.target.value as any })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Visibility</option>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-');
              setFilters({ sortBy: sortBy as any, sortOrder: sortOrder as any });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
            <option value="updated-desc">Recently Updated</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Projects */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">My Projects</h2>
                <p className="text-sm text-gray-500">Your owned projects</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-md transition-all text-sm font-medium"
            >
              New Project
            </button>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {myLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : myProjects && myProjects.length > 0 ? (
              myProjects.map((project) => (
                <ProjectCard key={project.id} project={project} showDelete />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>No projects yet</p>
              </div>
            )}
          </div>
        </div>

        {/* All Projects */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Explore Projects</h2>
              <p className="text-sm text-gray-500">
                {filters.search ? `${displayProjects?.length || 0} results` : 'All available projects'}
              </p>
            </div>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {allLoading || searchLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
              </div>
            ) : displayProjects && displayProjects.length > 0 ? (
              displayProjects.map((project) => (
                <ProjectCard key={project.id} project={project} showPermission />
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p>{filters.search ? 'No projects found' : 'No projects available'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Version <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectVersion}
                    onChange={(e) => setProjectVersion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1.0.0"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="PROJ-001"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVisibility('private')}
                    className={`py-2 rounded-lg font-medium ${visibility === 'private' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility('public')}
                    className={`py-2 rounded-lg font-medium ${visibility === 'public' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Public
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createProject.isPending}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  {createProject.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg"
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
