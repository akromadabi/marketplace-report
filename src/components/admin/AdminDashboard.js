import React, { useState, useEffect } from 'react';
import { useAuth, CLASS_CONFIG } from '../../contexts/AuthContext';
import { Users, UserCheck, UserX, Crown } from 'lucide-react';

function AdminDashboard() {
    const { getUsers } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const data = await getUsers();
                setUsers(data.filter(u => u.role !== 'admin'));
            } catch (e) { /* ignore */ }
            setLoading(false);
        })();
    }, [getUsers]);

    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const inactiveUsers = users.filter(u => u.status === 'inactive').length;
    const classCounts = {
        platinum: users.filter(u => u.class === 'platinum').length,
        gold: users.filter(u => u.class === 'gold').length,
        silver: users.filter(u => u.class === 'silver').length,
    };

    const stats = [
        { label: 'Total User', value: totalUsers, icon: Users, color: '#6c5ce7', bg: 'rgba(108,92,231,0.1)' },
        { label: 'User Aktif', value: activeUsers, icon: UserCheck, color: '#00b894', bg: 'rgba(0,184,148,0.1)' },
        { label: 'User Nonaktif', value: inactiveUsers, icon: UserX, color: '#e17055', bg: 'rgba(225,112,85,0.1)' },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-tertiary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{
                        width: '2rem', height: '2rem', border: '3px solid var(--border-medium)',
                        borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite', margin: '0 auto 0.75rem',
                    }} />
                    <span style={{ fontSize: '0.875rem' }}>Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Admin Dashboard
                </h1>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                    Overview sistem dan manajemen pengguna
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map((s, i) => (
                    <div key={i} style={{
                        background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                        backdropFilter: 'blur(12px)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {s.label}
                            </span>
                            <div style={{
                                width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-md)',
                                background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <s.icon size={18} color={s.color} />
                            </div>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {s.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Class Distribution */}
            <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', backdropFilter: 'blur(12px)',
            }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Crown size={18} color="#f39c12" /> Distribusi Kelas User
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                    {Object.entries(CLASS_CONFIG).map(([key, cfg]) => (
                        <div key={key} style={{
                            background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`,
                            borderRadius: 'var(--radius-lg)', padding: '1.25rem', textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{cfg.icon}</div>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: cfg.color, marginBottom: '0.25rem' }}>
                                {cfg.label}
                            </div>
                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {classCounts[key]}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                pengguna
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Users */}
            <div style={{
                background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '1.5rem', backdropFilter: 'blur(12px)',
                marginTop: '1.5rem',
            }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                    User Terbaru
                </h2>
                {users.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
                        Belum ada user terdaftar.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Nama', 'Username', 'Kelas', 'Toko', 'Status'].map(h => (
                                        <th key={h} style={{
                                            textAlign: 'left', padding: '0.625rem 0.75rem', fontSize: '0.6875rem',
                                            fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase',
                                            letterSpacing: '0.05em', borderBottom: '1px solid var(--border-subtle)',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.slice(0, 5).map(u => {
                                    const cls = CLASS_CONFIG[u.class] || CLASS_CONFIG.silver;
                                    return (
                                        <tr key={u.id}>
                                            <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</td>
                                            <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{u.username}</td>
                                            <td style={{ padding: '0.625rem 0.75rem' }}>
                                                <span className="badge" style={{
                                                    background: cls.bgColor, color: cls.color,
                                                    border: `1px solid ${cls.borderColor}`, fontSize: '0.625rem',
                                                    padding: '0.125rem 0.5rem',
                                                }}>{cls.icon} {cls.label}</span>
                                            </td>
                                            <td style={{ padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{u.store_name || '-'}</td>
                                            <td style={{ padding: '0.625rem 0.75rem' }}>
                                                <span className="badge" style={{
                                                    background: u.status === 'active' ? 'rgba(0,184,148,0.1)' : 'rgba(225,112,85,0.1)',
                                                    color: u.status === 'active' ? '#00b894' : '#e17055',
                                                    border: `1px solid ${u.status === 'active' ? 'rgba(0,184,148,0.2)' : 'rgba(225,112,85,0.2)'}`,
                                                    fontSize: '0.625rem', padding: '0.125rem 0.5rem',
                                                }}>{u.status === 'active' ? '● Aktif' : '○ Nonaktif'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;
