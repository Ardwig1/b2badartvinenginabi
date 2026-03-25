'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AdminCurrencyHeader() {
    const pathname = usePathname();
    const [rates, setRates] = useState({ USD: null, EUR: null });

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch('/api/rates');
                const data = await res.json();
                if (data.USD && data.EUR) {
                    setRates({ USD: data.USD, EUR: data.EUR });
                }
            } catch (e) {
                console.error('Rates fetch error:', e);
            }
        };
        fetchRates();
        const interval = setInterval(fetchRates, 1000 * 60 * 15); // Update every 15 mins
        return () => clearInterval(interval);
    }, []);

    if (pathname?.includes('/admin/showroom')) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 900,
            display: 'flex',
            gap: 12,
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '6px 16px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#16a34a' }}>USD</span>
                <span style={{ color: 'var(--text-primary)' }}>{rates.USD ? `₺${rates.USD.toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
            </div>
            <div style={{ width: 1, height: 16, background: 'var(--border-light)', alignSelf: 'center' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#2563eb' }}>EUR</span>
                <span style={{ color: 'var(--text-primary)' }}>{rates.EUR ? `₺${rates.EUR.toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
            </div>
        </div>
    );
}
