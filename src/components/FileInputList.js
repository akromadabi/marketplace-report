import React from 'react';
import { FileSpreadsheet, X } from 'lucide-react';

function FileInputList({ label, files, onRemove, iconSrcGetter, fileCategoryMap, fileRowCountMap }) {
    if (files.length === 0) return null;

    return (
        <div>
            {label && (
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label}
                </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {files.map((file, idx) => {
                    const key = file.name + file.size;
                    const category = fileCategoryMap?.[key] || 'detecting...';
                    const rowCount = fileRowCountMap?.[key];
                    const iconSrc = iconSrcGetter ? iconSrcGetter(file, category) : null;

                    const categoryColors = {
                        orders: { bg: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa', border: 'rgba(124, 58, 237, 0.2)' },
                        payments: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.2)' },
                        return: { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: 'rgba(245, 158, 11, 0.2)' },
                        pengembalian: { bg: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: 'rgba(236, 72, 153, 0.2)' },
                        unknown: { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.2)' },
                    };
                    const cc = categoryColors[category] || categoryColors.unknown;

                    return (
                        <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.625rem 0.75rem',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            {iconSrc ? (
                                <img src={iconSrc} alt="" style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', borderRadius: '4px' }} loading="lazy" />
                            ) : (
                                <FileSpreadsheet size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {file.name}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <span className="badge" style={{
                                        background: cc.bg,
                                        color: cc.color,
                                        border: `1px solid ${cc.border}`,
                                        fontSize: '0.625rem',
                                        padding: '0.125rem 0.5rem',
                                    }}>
                                        {category}
                                    </span>
                                    {rowCount !== undefined && (
                                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                                            {rowCount.toLocaleString('id-ID')} baris
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => onRemove(idx)}
                                type="button"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '1.75rem',
                                    height: '1.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-tertiary)',
                                    transition: 'all var(--transition-fast)',
                                    flexShrink: 0,
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.color = '#f87171';
                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.color = 'var(--text-tertiary)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                                aria-label={`Hapus file ${file.name}`}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default FileInputList;