
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ConnectionProvider } from './contexts/ConnectionContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Tags } from './pages/Tags';
import { Vehicles } from './pages/Vehicles';
import { LiveMap } from './pages/LiveMap';
import { Settings } from './pages/Settings';
import { Security } from './pages/Security';
import { Users } from './pages/Users';

const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <NotificationProvider>
      <ConnectionProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemeProvider>
              <HashRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  
                  <Route path="/" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/tags" element={
                    <ProtectedRoute>
                      <Tags />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/vehicles" element={
                    <ProtectedRoute>
                      <Vehicles />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="/map" element={
                    <ProtectedRoute>
                      <LiveMap />
                    </ProtectedRoute>
                  } />

                  <Route path="/security" element={
                    <ProtectedRoute>
                      <Security />
                    </ProtectedRoute>
                  } />

                  <Route path="/users" element={
                    <ProtectedRoute>
                      <Users />
                    </ProtectedRoute>
                  } />

                  <Route path="/settings" element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  } />

                </Routes>
              </HashRouter>
            </ThemeProvider>
          </AuthProvider>
        </LanguageProvider>
      </ConnectionProvider>
    </NotificationProvider>
  );
}

export default App;
