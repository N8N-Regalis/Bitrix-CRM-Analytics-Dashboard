import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RequireAuth } from '@/router/RequireAuth';

const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Deals = lazy(() => import('@/pages/Deals'));
const Associates = lazy(() => import('@/pages/Associates'));
const Clients = lazy(() => import('@/pages/Clients'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const StageMovement = lazy(() => import('@/pages/StageMovement'));
const PresentedDeals = lazy(() => import('@/pages/PresentedDeals'));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Declared before the guarded tree so the catch-all below cannot swallow it. */}
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="deals" element={<Deals />} />
            <Route path="associates" element={<Associates />} />
            <Route path="clients" element={<Clients />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="stage-movement" element={<StageMovement />} />
            <Route path="presented-deals" element={<PresentedDeals />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
