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
import { useProcessedOrders } from './hooks/useProcessedOrders';

// ─── Lazy-loaded page components (code-split per page + background preloaded) ───
const pageLoaders = [
    () => import('./components/Dashboard'),
    () => import('./components/UploadFile'),
    () => import('./components/InputModal'),
    () => import('./components/ReturnTable'),
    () => import('./components/PengembalianTable'),
    () => import('./components/ProductAnalysis'),
    () => import('./components/RangkumanTransaksi'),
    () => import('./components/OlahanDataPesanan'),
    () => import('./components/StoreManagement'),
    () => import('./components/AsetTable'),
    () => import('./components/OperasionalTable'),
    () => import('./components/UserProfile'),
    () => import('./components/KampanyeMain'),
    () => import('./components/PricingCalculator'),
];

const Dashboard = lazy(pageLoaders[0]);
const UploadFile = lazy(pageLoaders[1]);
const InputModal = lazy(pageLoaders[2]);
const ReturnTable = lazy(pageLoaders[3]);
const PengembalianTable = lazy(pageLoaders[4]);
const ProductAnalysis = lazy(pageLoaders[5]);
const RangkumanTransaksi = lazy(pageLoaders[6]);
const OlahanDataPesanan = lazy(pageLoaders[7]);
const StoreManagement = lazy(pageLoaders[8]);
const AsetTable = lazy(pageLoaders[9]);
const OperasionalTable = lazy(pageLoaders[10]);
const UserProfile = lazy(pageLoaders[11]);
const KampanyeMain = lazy(pageLoaders[12]);
const PricingCalculator = lazy(pageLoaders[13]);

// Background prewarmer: warms IndexedDB snapshot into RAM & preloads all route JS chunks
function BackgroundDataPrewarmer() {
    useProcessedOrders();
    useEffect(() => {
        const timer = setTimeout(() => {
            const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
            schedule(() => {
                pageLoaders.forEach(load => { try { load(); } catch { /* ignore */ } });
            });
        }, 250);
        return () => clearTimeout(timer);
    }, []);
    return null;
}

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
    const { isAuthenticated, hasPermission, isAdmin, permissionsLoading } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;

    if (permissionsLoading) {
        // Jangan render apapun atau kick user saat masih mengecek akses dari server
        return null;
    }

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
                    <BackgroundDataPrewarmer />
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
                                padding: isDesktop ? '0.65rem 1rem' : '0.5rem',
                                paddingTop: isDesktop ? '0.65rem' : '3.65rem',
                                paddingBottom: isDesktop ? '0.65rem' : '4.5rem',
                                overflowX: 'hidden',
                            }}
                        >
                            <div style={{ maxWidth: '100%', margin: '0 auto' }}>
                                <Suspense fallback={<PageLoader />}>
                                    <Routes>
                                        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                                        <Route path="/upload" element={<ProtectedRoute><UploadFile /></ProtectedRoute>} />
                                        <Route path="/input-modal" element={<ProtectedRoute requiredPermission="/input-modal"><InputModal /></ProtectedRoute>} />
                                        <Route path="/kampanye" element={<ProtectedRoute requiredPermission="/kampanye"><KampanyeMain /></ProtectedRoute>} />
                                        <Route path="/kalkulator" element={<ProtectedRoute requiredPermission="/kalkulator"><PricingCalculator /></ProtectedRoute>} />
                                        <Route path="/return" element={<ProtectedRoute requiredPermission="/return"><ReturnTable /></ProtectedRoute>} />
                                        <Route path="/pengembalian" element={<ProtectedRoute requiredPermission="/pengembalian"><PengembalianTable /></ProtectedRoute>} />
                                        <Route path="/analisis" element={<ProtectedRoute requiredPermission="/analisis"><ProductAnalysis /></ProtectedRoute>} />

                                        <Route path="/rangkuman" element={<ProtectedRoute requiredPermission="/rangkuman"><RangkumanTransaksi /></ProtectedRoute>} />
                                        <Route path="/olahan" element={<ProtectedRoute requiredPermission="/olahan"><OlahanDataPesanan /></ProtectedRoute>} />
                                        <Route path="/stores" element={<ProtectedRoute requiredPermission="/stores"><StoreManagement /></ProtectedRoute>} />
                                        <Route path="/aset" element={<ProtectedRoute requiredPermission="/aset"><AsetTable /></ProtectedRoute>} />
                                        <Route path="/operasional" element={<ProtectedRoute requiredPermission="/operasional"><OperasionalTable /></ProtectedRoute>} />
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
                    padding: isDesktop ? '0.65rem 1rem' : '0.75rem',
                    paddingTop: isDesktop ? '0.65rem' : '4.25rem',
                    paddingBottom: isDesktop ? '0.65rem' : '1.5rem',
                    overflowX: 'hidden',
                }}
            >
                <div style={{ maxWidth: '100%', margin: '0 auto' }}>
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