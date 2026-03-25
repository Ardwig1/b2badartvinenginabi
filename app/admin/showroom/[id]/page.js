'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function AdminShowroom() {
    const { id } = useParams();
    const router = useRouter();
    const [companyName, setCompanyName] = useState('Yükleniyor...');

    useEffect(() => {
        const fetchCompany = async () => {
            const res = await fetch(`/api/admin/companies?id=${id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.company) {
                    setCompanyName(data.company.name);
                }
            }
        };
        fetchCompany();
    }, [id]);

    const exitShowroom = async () => {
        try {
            const res = await fetch('/api/admin/impersonate', { method: 'DELETE' });
            if (res.ok) {
                router.push('/admin/companies');
            }
        } catch (e) {
            console.error('Exit showroom error:', e);
            router.push('/admin/companies');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', overflow: 'hidden', padding: '0px' }}>
            <div style={{ 
                padding: '12px 24px', 
                background: 'var(--bg-card)', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 20,
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--primary)', 
                        padding: '6px 16px', 
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                        Görüntülenen Firma: {companyName}
                    </div>
                </div>

                <button 
                    onClick={exitShowroom}
                    className="btn btn-primary"
                    style={{ fontSize: 13, gap: 8, padding: '8px 20px' }}
                >
                    <ArrowLeftIcon style={{ width: 16, height: 16 }} />
                    Showroom Modundan Çık
                </button>
            </div>

            <div style={{ 
                flex: 1, 
                position: 'relative', 
                background: 'var(--bg-primary)',
                overflow: 'hidden'
            }}>
                <iframe 
                    src="/dashboard/catalog" 
                    style={{ 
                        width: '117.6%', 
                        height: '117.6%',
                        border: 'none',
                        transform: 'scale(0.85)',
                        transformOrigin: 'top left'
                    }} 
                    title="User Dashboard Showroom"
                />
            </div>
        </div>
    );
}
