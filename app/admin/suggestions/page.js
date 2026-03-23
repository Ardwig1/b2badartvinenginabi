'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EnvelopeIcon, ChatBubbleBottomCenterTextIcon, CalendarIcon, BuildingOfficeIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function AdminSuggestions() {
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const supabase = createClient();

    useEffect(() => {
        async function fetchSuggestions() {
            setLoading(true);
            try {
                const res = await fetch('/api/admin/suggestions');
                const data = await res.json();

                if (!res.ok) {
                    console.error('Fetch error:', data.error);
                } else {
                    setSuggestions(data || []);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            }
            setLoading(false);
        }
        fetchSuggestions();
    }, []);

    const handleDelete = (id) => {
        setDeleteId(id);
        setIsDeleting(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch('/api/admin/suggestions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deleteId })
            });

            if (res.ok) {
                setSuggestions(prev => prev.filter(s => s.id !== deleteId));
                setIsDeleting(false);
                setDeleteId(null);
            } else {
                const data = await res.json();
                alert('Silme hatası: ' + data.error);
            }
        } catch (err) {
            alert('Beklenmedik bir hata oluştu.');
        }
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Kullanıcı Önerileri</h1>
                    <p className="page-subtitle">Bayilerinizden gelen geri bildirimler, öneriler ve şikayetler</p>
                </div>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : suggestions.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            <ChatBubbleBottomCenterTextIcon style={{ width: 48, height: 48 }} />
                        </div>
                        <div>Henüz bir öneri veya şikayet bulunmuyor.</div>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '200px' }}>Firma</th>
                                <th>Konu / Mesaj</th>
                                <th style={{ width: '180px' }}>Tarih</th>
                                <th style={{ width: '80px', textAlign: 'right' }}>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suggestions.map((s) => (
                                <tr key={s.id}>
                                    <td style={{ verticalAlign: 'top', paddingTop: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                            <BuildingOfficeIcon style={{ width: 14, height: 14, color: 'var(--primary)' }} />
                                            {Array.isArray(s.companies) ? s.companies[0]?.name : s.companies?.name || 'Hesap Bilgisi Yok'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-main)', fontSize: 14 }}>
                                            {s.subject}
                                        </div>
                                        <div style={{ 
                                            color: 'var(--text-secondary)', 
                                            fontSize: 13, 
                                            lineHeight: 1.6,
                                            background: 'var(--bg-surface)',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            borderLeft: '4px solid var(--primary-light)'
                                        }}>
                                            {s.message}
                                        </div>
                                    </td>
                                    <td style={{ verticalAlign: 'top', paddingTop: 16, color: 'var(--text-muted)', fontSize: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CalendarIcon style={{ width: 14, height: 14 }} />
                                            {new Date(s.created_at).toLocaleString('tr-TR', { 
                                                day: '2-digit', month: '2-digit', year: 'numeric', 
                                                hour: '2-digit', minute: '2-digit' 
                                            })}
                                        </div>
                                    </td>
                                    <td style={{ verticalAlign: 'top', paddingTop: 12, textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleDelete(s.id)}
                                            style={{
                                                padding: '8px',
                                                borderRadius: '8px',
                                                color: 'var(--error, #f44336)',
                                                background: 'rgba(244, 67, 54, 0.1)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.2)'}
                                            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'}
                                            title="Sil"
                                        >
                                            <TrashIcon style={{ width: 18, height: 18 }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Custom Delete Confirmation Modal */}
            {isDeleting && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{
                        maxWidth: 400,
                        width: '90%',
                        padding: 32,
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px'
                        }}>
                            <TrashIcon style={{ width: 32, height: 32, color: '#dc2626' }} />
                        </div>
                        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', marginBottom: 12 }}>Emin misiniz?</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24, lineHeight: '1.5' }}>
                            Bu iletiyi silmek üzeresiniz. <br />
                            <strong style={{ color: '#dc2626' }}>Bu işlem geri alınamaz.</strong>
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => { setIsDeleting(false); setDeleteId(null); }}
                                style={{ justifyContent: 'center' }}
                            >
                                Vazgeç
                            </button>
                            <button 
                                className="btn" 
                                style={{ backgroundColor: '#dc2626', color: 'white', justifyContent: 'center' }}
                                onClick={confirmDelete}
                            >
                                Evet, Sil
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
