'use client';
import { useState, useEffect } from 'react';
import { ArrowPathIcon, PhotoIcon } from '@heroicons/react/24/outline';

export default function ProductImage({ src, alt, width, height, style, isTooltip }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        setLoading(true);
        setError(false);
    }, [src]);

    if (!src) {
        return (
            <div style={{ width: width || 40, height: height || 40, borderRadius: style?.borderRadius || 4, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <PhotoIcon style={{ width: width && width < 30 ? 14 : 20, height: height && height < 30 ? 14 : 20 }} />
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: width || '100%', height: height || '100%', minWidth: width, minHeight: height, ...style, padding: 0, overflow: 'hidden' }}>
            {loading && !error && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: style?.borderRadius || 4 }}>
                    <div className="loading-spinner" style={{ width: width && width < 30 ? 12 : 16, height: height && height < 30 ? 12 : 16, borderWidth: 2 }} />
                </div>
            )}

            {error ? (
                <div
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: style?.borderRadius || 4, cursor: 'pointer' }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLoading(true);
                        setError(false);
                        setRetryKey(k => k + 1);
                    }}
                    title="Yüklenemedi. Tekrar denemek için tıklayın."
                >
                    <ArrowPathIcon style={{ width: width && width < 30 ? 14 : 20, height: height && height < 30 ? 14 : 20, color: 'var(--danger)', marginBottom: !isTooltip && height > 30 ? 4 : 0 }} />
                    {!isTooltip && height > 30 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Yenile</span>}
                </div>
            ) : (
                <img
                    key={retryKey}
                    src={src}
                    alt={alt}
                    style={{ width: '100%', height: '100%', objectFit: style?.objectFit || 'contain', opacity: loading ? 0 : 1, transition: 'opacity 0.2s', borderRadius: style?.borderRadius || 4 }}
                    onLoad={() => setLoading(false)}
                    onError={() => {
                        setLoading(false);
                        setError(true);
                    }}
                    loading="lazy"
                />
            )}
        </div>
    );
}
