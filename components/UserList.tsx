'use client';

import { trpc } from '@/lib/trpc/Provider';
import { useState } from 'react';

export function UserList() {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.user.list.useQuery();
  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      setUsername('');
      setName('');
      setEmail('');
    },
  });
  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && name && email) {
      createUser.mutate({ username, name, email });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">User Management (tRPC)</h2>

      <form onSubmit={handleSubmit} className="mb-6 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={createUser.isPending}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {createUser.isPending ? 'Creating...' : 'Create User'}
        </button>
      </form>

      {isLoading ? (
        <p>Loading users...</p>
      ) : (
        <div className="space-y-2">
          {users?.map((user) => (
            <div
              key={user.id}
              className="flex justify-between items-center p-4 border rounded-lg"
            >
              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-600">@{user.username}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
              <button
                onClick={() => deleteUser.mutate({ id: user.id })}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          ))}
          {users?.length === 0 && (
            <p className="text-gray-500 text-center py-4">No users yet</p>
          )}
        </div>
      )}
    </div>
  );
}
