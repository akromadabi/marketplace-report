import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import { DataProvider } from './contexts/DataContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import LoginPage from './components/LoginPage';
import AdminSidebar from './components/admin/AdminSidebar';
import AdminMobileNav from './components/admin/AdminMobileNav';

// ─── Lazy-loaded page components (code-split per page) ───────────
const Dashboard = lazy(() => import('./components/Dashboard'));
const UploadFile = lazy(() => import('./components/UploadFile'));
const InputModal = lazy(() => import('./components/InputModal'));
const ReturnTable = lazy(() => import('./components/ReturnTable'));
const PengembalianTable = lazy(() => import('./components/PengembalianTable'));
const ProductAnalysis = lazy(() => import('./components/ProductAnalysis'));
const RangkumanTransaksi = lazy(() => import('./components/RangkumanTransaksi'));
const OlahanDataPesanan = lazy(() => import('./components/OlahanDataPesanan'));
const StoreManagement = lazy(() => import('./components/StoreManagement'));
const AsetTable = lazy(() => import('./components/AsetTable'));
const OperasionalTable = lazy(() => import('./components/OperasionalTable'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const KampanyeMain = lazy(() => import('./components/KampanyeMain'));
// Admin pages
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminUserManagement = lazy(() => import('./components/admin/AdminUserManagement'));
const AdminRoleManagement = lazy(() => import('./components/admin/AdminRoleManagement'));
const AdminSettings = lazy(() => import('./components/admin/AdminSettings'));

// ─── Loading fallback ────────────────────────────────────────────
function PageLoader() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '40vh', color: 'var(--text-tertiary)',
        }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{
                    width: '2rem', height: '2rem', border: '3px solid var(--border-medium)',
                    borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem',
                }} />
                <span style={{ fontSize: '0.875rem' }}>Memuat halaman...</span>
            </div>
        </div>
    );
}

// ─── Window width hook ───────────────────────────────────────────
function useWindowWidth() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        let timeout;
        const handleResize = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => setWidth(window.innerWidth), 100);
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout); };
    }, []);
    return width;
}

// ─── Protected Route for User ────────────────────────────────────
function ProtectedRoute({ children, requiredPermission }) {
    const { isAuthenticated, hasPermission, isAdmin } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (requiredPermission && !hasPermission(requiredPermission)) return <Navigate to="/upload" replace />;
    return children;
}

// ─── Protected Route for Admin ───────────────────────────────────
function AdminRoute({ children }) {
    const { isAuthenticated, isAdmin } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin) return <Navigate to="/upload" replace />;
    return children;
}

// ─── User Layout (Sidebar + Content) ─────────────────────────────
function UserLayout() {
    const location = useLocation();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 768;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <StoreProvider>
            <DataProvider>
                <NotificationProvider>
                    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
                        <Sidebar
                            currentPath={location.pathname}
                            isOpen={sidebarOpen}
                            onToggle={setSidebarOpen}
                        />
                        <MobileNav currentPath={location.pathname} />
                        <main
                            style={{
                                flex: 1,
                                minWidth: 0,
                                marginLeft: isDesktop ? (sidebarOpen ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)') : '0',
                                transition: 'margin-left var(--transition-normal)',
                                minHeight: '100vh',
                                padding: isDesktop ? '1.5rem' : '0.75rem',
                                paddingTop: isDesktop ? '1.5rem' : '4.25rem',
                                paddingBottom: isDesktop ? '1.5rem' : '5rem',
                                overflowX: 'hidden',
                            }}
                        >
                            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                                        <Route path="/upload" element={<ProtectedRoute><UploadFile /></ProtectedRoute>} />
                                        <Route path="/input-modal" element={<ProtectedRoute requiredPermission="/input-modal"><InputModal /></ProtectedRoute>} />
                                        <Route path="/kampanye" element={<ProtectedRoute><KampanyeMain /></ProtectedRoute>} />
                                        <Route path="/return" element={<ProtectedRoute requiredPermission="/return"><ReturnTable /></ProtectedRoute>} />
                                        <Route path="/pengembalian" element={<ProtectedRoute requiredPermission="/pengembalian"><PengembalianTable /></ProtectedRoute>} />
                                        <Route path="/analisis" element={<ProtectedRoute requiredPermission="/analisis"><ProductAnalysis /></ProtectedRoute>} />
                                        <Route path="/rangkuman" element={<ProtectedRoute requiredPermission="/rangkuman"><RangkumanTransaksi /></ProtectedRoute>} />
                                        <Route path="/olahan" element={<ProtectedRoute requiredPermission="/olahan"><OlahanDataPesanan /></ProtectedRoute>} />
                                        <Route path="/stores" element={<ProtectedRoute requiredPermission="/stores"><StoreManagement /></ProtectedRoute>} />
                                        <Route path="/aset" element={<ProtectedRoute><AsetTable /></ProtectedRoute>} />
                                        <Route path="/operasional" element={<ProtectedRoute><OperasionalTable /></ProtectedRoute>} />
                                        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                                        <Route path="*" element={<Navigate to="/upload" replace />} />
                                    </Routes>
                                </Suspense>
                            </div>
                        </main>
                    </div>
                </NotificationProvider>
            </DataProvider>
        </StoreProvider>
    );
}

// ─── Admin Layout (Admin Sidebar + Content) ──────────────────────
function AdminLayout() {
    const location = useLocation();
    const windowWidth = useWindowWidth();
    const isDesktop = windowWidth >= 768;
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <AdminSidebar
                currentPath={location.pathname}
                isOpen={sidebarOpen}
                onToggle={setSidebarOpen}
            />
            <AdminMobileNav currentPath={location.pathname} />
            <main
                style={{
                    flex: 1,
                    minWidth: 0,
                    marginLeft: isDesktop ? (sidebarOpen ? 'var(--sidebar-width-expanded)' : 'var(--sidebar-width-collapsed)') : '0',
                    transition: 'margin-left var(--transition-normal)',
                    minHeight: '100vh',
                    padding: isDesktop ? '1.5rem' : '0.75rem',
                    paddingTop: isDesktop ? '1.5rem' : '4.25rem',
                    paddingBottom: isDesktop ? '1.5rem' : '1.5rem',
                    overflowX: 'hidden',
                }}
            >
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                            <Route path="/users" element={<AdminRoute><AdminUserManagement /></AdminRoute>} />
                            <Route path="/roles" element={<AdminRoute><AdminRoleManagement /></AdminRoute>} />
                            <Route path="/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
                            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                        </Routes>
                    </Suspense>
                </div>
            </main>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPageWrapper />} />
                    <Route path="/admin/*" element={<AuthGuard><AdminLayout /></AuthGuard>} />
                    <Route path="/*" element={<AuthGuard><UserLayout /></AuthGuard>} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

function LoginPageWrapper() {
    const { isAuthenticated, isAdmin } = useAuth();
    if (isAuthenticated) {
        return <Navigate to={isAdmin ? '/admin/dashboard' : '/upload'} replace />;
    }
    return <LoginPage />;
}

function AuthGuard({ children }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
}

export default App;