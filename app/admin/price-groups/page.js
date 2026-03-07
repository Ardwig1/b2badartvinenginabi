'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { savePriceGroup, deletePriceGroup, fetchPriceGroups } from './actions';

export default function AdminPriceGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', discount_percent: '' });
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const fetch = useCallback(async () => {
        setLoading(true);
        const res = await fetchPriceGroups();
        setGroups(res.success && res.data ? res.data : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const openNew = () => { setEditing(null); setForm({ name: '', discount_percent: '' }); setShowModal(true); };
    const openEdit = (g) => { setEditing(g); setForm({ name: g.name, discount_percent: g.discount_percent }); setShowModal(true); };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = { name: form.name, discount_percent: Number(form.discount_percent) };

        const res = await savePriceGroup(payload, editing?.id);
        if (!res.success) {
            console.error(res.error);
            alert('Kaydedilirken hata oluştu!');
        }
        setSaving(false);
        setShowModal(false);
        fetch();
    };

    const remove = async (id) => {
        if (!confirm('Bu fiyat grubunu silmek istediğinizden emin misiniz?')) return;

        const res = await deletePriceGroup(id);
        if (!res.success) alert('Silinirken hata oluştu!');
        fetch();
    };

    const up = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Fiyat Grupları</h1>
                    <p className="page-subtitle">Bayi iskonto gruplarını yönetin</p>
                </div>
                <button className="btn btn-primary" onClick={openNew} id="add-pg-btn">+ Yeni Grup</button>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {groups.map(g => (
                        <div key={g.id} className="card" style={{ position: 'relative' }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>🏷️</div>
                            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>{g.name}</div>
                            <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>
                                %{g.discount_percent}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>Liste fiyatına uygulanan iskonto</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(g)} id={`edit-pg-${g.id}`}>✏️ Düzenle</button>
                                <button className="btn btn-danger btn-sm" onClick={() => remove(g.id)} id={`delete-pg-${g.id}`}>🗑️ Sil</button>
                            </div>
                        </div>
                    ))}
                    {groups.length === 0 && (
                        <div className="card" style={{ gridColumn: '1/-1' }}>
                            <div className="empty-state"><div className="empty-state-icon">🏷️</div><div className="empty-state-title">Fiyat grubu bulunamadı</div></div>
                        </div>
                    )}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? 'Grubu Düzenle' : 'Yeni Fiyat Grubu'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={save}>
                            <div className="form-group"><label className="form-label">Grup Adı *</label><input className="form-input" value={form.name} onChange={up('name')} placeholder="örn. A Grubu" required id="pg-name" /></div>
                            <div className="form-group"><label className="form-label">İskonto Oranı (%) *</label><input className="form-input" type="number" min="0" max="100" step="0.1" value={form.discount_percent} onChange={up('discount_percent')} required id="pg-discount" /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} id="save-pg-btn">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
