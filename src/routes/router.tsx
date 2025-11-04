import { createBrowserRouter } from 'react-router';

// Layouts
import RootLayout from './layout';
import DashboardLayout from './dashboard/layout';

// Pages
import Home from './index';
import LoginPage from './login';
import DashboardHome from './dashboard/index';
import ProjectsPage from './dashboard/projects';
import ProjectDetailPage from './dashboard/projects/$projectId/index';
import EnvironmentDetailPage from './dashboard/projects/$projectId/envs/$envId/index';
import EnvironmentMetricsPage from './dashboard/projects/$projectId/envs/$envId/metrics';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardHome />,
          },
          {
            path: 'projects',
            element: <ProjectsPage />,
          },
          {
            path: 'projects/:projectId',
            element: <ProjectDetailPage />,
          },
          {
            path: 'projects/:projectId/envs/:envId',
            element: <EnvironmentDetailPage />,
          },
          {
            path: 'projects/:projectId/envs/:envId/metrics',
            element: <EnvironmentMetricsPage />,
          },
          {
            path: 'projects/:projectId/envs/:envId/logs',
            element: <div className="p-8">Logs page (not implemented in demo)</div>,
          },
          {
            path: 'projects/:projectId/envs/:envId/deployments',
            element: <div className="p-8">Deployments page (not implemented in demo)</div>,
          },
        ],
      },
    ],
  },
]);
