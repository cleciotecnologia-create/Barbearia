import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const LandingPage = lazy(() => import("./pages/Landing"));
const BookingPage = lazy(() => import("./pages/Agenda"));
const Dashboard = lazy(() => import("./pages/Admin"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
import { useAuth } from "./lib/auth-context";
import ChatBot from "./components/ChatBot";

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
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
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
      </Suspense>
      <ChatBot />
    </BrowserRouter>
  );
}
