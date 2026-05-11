'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BuildingOfficeIcon, MagnifyingGlassIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

export default function RepDashboard() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const supabase = createClient();

    const fetchAssignedCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/rep-companies');
            if (res.ok) {
                const data = await res.json();
                setCompanies(data || []);
            }
        } catch (e) {
            console.error('Fetch assigned companies error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAssignedCompanies(); }, [fetchAssignedCompanies]);

    const handleShowroom = async (companyId) => {
        try {
            const res = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId })
            });
            
            const data = await res.json();
            
            if (res.ok) {
                // Admin logic: clear local cache and redirect
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('b2b_cart');
                }
                // Redirect to our NEW rep showroom wrapper page
                window.location.href = `/rep/showroom/${companyId}`;
            } else {
                alert('Hata: ' + (data.error || 'Showroom moduna geçilemedi.'));
            }
        } catch (e) {
            alert('Bağlantı hatası: Showroom moduna geçilemedi.');
        }
    };

    const filtered = companies.filter(c => 
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.city?.toLowerCase().includes(search.toLowerCase()) ||
        c.dealer_code?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="page-wrapper" style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Sorumlu Olduğum Firmalar</h1>
                        <p className="page-subtitle">Yönettiğiniz bayilerin listesi ve showroom erişimi</p>
                    </div>
                </div>

                <div className="search-bar" style={{ marginBottom: 20 }}>
                    <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />
                    <input 
                        placeholder="Firma adı, şehir veya bayi kodu ile ara..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                </div>

                {loading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : filtered.length === 0 ? (
                    <div className="card">
                        <div className="empty-state" style={{ padding: 40 }}>
                            <BuildingOfficeIcon style={{ width: 48, height: 48 }} />
                            <p>Atanmış firma bulunamadı.</p>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Firma Adı</th>
                                        <th>Bayi Kodu</th>
                                        <th>Şehir</th>
                                        <th>Vergi No</th>
                                        <th style={{ textAlign: 'right' }}>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.dealer_code || '-'}</td>
                                            <td>{c.city || '-'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.tax_number}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button 
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleShowroom(c.id)}
                                                    style={{ 
                                                        background: 'var(--brand)', 
                                                        border: 'none', 
                                                        fontSize: 11, 
                                                        padding: '6px 12px',
                                                        borderRadius: 20
                                                    }}
                                                >
                                                    Showroom Girişi ›
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
