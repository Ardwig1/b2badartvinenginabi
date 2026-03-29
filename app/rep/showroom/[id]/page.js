'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function RepShowroom() {
    const { id } = useParams();
    const router = useRouter();
    const [companyName, setCompanyName] = useState('Yükleniyor...');

    useEffect(() => {
        const fetchCompany = async () => {
            if (!id) return;
            try {
                // Use cache-busting to ensure we get the latest name
                const res = await fetch(`/api/admin/create-company?id=${id}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.company) {
                        setCompanyName(data.company.name);
                    }
                }
            } catch (err) {
                console.error('Fetch company name failed:', err);
                setCompanyName('Firma Bilgisi Alınamadı');
            }
        };
        fetchCompany();
    }, [id]);

    const exitShowroom = async () => {
        try {
            const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
            if (res.ok) {
                router.push('/rep');
            }
        } catch (e) {
            console.error('Exit showroom error:', e);
            router.push('/rep');
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            height: '100vh', 
            width: '100%',
            background: 'var(--bg-canvas)', 
            padding: '16px', // Restore floating spacing
            overflow: 'hidden'
        }}>
            {/* The Floating Window Container */}
            <div style={{ 
                flex: 1,
                display: 'flex', 
                flexDirection: 'column',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)', 
                borderRadius: '16px', // Restore rounded corners
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
            }}>
                {/* Window Header */}
                <div style={{ 
                    padding: '10px 24px', 
                    background: 'var(--bg-card)', 
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 20
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                            background: 'rgba(37, 99, 235, 0.1)', 
                            color: 'var(--primary)', 
                            padding: '6px 16px', 
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            border: '1px solid rgba(37, 99, 235, 0.2)'
                        }}>
                            Görüntülenen Firma: {companyName}
                        </div>
                    </div>

                    <button 
                        onClick={exitShowroom}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 13, gap: 8, padding: '8px 24px' }}
                    >
                        <ArrowLeftIcon style={{ width: 16, height: 16 }} />
                        Showroom Modundan Çık
                    </button>
                </div>

                {/* Window Content / Iframe Area */}
                <div style={{ 
                    flex: 1, 
                    position: 'relative', 
                    background: 'var(--bg-primary)',
                    overflow: 'hidden'
                }}>
                    <iframe 
                        src="/dashboard?showroom=true" 
                        style={{ 
                            width: '100%', 
                            height: '100%',
                            border: 'none',
                        }} 
                        title="Representative Showroom"
                    />
                </div>
            </div>
        </div>
    );
}
