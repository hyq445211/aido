import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/Login.jsx';
import RegisterPage from './pages/Register.jsx';
import ChatPage from './pages/Chat.jsx';

/** 未登录访问受保护页面时跳转登录，并记录来源地址 */
function RequireAuth({ children }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="fullscreen-loading">
        <div className="spinner" />
        <p>正在加载…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const { user, bootstrapping } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user && !bootstrapping ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={user && !bootstrapping ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
