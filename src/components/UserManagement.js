import React, { useState } from 'react';
import { useAuth, ROLE_CONFIG } from '../contexts/AuthContext';

function UserManagement() {
    const { users, addUser, updateUser, deleteUser, user: currentUser } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'silver' });
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const openAdd = () => {
        setEditingUser(null);
        setFormData({ username: '', password: '', name: '', role: 'silver' });
        setError('');
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setFormData({ username: u.username, password: '', name: u.name, role: u.role });
        setError('');
        setShowModal(true);
    };

    const handleSave = () => {
        if (!formData.username.trim() || !formData.name.trim()) {
            setError('Username dan nama harus diisi');
            return;
        }
        if (!editingUser && !formData.password.trim()) {
            setError('Password harus diisi untuk user baru');
            return;
        }
        // Check unique username
        const duplicate = users.find(
            (u) => u.username.toLowerCase() === formData.username.trim().toLowerCase() &&
                (!editingUser || u.id !== editingUser.id)
        );
        if (duplicate) {
            setError('Username sudah digunakan');
            return;
        }

        if (editingUser) {
            const updateData = {
                username: formData.username.trim(),
                name: formData.name.trim(),
                role: formData.role,
            };
            if (formData.password.trim()) {
                updateData.password = formData.password.trim();
            }
            updateUser(editingUser.id, updateData);
        } else {
            addUser({
                username: formData.username.trim(),
                password: formData.password.trim(),
                name: formData.name.trim(),
                role: formData.role,
            });
        }
        setShowModal(false);
    };

    const handleDelete = (id) => {
        deleteUser(id);
        setDeleteConfirm(null);
    };

    return (
        <div style={{ animation: 'fadeInUp 0.5s ease-out' }}>
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 className="gradient-text">Manajemen User</h2>
                    <p>Kelola pengguna dan hak akses sistem</p>
                </div>
                <button className="btn-primary" onClick={openAdd}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <line x1="19" y1="8" x2="19" y2="14" />
                        <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    Tambah User
                </button>
            </div>

            {/* Role legend cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                    const count = users.filter((u) => u.role === key).length;
                    return (
                        <div key={key} className="stat-card" style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '2.5rem', height: '2.5rem', borderRadius: 'var(--radius-md)',
                                    background: cfg.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.25rem', border: `1px solid ${cfg.borderColor}`,
                                }}>
                                    {cfg.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                                        {cfg.label}
                                    </div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: cfg.color }}>
                                        {count}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Users Table */}
            <div className="modern-table-wrapper" style={{ overflowX: 'auto' }}>
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th style={{ textAlign: 'center' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => {
                            const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.silver;
                            const isSelf = currentUser && currentUser.id === u.id;
                            return (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{
                                                width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-full)',
                                                background: cfg.gradient, display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: '#fff',
                                                flexShrink: 0,
                                            }}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.name}</div>
                                                {isSelf && (
                                                    <span style={{ fontSize: '0.6875rem', color: 'var(--accent-secondary)' }}>(Anda)</span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{u.username}</td>
                                    <td>
                                        <span className="badge" style={{
                                            background: cfg.bgColor,
                                            color: cfg.color,
                                            border: `1px solid ${cfg.borderColor}`,
                                        }}>
                                            {cfg.icon} {cfg.label}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                            <button
                                                className="btn-secondary"
                                                style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                                                onClick={() => openEdit(u)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                Edit
                                            </button>
                                            {!isSelf && u.role !== 'admin' && (
                                                <button
                                                    className="btn-secondary"
                                                    style={{
                                                        padding: '0.375rem 0.75rem', fontSize: '0.75rem',
                                                        borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171',
                                                    }}
                                                    onClick={() => setDeleteConfirm(u.id)}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                    Hapus
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
                >
                    <div className="glass-card" style={{ maxWidth: '28rem', width: '90%', padding: '2rem', background: 'var(--bg-secondary)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                            {editingUser ? 'Edit User' : 'Tambah User Baru'}
                        </h3>

                        {error && (
                            <div className="login-error" style={{ marginBottom: '1rem' }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Nama Lengkap</label>
                                <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nama lengkap" />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Username</label>
                                <input className="form-input" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Username" />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                                    Password {editingUser && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(kosongkan jika tidak diubah)</span>}
                                </label>
                                <input className="form-input" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={editingUser ? '••••••••' : 'Password'} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>Role</label>
                                <select className="custom-select" style={{ width: '100%' }} value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                                        <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                            <button className="btn-primary" onClick={handleSave}>
                                {editingUser ? 'Simpan' : 'Tambah'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
                    onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
                >
                    <div className="glass-card" style={{ maxWidth: '24rem', width: '90%', padding: '2rem', background: 'var(--bg-secondary)', textAlign: 'center' }}>
                        <div style={{
                            width: '3.5rem', height: '3.5rem', borderRadius: 'var(--radius-full)', margin: '0 auto 1rem',
                            background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Hapus User?</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                            <button className="btn-primary" style={{ background: 'var(--gradient-danger)' }} onClick={() => handleDelete(deleteConfirm)}>Hapus</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
