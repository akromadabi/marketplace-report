import React from 'react';
import { FileSpreadsheet, X, CheckCircle2, Loader2, Clock } from 'lucide-react';

function FileInputList({ label, files, onRemove, iconSrcGetter, fileCategoryMap, fileRowCountMap, uploadProgress, uploading }) {
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

                    // Progress info for this file
                    const progress = uploadProgress?.[idx];
                    const isDone = progress?.done === true;
                    const isActive = progress && progress.pct > 0 && !isDone;
                    const isWaiting = uploading && progress && progress.pct === 0 && !isDone;
                    const pct = progress?.pct ?? 0;

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
                            padding: '0.625rem 0.75rem',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${isDone ? 'rgba(16,185,129,0.25)' : isActive ? 'rgba(124,58,237,0.25)' : 'var(--border-subtle)'}`,
                            transition: 'border-color 0.3s ease',
                            overflow: 'hidden',
                        }}>
                            {/* File row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {iconSrc ? (
                                    <img src={iconSrc} alt="" style={{ width: '1.5rem', height: '1.5rem', objectFit: 'contain', borderRadius: '4px' }} loading="lazy" />
                                ) : (
                                    <FileSpreadsheet size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        color: isDone ? '#10b981' : 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.3s ease',
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
                                {/* Status / remove button */}
                                {uploading && progress ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                                        {isDone
                                            ? <CheckCircle2 size={14} color="#10b981" />
                                            : isActive
                                                ? <Loader2 size={14} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                                                : <Clock size={14} color="var(--text-tertiary)" />
                                        }
                                        <span style={{
                                            fontSize: '0.6875rem', fontWeight: 700, minWidth: '2.5rem', textAlign: 'right',
                                            color: isDone ? '#10b981' : isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                                        }}>
                                            {pct}%
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => onRemove(idx)}
                                        type="button"
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '1.75rem', height: '1.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-tertiary)',
                                            transition: 'all var(--transition-fast)', flexShrink: 0,
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                                        aria-label={`Hapus file ${file.name}`}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Inline progress bar — hanya saat upload */}
                            {uploading && progress !== undefined && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ height: '3px', borderRadius: '999px', background: 'var(--border-subtle)', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${pct}%`, borderRadius: '999px',
                                            background: isDone
                                                ? 'linear-gradient(90deg,#10b981,#34d399)'
                                                : isActive
                                                    ? 'linear-gradient(90deg,var(--accent-primary),#a78bfa)'
                                                    : 'var(--border-medium)',
                                            transition: 'width 0.35s ease',
                                        }} />
                                    </div>
                                    <p style={{ fontSize: '0.5625rem', color: isDone ? '#10b981' : isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                                        {isDone ? 'Selesai ✓' : isActive ? `Mengupload... ${pct}%` : 'Menunggu giliran...'}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default FileInputList;