import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { useAuthStore } from './stores/auth';
import LoadingScreen from './components/ui/LoadingScreen';

// 懒加载页面
const LoginPage = lazy(() => import('./pages/Login'));
const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const ChatPage = lazy(() => import('./pages/Chat'));
const ProjectsPage = lazy(() => import('./pages/Projects'));
const TasksPage = lazy(() => import('./pages/Tasks'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// 路由守卫
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 受保护路由 */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat/:sessionId?" element={<ChatPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
