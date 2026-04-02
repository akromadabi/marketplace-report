import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

const NotificationContext = createContext();

export function useNotification() {
    return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const idRef = useRef(0);

    const addNotification = useCallback(({ type = 'info', message, persistent = false, duration = 5000 }) => {
        const id = ++idRef.current;
        setNotifications(prev => [...prev, { id, type, message, persistent, visible: true }]);
        if (!persistent) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, duration);
        }
        return id;
    }, []);

    const updateNotification = useCallback((id, updates) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        if (updates.persistent === false || updates.type === 'success' || updates.type === 'error') {
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== id));
            }, updates.duration || 6000);
        }
    }, []);

    const removeNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <NotificationContext.Provider value={{ addNotification, updateNotification, removeNotification }}>
            {children}
            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
        </NotificationContext.Provider>
    );
}

function NotificationContainer({ notifications, onRemove }) {
    if (notifications.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            maxWidth: '400px',
            width: 'calc(100vw - 2rem)',
        }}>
            {notifications.map(n => (
                <NotificationToast key={n.id} notification={n} onRemove={() => onRemove(n.id)} />
            ))}
        </div>
    );
}

function NotificationToast({ notification, onRemove }) {
    const { type, message } = notification;
    const [show, setShow] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setShow(true));
    }, []);

    const config = {
        loading: {
            bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.95), rgba(99, 45, 200, 0.95))',
            border: 'rgba(124, 58, 237, 0.4)',
            icon: <Loader2 size={18} color="white" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />,
        },
        success: {
            bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))',
            border: 'rgba(16, 185, 129, 0.4)',
            icon: <CheckCircle2 size={18} color="white" style={{ flexShrink: 0 }} />,
        },
        error: {
            bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))',
            border: 'rgba(239, 68, 68, 0.4)',
            icon: <AlertCircle size={18} color="white" style={{ flexShrink: 0 }} />,
        },
        info: {
            bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
            border: 'rgba(59, 130, 246, 0.4)',
            icon: null,
        },
    };

    const c = config[type] || config.info;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.75rem 1rem',
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '0.75rem',
            color: 'white',
            fontSize: '0.8125rem',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(12px)',
            transform: show ? 'translateX(0)' : 'translateX(120%)',
            opacity: show ? 1 : 0,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
            {c.icon}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
            {!notification.persistent && (
                <button
                    onClick={onRemove}
                    style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        borderRadius: '0.375rem',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '1.5rem',
                        height: '1.5rem',
                        flexShrink: 0,
                        padding: 0,
                    }}
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}

export default NotificationProvider;
