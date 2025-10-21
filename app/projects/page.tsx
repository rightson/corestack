'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/Provider';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectVisibility, setNewProjectVisibility] = useState<'private' | 'public'>('private');

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

  const { data: recentProjects, isLoading: recentLoading } =
    trpc.project.getRecent.useQuery(
      { token: token!, limit: 5 },
      { enabled: !!token }
    );

  const { data: myProjects, isLoading: myLoading } =
    trpc.project.getMyProjects.useQuery({ token: token! }, { enabled: !!token });

  const { data: allProjects, isLoading: allLoading } =
    trpc.project.getAllProjects.useQuery({ token: token! }, { enabled: !!token });

  const createProject = trpc.project.create.useMutation({
    onSuccess: () => {
      utils.project.getRecent.invalidate();
      utils.project.getMyProjects.invalidate();
      utils.project.getAllProjects.invalidate();
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
    },
  });

  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => {
      utils.project.getRecent.invalidate();
      utils.project.getMyProjects.invalidate();
      utils.project.getAllProjects.invalidate();
    },
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    await createProject.mutateAsync({
      token,
      name: newProjectName,
      description: newProjectDescription,
      visibility: newProjectVisibility,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (!token) {
    return null;
  }

  const ProjectCard = ({ project, showDelete = false }: any) => (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{project.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{project.description}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
              {project.status}
            </span>
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {project.visibility}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Created: {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        {showDelete && (
          <button
            onClick={() => deleteProject.mutate({ token, id: project.id })}
            className="ml-4 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Project
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Projects */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Recent Projects</h2>
            {recentLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-3">
                {recentProjects && recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No recent projects
                  </p>
                )}
              </div>
            )}
          </div>

          {/* My Projects */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">All My Projects</h2>
            {myLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {myProjects && myProjects.length > 0 ? (
                  myProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} showDelete />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No projects yet. Create one to get started!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* All Projects */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">All Projects</h2>
            {allLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {allProjects && allProjects.length > 0 ? (
                  allProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    No public projects available
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Visibility
                </label>
                <select
                  value={newProjectVisibility}
                  onChange={(e) => setNewProjectVisibility(e.target.value as 'private' | 'public')}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={createProject.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createProject.isPending ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
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
