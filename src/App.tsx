import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/Landing";
import BookingPage from "./pages/Agenda";
import Dashboard from "./pages/Admin";
import SuperAdmin from "./pages/SuperAdmin";
import { useAuth } from "./lib/auth-context";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/" />;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return null;
  return isSuperAdmin ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agenda/:slug" element={<BookingPage />} />
        
        {/* Owner Dashboard */}
        <Route path="/admin/:slug" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />

        {/* Global Admin */}
        <Route path="/super-admin" element={
          <SuperAdminRoute>
            <SuperAdmin />
          </SuperAdminRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
