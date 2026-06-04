'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { savePriceGroup, deletePriceGroup, fetchPriceGroups } from './actions';

export default function AdminPriceGroups() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', discount_percent: '', rules: {}, show_bank_transfer: true });
    const [suppliers, setSuppliers] = useState([]);
    const [newRule, setNewRule] = useState({ supplier: '', discount: '' });
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const fetch = useCallback(async () => {
        setLoading(true);
        const res = await fetchPriceGroups();
        if (res.success && res.data) {
            const systemNames = ['USD_FIXED_RATE', 'USD_FIXED_RATE_ACTIVE', 'GLOBAL_PROFIT_MARGIN', 'EUR_FIXED_RATE', 'EUR_FIXED_RATE_ACTIVE', 'SHIPPING_FREE_THRESHOLD', 'SHIPPING_COST'];
            setGroups(res.data.filter(g => !systemNames.includes(g.name)));
        } else {
            setGroups([]);
        }

        // Also fetch unique suppliers
        const { data: prodData } = await supabase.from('products').select('supplier_brand');
        if (prodData) {
            const unique = Array.from(new Set(prodData.map(p => p.supplier_brand?.trim()).filter(Boolean))).sort();
            setSuppliers(unique);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => { fetch(); }, [fetch]);

    const openNew = () => { setEditing(null); setForm({ name: '', discount_percent: '', rules: {}, show_bank_transfer: true }); setShowModal(true); };
    const openEdit = (g) => { setEditing(g); setForm({ name: g.name, discount_percent: g.discount_percent, rules: g.rules || {}, show_bank_transfer: g.show_bank_transfer !== false }); setShowModal(true); };

    const addRule = () => {
        if (!newRule.supplier || newRule.discount.trim() === '') return;
        const val = newRule.discount.trim() === '-' ? '-' : Number(newRule.discount);
        setForm(prev => ({
            ...prev,
            rules: { ...prev.rules, [newRule.supplier]: val }
        }));
        setNewRule({ supplier: '', discount: '' });
    };

    const removeRule = (supplier) => {
        const updated = { ...form.rules };
        delete updated[supplier];
        setForm(prev => ({ ...prev, rules: updated }));
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = {
            name: form.name,
            discount_percent: Number(form.discount_percent),
            rules: form.rules,
            show_bank_transfer: form.show_bank_transfer 
        };

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
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? 'Grubu Düzenle' : 'Yeni Fiyat Grubu'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={save}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div style={{ borderRight: '1px solid var(--border)', paddingRight: 20 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase' }}>Genel Ayarlar</div>
                                    <div className="form-group"><label className="form-label">Grup Adı *</label><input className="form-input" value={form.name} onChange={up('name')} placeholder="örn. A Grubu" required id="pg-name" /></div>
                                    <div className="form-group"><label className="form-label">Genel İskonto Oranı (%) *</label><input className="form-input" type="number" min="0" max="100" step="0.1" value={form.discount_percent} onChange={up('discount_percent')} required id="pg-discount" /></div>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>💡 Özel bir kural tanımlanmamış tüm ürünlerde bu oran geçerli olur.</p>
                                    <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 13 }}>Havale ile Ödeme Seçeneği</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Bu gruptaki müşteriler sepette %3 havale iskontosunu görebilsin mi?</div>
                                            </div>
                                            <div style={{ position: 'relative', flexShrink: 0 }}
                                                onClick={e => { e.preventDefault(); e.stopPropagation(); setForm(prev => ({ ...prev, show_bank_transfer: !prev.show_bank_transfer })); }}>
                                                <div style={{ width: 44, height: 24, borderRadius: 12, background: form.show_bank_transfer ? 'var(--primary)' : 'var(--border)', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }}>
                                                    <div style={{ position: 'absolute', top: 2, left: form.show_bank_transfer ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 12, textTransform: 'uppercase' }}>Tedarikçi Bazlı Kurallar</div>
                                    
                                    <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px auto', gap: 8, alignItems: 'flex-end' }}>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Stok Firması</label>
                                                <select className="form-select" style={{ height: 32, fontSize: 12, padding: '0 8px' }} value={newRule.supplier} onChange={e => setNewRule(prev => ({ ...prev, supplier: e.target.value }))}>
                                                    <option value="">Seçiniz...</option>
                                                    {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>İsk.% <span style={{ color: '#dc2626' }}>(- = gizle)</span></label>
                                                <input type="text" className="form-input" style={{ height: 32, fontSize: 12, padding: '0 8px' }} value={newRule.discount} onChange={e => setNewRule(prev => ({ ...prev, discount: e.target.value }))} placeholder="10 veya -" />
                                            </div>
                                            <button type="button" className="btn btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 12 }} onClick={addRule}>Ekle</button>
                                        </div>
                                    </div>

                                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                        {Object.entries(form.rules).length === 0 ? (
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Henüz özel kural eklenmedi.</p>
                                        ) : (
                                            <table style={{ width: '100%', fontSize: 12 }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <th style={{ textAlign: 'left', padding: '4px 0' }}>Firma</th>
                                                        <th style={{ textAlign: 'center', padding: '4px 0' }}>İsk.%</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {Object.entries(form.rules).map(([s, d]) => (
                                                        <tr key={s} style={{ borderBottom: '1px dashed var(--border)' }}>
                                                            <td style={{ padding: '6px 0', fontWeight: 600 }}>{s}</td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {d === '-'
                                                                    ? <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 11, background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>🚫 GİZLİ</span>
                                                                    : `%${d}`
                                                                }
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <button type="button" onClick={() => removeRule(s)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}>✕</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
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
