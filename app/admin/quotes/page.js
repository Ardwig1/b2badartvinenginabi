'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DocumentTextIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

const statusLabels = { pending: 'Bekliyor', sent: 'Gönderildi', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };

export default function AdminQuotes() {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [pricingItems, setPricingItems] = useState([]);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const fetchQuotes = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('quotes')
            .select('*, company:companies(name), items:quote_items(*, product:products(name, code, list_price))')
            .order('created_at', { ascending: false });
        setQuotes(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

    const selectQuote = (q) => {
        setSelected(q);
        setAdminNote(q.admin_note || '');
        setPricingItems(q.items?.map(i => ({ ...i, unit_price: i.unit_price || i.product?.list_price || '' })) || []);
    };

    const updateItemPrice = (id, val) => {
        setPricingItems(prev => prev.map(i => i.id === id ? { ...i, unit_price: val } : i));
    };

    const sendQuote = async () => {
        setSaving(true);
        const total = pricingItems.reduce((acc, i) => acc + (Number(i.unit_price) * i.quantity), 0);
        await supabase.from('quotes').update({ status: 'sent', admin_note: adminNote, total_amount: total, updated_at: new Date().toISOString() }).eq('id', selected.id);
        for (const item of pricingItems) {
            await supabase.from('quote_items').update({ unit_price: Number(item.unit_price), total_price: Number(item.unit_price) * item.quantity }).eq('id', item.id);
        }
        setSaving(false);
        setSelected(null);
        fetchQuotes();
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Teklif Yönetimi</h1>
                    <p className="page-subtitle">Bayilerden gelen teklif talepleri</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="loading-spinner" /></div>
                    ) : (
                        <table>
                            <thead><tr><th>Firma</th><th>Toplam</th><th>Durum</th><th>Tarih</th><th></th></tr></thead>
                            <tbody>
                                {quotes.map(q => (
                                    <tr key={q.id} style={{ cursor: 'pointer', background: selected?.id === q.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                                        <td style={{ fontWeight: 600 }}>{q.company?.name}</td>
                                        <td>{q.total_amount ? `₺${Number(q.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td><span className={`badge badge-${q.status}`}>{statusLabels[q.status]}</span></td>
                                        <td>{new Date(q.created_at).toLocaleDateString('tr-TR')}</td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => selectQuote(q)} id={`quote-detail-${q.id}`}>Fiyatlandır</button></td>
                                    </tr>
                                ))}
                                {quotes.length === 0 && (
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Teklif talebi bulunamadı</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Teklif Fiyatlandır</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ marginBottom: 12, fontSize: 14 }}>
                            <strong style={{ color: 'var(--primary)' }}>{selected.company?.name}</strong>
                            {selected.note && <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><DocumentTextIcon style={{ width: 14, height: 14 }} /> {selected.note}</div>}
                        </div>
                        {pricingItems.map(item => (
                            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6 }}>{item.product?.name} × {item.quantity}</div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Liste: ₺{item.product?.list_price}</span>
                                    <input className="form-input" type="number" step="0.01" value={item.unit_price} onChange={e => updateItemPrice(item.id, e.target.value)} placeholder="Birim fiyat" style={{ flex: 1 }} id={`price-item-${item.id}`} />
                                </div>
                            </div>
                        ))}
                        <div style={{ padding: '12px 0', fontWeight: 700, color: 'var(--primary)', fontSize: 16 }}>
                            Toplam: ₺{pricingItems.reduce((acc, i) => acc + (Number(i.unit_price || 0) * i.quantity), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Admin Notu (opsiyonel)</label>
                            <textarea className="form-textarea" style={{ minHeight: 60 }} value={adminNote} onChange={e => setAdminNote(e.target.value)} id="admin-note" />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={sendQuote} disabled={saving} id="send-quote-btn">
                            {saving ? 'Gönderiliyor...' : <><PaperAirplaneIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Teklifi Gönder</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
