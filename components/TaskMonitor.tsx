/**
 * TaskMonitor Component
 *
 * React component for monitoring and managing Temporal workflows
 */

'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

interface TaskMonitorProps {
  projectId?: string;
}

export function TaskMonitor({ projectId }: TaskMonitorProps) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Start build mutation
  const startBuild = trpc.temporal.startBuild.useMutation({
    onSuccess: (result) => {
      setWorkflowId(result.workflowId);
      setIsStarting(false);
    },
    onError: (error) => {
      console.error('Failed to start build:', error);
      setIsStarting(false);
    },
  });

  // Get workflow status query (polls every 2 seconds when workflow is active)
  const { data: status, isLoading } = trpc.temporal.getWorkflowStatus.useQuery(
    { workflowId: workflowId! },
    {
      enabled: !!workflowId,
      refetchInterval: (data) => {
        // Stop polling if workflow is completed, failed, or cancelled
        if (
          data?.status === 'COMPLETED' ||
          data?.status === 'FAILED' ||
          data?.status === 'CANCELLED'
        ) {
          return false;
        }
        return 2000; // Poll every 2 seconds
      },
    }
  );

  // Cancel workflow mutation
  const cancelWorkflow = trpc.temporal.cancelWorkflow.useMutation({
    onSuccess: () => {
      console.log('Workflow cancelled successfully');
    },
  });

  const handleStartBuild = () => {
    if (!projectId) {
      alert('Project ID is required');
      return;
    }

    setIsStarting(true);
    startBuild.mutate({
      projectId,
      branch: 'main',
      config: {
        skipTests: false,
        skipLint: false,
        environment: 'development',
      },
    });
  };

  const handleCancel = () => {
    if (workflowId && confirm('Are you sure you want to cancel this workflow?')) {
      cancelWorkflow.mutate({ workflowId });
    }
  };

  const handleReset = () => {
    setWorkflowId(null);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return 'text-blue-600';
      case 'COMPLETED':
        return 'text-green-600';
      case 'FAILED':
        return 'text-red-600';
      case 'CANCELLED':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBgColor = (status?: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-50 border-blue-200';
      case 'COMPLETED':
        return 'bg-green-50 border-green-200';
      case 'FAILED':
        return 'bg-red-50 border-red-200';
      case 'CANCELLED':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Temporal Task Monitor</h2>

      {!workflowId ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Project ID
            </label>
            <input
              type="text"
              value={projectId || ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
              placeholder="Enter project ID"
            />
          </div>

          <button
            onClick={handleStartBuild}
            disabled={isStarting || !projectId}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isStarting ? 'Starting Build...' : 'Start Build'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Workflow Info */}
          <div className={`border rounded-lg p-6 ${getStatusBgColor(status?.status)}`}>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Workflow ID:</span>
                <p className="font-mono text-sm break-all">{workflowId}</p>
              </div>

              <div>
                <span className="text-sm text-gray-600">Status:</span>
                <p className={`text-lg font-bold ${getStatusColor(status?.status)}`}>
                  {isLoading ? 'Loading...' : status?.status || 'Unknown'}
                </p>
              </div>

              {status?.startTime && (
                <div>
                  <span className="text-sm text-gray-600">Started:</span>
                  <p className="text-sm">
                    {new Date(status.startTime).toLocaleString()}
                  </p>
                </div>
              )}

              {status?.executionTime !== undefined && (
                <div>
                  <span className="text-sm text-gray-600">Duration:</span>
                  <p className="text-sm">
                    {Math.floor(status.executionTime / 1000)}s
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {status?.progress !== undefined && status.status === 'RUNNING' && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{status.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {status?.currentStep && (
                <div>
                  <span className="text-sm text-gray-600">Current Step:</span>
                  <p className="text-sm font-medium">{status.currentStep}</p>
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          {status?.logs && status.logs.length > 0 && (
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <h3 className="font-bold mb-3">Logs</h3>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-xs max-h-64 overflow-y-auto">
                {status.logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {status?.status === 'RUNNING' && (
              <button
                onClick={handleCancel}
                disabled={cancelWorkflow.isPending}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
              >
                {cancelWorkflow.isPending ? 'Cancelling...' : 'Cancel Workflow'}
              </button>
            )}

            {(status?.status === 'COMPLETED' ||
              status?.status === 'FAILED' ||
              status?.status === 'CANCELLED') && (
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Start New Build
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * WorkflowList Component
 *
 * List all workflows with filtering
 */
export function WorkflowList() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [limit, setLimit] = useState(20);

  const { data, isLoading, refetch } = trpc.temporal.listWorkflows.useQuery({
    status: statusFilter as 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TERMINATED' | 'TIMED_OUT' | undefined,
    limit,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Workflows</h2>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || undefined)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">All</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Limit</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
            min="1"
            max="100"
            className="px-4 py-2 border border-gray-300 rounded-md w-24"
          />
        </div>
      </div>

      {/* Workflow List */}
      {isLoading ? (
        <div className="text-center py-8">Loading workflows...</div>
      ) : data?.workflows.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No workflows found</div>
      ) : (
        <div className="space-y-3">
          {data?.workflows.map((workflow) => (
            <div
              key={workflow.workflowId}
              className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(workflow.status)}`}
                    >
                      {workflow.status}
                    </span>
                    <span className="text-sm text-gray-600">{workflow.type}</span>
                  </div>
                  <p className="font-mono text-sm text-gray-700 mb-1">
                    {workflow.workflowId}
                  </p>
                  <p className="text-xs text-gray-500">
                    Started: {workflow.startTime ? new Date(workflow.startTime).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
