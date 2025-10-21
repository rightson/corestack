'use client';

import { useState } from 'react';

export function TaskQueueDemo() {
  const [jobName, setJobName] = useState('');
  const [jobData, setJobData] = useState('');
  const [queueName, setQueueName] = useState('default');
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddJob = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/queue/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queueName,
          jobName,
          data: jobData ? JSON.parse(jobData) : {},
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Task Queue Demo</h2>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Queue Name</label>
          <select
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="default">Default</option>
            <option value="email">Email</option>
            <option value="processing">Processing</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Job Name</label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., process-data"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Job Data (JSON)
          </label>
          <textarea
            value={jobData}
            onChange={(e) => setJobData(e.target.value)}
            placeholder='{"key": "value"}'
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        <button
          onClick={handleAddJob}
          disabled={isLoading || !jobName}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Adding Job...' : 'Add Job to Queue'}
        </button>
      </div>

      {result && (
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Result</h3>
          <pre className="text-sm overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
