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
const KnowledgePage = lazy(() => import('./pages/Knowledge'));
const KnowledgeDetailPage = lazy(() => import('./pages/KnowledgeDetail'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetail'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const RolesPage = lazy(() => import('./pages/admin/Roles'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
const SentinelPage = lazy(() => import('./pages/Sentinel'));

// 路由守卫 — 同时检查 isAuthenticated 和 accessToken
// 防止 JWT 过期后 persist 中 isAuthenticated 仍为 true 但 token 已失效的情况
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 管理员路由守卫
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.roles?.includes('admin');
  if (!isAdmin) return <Navigate to="/chat" replace />;
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
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="knowledge/:id" element={<KnowledgeDetailPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
            <Route path="admin/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
            <Route path="audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
            <Route path="sentinel" element={<AdminRoute><SentinelPage /></AdminRoute>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
