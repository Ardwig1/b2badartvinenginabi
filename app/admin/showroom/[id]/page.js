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
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', margin: '-24px -24px 0 -24px', overflow: 'hidden' }}>
            <div style={{ 
                padding: '8px 24px', 
                background: 'var(--bg-card)', 
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        color: 'var(--primary)', 
                        padding: '4px 12px', 
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600
                    }}>
                        Görüntülenen Firma: {companyName}
                    </div>
                </div>

                <button 
                    onClick={exitShowroom}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, gap: 6, color: 'var(--danger)', padding: '4px 12px' }}
                >
                    <ArrowLeftIcon style={{ width: 14, height: 14 }} />
                    Admin Paneline Dön
                </button>
            </div>

            <div style={{ flex: 1, position: 'relative', background: 'var(--bg-card)' }}>
                <iframe 
                    src="/dashboard/catalog" 
                    style={{ 
                        width: '100%', 
                        height: '100%',
                        border: 'none'
                    }} 
                    title="User Dashboard Showroom"
                />
            </div>
        </div>
    );
}
