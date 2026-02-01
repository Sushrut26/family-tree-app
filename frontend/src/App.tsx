import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TreeDashboard } from './pages/TreeDashboard';
import { AdminPanel } from './pages/AdminPanel';
import { FamilyPasswordModal } from './components/FamilyPasswordModal';
import { ToastContainer } from './components/ToastContainer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TreeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tree"
          element={
            <ProtectedRoute>
              <TreeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global modals and components */}
      <FamilyPasswordModal />
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
