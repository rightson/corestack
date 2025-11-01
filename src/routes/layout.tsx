import { Outlet } from 'react-router';

export default function RootLayout() {
  return (
    <div className="antialiased">
      <Outlet />
    </div>
  );
}
