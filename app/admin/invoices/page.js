'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [orders, setOrders] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState({ company_id: '', order_id: '', invoice_number: '', due_date: '', tax_percent: 18, note: '' });
    const [invoiceItems, setInvoiceItems] = useState([{ product_id: '', description: '', quantity: 1, unit_price: '' }]);
    const [saving, setSaving] = useState(false);
    const supabase = createClient();

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [{ data: inv }, { data: ord }, { data: comp }, { data: prod }] = await Promise.all([
            supabase.from('invoices').select('*, company:companies(name), order:orders(id)').order('created_at', { ascending: false }),
            supabase.from('orders').select('id, company_id, total_amount').eq('status', 'delivered'),
            supabase.from('companies').select('id, name').eq('status', 'approved'),
            supabase.from('products').select('id, name, list_price').eq('is_active', true),
        ]);
        setInvoices(inv || []);
        setOrders(ord || []);
        setCompanies(comp || []);
        setProducts(prod || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const addItem = () => setInvoiceItems(prev => [...prev, { product_id: '', description: '', quantity: 1, unit_price: '' }]);
    const removeItem = (i) => setInvoiceItems(prev => prev.filter((_, idx) => idx !== i));
    const updateItem = (i, field, val) => setInvoiceItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
    const updateProductItem = (i, productId) => {
        const prod = products.find(p => p.id === productId);
        setInvoiceItems(prev => prev.map((item, idx) => idx === i ? { ...item, product_id: productId, description: prod?.name || '', unit_price: prod?.list_price || '' } : item));
    };

    const subtotal = invoiceItems.reduce((acc, i) => acc + (Number(i.unit_price || 0) * Number(i.quantity || 0)), 0);
    const taxAmount = subtotal * (Number(form.tax_percent) / 100);
    const totalAmount = subtotal + taxAmount;

    const saveInvoice = async (e) => {
        e.preventDefault();
        setSaving(true);
        const { data: inv, error } = await supabase.from('invoices').insert({
            company_id: form.company_id,
            order_id: form.order_id || null,
            invoice_number: form.invoice_number,
            due_date: form.due_date || null,
            tax_percent: Number(form.tax_percent),
            tax_amount: taxAmount,
            subtotal,
            total_amount: totalAmount,
            note: form.note,
            status: 'unpaid',
        }).select().single();
        if (!error && inv) {
            await supabase.from('invoice_items').insert(invoiceItems.map(item => ({
                invoice_id: inv.id,
                product_id: item.product_id || null,
                description: item.description,
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                total_price: Number(item.unit_price) * Number(item.quantity),
            })));
        }
        setSaving(false);
        setShowModal(false);
        fetchAll();
    };

    const updatePayment = async (id, status) => {
        await supabase.from('invoices').update({ status }).eq('id', id);
        fetchAll();
    };

    const up = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));
    const statusBadge = { unpaid: 'badge-unpaid', paid: 'badge-paid', partial: 'badge-partial' };
    const statusLabel = { unpaid: 'Ödenmedi', paid: 'Ödendi', partial: 'Kısmi' };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Fatura Yönetimi</h1>
                    <p className="page-subtitle">Fatura oluşturun ve takip edin</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setForm({ company_id: '', order_id: '', invoice_number: `INV-${Date.now()}`, due_date: '', tax_percent: 18, note: '' }); setInvoiceItems([{ product_id: '', description: '', quantity: 1, unit_price: '' }]); setShowModal(true); }} id="add-invoice-btn">+ Yeni Fatura</button>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Fatura No</th><th>Firma</th><th>Tutar</th><th>Vade Tarihi</th><th>Durum</th><th>İşlemler</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id}>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{inv.invoice_number}</td>
                                    <td style={{ fontWeight: 600 }}>{inv.company?.name}</td>
                                    <td>₺{Number(inv.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                    <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                    <td><span className={`badge ${statusBadge[inv.status]}`}>{statusLabel[inv.status]}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {inv.status !== 'paid' && <button className="btn btn-success btn-sm" onClick={() => updatePayment(inv.id, 'paid')} id={`pay-${inv.id}`}>✓ Ödendi</button>}
                                            {inv.status === 'unpaid' && <button className="btn btn-ghost btn-sm" onClick={() => updatePayment(inv.id, 'partial')} id={`partial-${inv.id}`}>Kısmi</button>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {invoices.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Fatura bulunamadı</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Yeni Fatura</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={saveInvoice}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                <div className="form-group"><label className="form-label">Firma *</label>
                                    <select className="form-select" value={form.company_id} onChange={up('company_id')} required id="inv-company">
                                        <option value="">Firma seçin</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Fatura No *</label>
                                    <input className="form-input" value={form.invoice_number} onChange={up('invoice_number')} required id="inv-number" />
                                </div>
                                <div className="form-group"><label className="form-label">Vade Tarihi</label>
                                    <input className="form-input" type="date" value={form.due_date} onChange={up('due_date')} id="inv-due" />
                                </div>
                                <div className="form-group"><label className="form-label">KDV (%)</label>
                                    <input className="form-input" type="number" min="0" max="100" value={form.tax_percent} onChange={up('tax_percent')} id="inv-tax" />
                                </div>
                            </div>

                            <hr className="divider" />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>Kalemler</div>
                                <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} id="add-item-btn">+ Kalem Ekle</button>
                            </div>
                            {invoiceItems.map((item, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        {i === 0 && <label className="form-label">Ürün / Açıklama</label>}
                                        <select className="form-select" value={item.product_id} onChange={e => updateProductItem(i, e.target.value)} id={`item-prod-${i}`}>
                                            <option value="">Ürün seçin ya da yazın</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        {i === 0 && <label className="form-label">Miktar</label>}
                                        <input className="form-input" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} id={`item-qty-${i}`} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        {i === 0 && <label className="form-label">Birim Fiyat</label>}
                                        <input className="form-input" type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} id={`item-price-${i}`} />
                                    </div>
                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)} style={{ marginTop: i === 0 ? 22 : 0 }} id={`remove-item-${i}`}>✕</button>
                                </div>
                            ))}

                            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius)', padding: 16, marginTop: 12, marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    <span>Ara Toplam</span><span>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    <span>KDV ({form.tax_percent}%)</span><span>₺{taxAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
                                    <span>Toplam</span><span>₺{totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} id="save-invoice-btn">{saving ? 'Kaydediliyor...' : 'Fatura Oluştur'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
