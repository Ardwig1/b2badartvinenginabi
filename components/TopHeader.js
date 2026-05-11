'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function TopHeader() {
    const pathname = usePathname();
    const [rates, setRates] = useState({ USD: null, EUR: null });
    const [isShowroom, setIsShowroom] = useState(false);

    useEffect(() => {
        // Check if showroom via pathname or query param
        const checkShowroom = () => {
            if (pathname?.includes('/admin/showroom') || pathname?.includes('/rep/showroom')) return true;
            if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('showroom') === 'true' || window.location.pathname.includes('/admin/showroom');
            }
            return false;
        };
        setIsShowroom(checkShowroom());
    }, [pathname]);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const res = await fetch('/api/rates');
                const data = await res.json();
                if (data?.USD && data?.EUR) {
                    setRates({ USD: data.USD, EUR: data.EUR });
                }
            } catch (error) {
                console.error('Exchange rates failed to fetch:', error);
            }
        };

        fetchRates();
        // Refresh every 10 minutes (600,000 ms)
        const interval = setInterval(fetchRates, 600000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: isShowroom ? '6px 16px' : '12px 24px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-light)',
            gap: '16px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            minHeight: isShowroom ? '40px' : 'auto'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '500' }}>
                <span style={{ color: 'var(--text-secondary)' }}>TCMB Kurları:</span>
                <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    USD {rates.USD ? `₺${rates.USD}` : '...'}
                </span>
                <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    EUR {rates.EUR ? `₺${rates.EUR}` : '...'}
                </span>
            </div>
        </header>
    );
}
