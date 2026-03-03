'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatBubbleLeftEllipsisIcon, DocumentTextIcon, CheckIcon } from '@heroicons/react/24/outline';

const statusLabels = { pending: 'Değerlendiriliyor', sent: 'Teklif Geldi', accepted: 'Kabul Edildi', rejected: 'Reddedildi' };

export default function DealerQuotes() {
    const [quotes, setQuotes] = useState([]);
    const [companyId, setCompanyId] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [quoteItems, setQuoteItems] = useState([{ product_id: '', quantity: 1 }]);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState(null);
    const supabase = createClient();

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
        setCompanyId(profile?.company_id || '');
        const [{ data: q }, { data: p }] = await Promise.all([
            supabase.from('quotes').select('*, items:quote_items(*, product:products(name))').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
            supabase.from('products').select('id, name, code').eq('is_active', true).order('name'),
        ]);
        setQuotes(q || []);
        setProducts(p || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addItem = () => setQuoteItems(prev => [...prev, { product_id: '', quantity: 1 }]);
    const removeItem = (i) => setQuoteItems(prev => prev.filter((_, idx) => idx !== i));
    const updateItem = (i, field, val) => setQuoteItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

    const submitQuote = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const { data: q } = await supabase.from('quotes').insert({ company_id: companyId, note, status: 'pending' }).select().single();
        if (q) {
            await supabase.from('quote_items').insert(quoteItems.filter(i => i.product_id).map(i => ({
                quote_id: q.id, product_id: i.product_id, quantity: Number(i.quantity)
            })));
        }
        setSubmitting(false);
        setShowModal(false);
        setNote('');
        setQuoteItems([{ product_id: '', quantity: 1 }]);
        fetchData();
    };

    const acceptQuote = async (id) => {
        await supabase.from('quotes').update({ status: 'accepted' }).eq('id', id);
        setSelected(prev => prev ? { ...prev, status: 'accepted' } : null);
        fetchData();
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tekliflerim</h1>
                    <p className="page-subtitle">Özel fiyat taleplerini görüntüleyin</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} id="new-quote-btn">+ Teklif Talebi</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>
                <div className="table-wrapper">
                    {loading ? (
                        <div className="loading-center"><div className="loading-spinner" /></div>
                    ) : quotes.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><ChatBubbleLeftEllipsisIcon style={{ width: 48, height: 48 }} /></div>
                            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Teklif talebi yok</div>
                            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowModal(true)} id="new-quote-empty">Teklif Talep Et</button>
                        </div>
                    ) : (
                        <table>
                            <thead><tr><th>Tarih</th><th>Tutar</th><th>Durum</th><th></th></tr></thead>
                            <tbody>
                                {quotes.map(q => (
                                    <tr key={q.id} style={{ cursor: 'pointer', background: selected?.id === q.id ? 'rgba(37,99,235,0.08)' : undefined }}>
                                        <td>{new Date(q.created_at).toLocaleDateString('tr-TR')}</td>
                                        <td>{q.total_amount ? `₺${Number(q.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}</td>
                                        <td><span className={`badge badge-${q.status}`}>{statusLabels[q.status]}</span></td>
                                        <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(q)} id={`quote-detail-${q.id}`}>Detay</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <div className="card" style={{ alignSelf: 'start', position: 'sticky', top: 20 }}>
                        <div className="card-header">
                            <h3 className="card-title">Teklif Detayı</h3>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                            <span className={`badge badge-${selected.status}`}>{statusLabels[selected.status]}</span>
                        </div>
                        {selected.note && <div style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '10px 0', display: 'flex', alignItems: 'center', gap: 4 }}><DocumentTextIcon style={{ width: 14, height: 14 }} /> {selected.note}</div>}
                        <hr className="divider" />
                        {selected.items?.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                                <div>
                                    <div style={{ fontWeight: 500 }}>{item.product?.name}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>×{item.quantity}</div>
                                </div>
                                <div style={{ fontWeight: 600, color: item.unit_price ? 'var(--primary)' : 'var(--text-muted)' }}>
                                    {item.unit_price ? `₺${Number(item.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : 'Fiyat bekleniyor'}
                                </div>
                            </div>
                        ))}
                        {selected.total_amount > 0 && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: 'var(--primary)', margin: '12px 0' }}>
                                    <span>Toplam</span>
                                    <span>₺{Number(selected.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {selected.admin_note && (
                                    <div style={{ padding: 10, background: 'rgba(37,99,235,0.08)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <ChatBubbleLeftEllipsisIcon style={{ width: 14, height: 14 }} /> Admin: {selected.admin_note}
                                    </div>
                                )}
                                {selected.status === 'sent' && (
                                    <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }} onClick={() => acceptQuote(selected.id)} id="accept-quote-btn">
                                        <CheckIcon style={{ width: 16, height: 16, marginRight: 6 }} /> Teklifi Kabul Et
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Teklif Talebi Oluştur</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submitQuote}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>Ürünler</div>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} id="add-quote-item">+ Ekle</button>
                                </div>
                                {quoteItems.map((item, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            {i === 0 && <label className="form-label">Ürün</label>}
                                            <select className="form-select" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)} required id={`qi-prod-${i}`}>
                                                <option value="">Ürün seçin</option>
                                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            {i === 0 && <label className="form-label">Miktar</label>}
                                            <input className="form-input" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} id={`qi-qty-${i}`} />
                                        </div>
                                        {quoteItems.length > 1 && <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} style={{ marginTop: i === 0 ? 22 : 0 }} id={`qi-remove-${i}`}>✕</button>}
                                    </div>
                                ))}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notunuz (opsiyonel)</label>
                                <textarea className="form-textarea" style={{ minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Teslim tarihi, özel istek..." id="quote-note" />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting} id="submit-quote-btn">{submitting ? 'Gönderiliyor...' : 'Talebi Gönder'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
