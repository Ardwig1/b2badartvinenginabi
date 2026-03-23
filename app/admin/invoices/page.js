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
    const [form, setForm] = useState({ company_id: '', due_date: '', desc: '', amount: '', file: null });
    const [itemCount, setItemCount] = useState(0);
    const [oemInputs, setOemInputs] = useState([]);

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

    const saveInvoice = async (e) => {
        e.preventDefault();
        setSaving(true);

        // 1. Dosya Yükleme
        let fileUrl = '';
        if (form.file) {
            const formData = new FormData();
            formData.append('file', form.file);

            try {
                const uploadRes = await fetch('/api/admin/upload-file', {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (!uploadRes.ok || !uploadData.success) {
                    alert('Dosya yüklenemedi: ' + (uploadData.error || 'Bilinmeyen hata'));
                    setSaving(false);
                    return;
                }
                fileUrl = uploadData.url;
            } catch (err) {
                alert('Dosya yükleme sırasında bağlantı hatası: ' + err.message);
                setSaving(false);
                return;
            }
        }

        // 2. Veritabanına Kayıt
        const invoiceNo = `CH-${Date.now()}`;
        const noteData = JSON.stringify({ desc: form.desc, url: fileUrl });
        const amount = parseFloat(form.amount) || 0;
        const oemString = oemInputs.filter(o => o.trim()).join(', ');

        const { error } = await supabase.from('invoices').insert({
            company_id: form.company_id,
            invoice_number: invoiceNo,
            due_date: form.due_date || null,
            tax_percent: 0,
            tax_amount: 0,
            subtotal: amount,
            total_amount: amount,
            note: noteData,
            status: 'unpaid',
            oem_nos: oemString
        });

        if (error) {
            alert('Kayıt oluşturulurken hata oluştu: ' + error.message);
            setSaving(false);
            return;
        }

        // NOT: Cari hesap borcu sipariş anında place_b2b_order RPC'si tarafından
        // otomatik oluşturuluyor. Burada ikinci kez borçlandırmak çift kayda yol açar.
        // Bu sayfa sadece belge deposudur (PDF fatura arşivi).

        setSaving(false);
        setShowModal(false);
        fetchAll();
    };

    const fmtMoney = (n) => n > 0 ? '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-';
    const up = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hesap Yönetimi</h1>
                    <p className="page-subtitle">Firmalara ait PDF ekstre ve faturalarını yükleyin</p>
                </div>
                <button className="btn btn-primary" onClick={() => { 
                    setForm({ company_id: '', due_date: new Date().toISOString().split('T')[0], desc: '', amount: '', file: null }); 
                    setItemCount(0);
                    setOemInputs([]);
                    setShowModal(true); 
                }}>+ Yeni Kayıt</button>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>Tarih</th><th>Firma</th><th>Açıklama</th><th>OEM No</th><th style={{ textAlign: 'right' }}>Tutar</th><th>İşlem</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => {
                                let noteData = { desc: '', url: '' };
                                try { noteData = JSON.parse(inv.note || '{}'); } catch (e) { noteData = { desc: inv.note, url: '' }; }
                                return (
                                    <tr key={inv.id}>
                                        <td style={{ fontWeight: 600 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{inv.company?.name}</td>
                                        <td>{noteData.desc || '-'}</td>
                                        <td>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.oem_nos || '-'}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: inv.total_amount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtMoney(inv.total_amount)}</td>
                                        <td>
                                            {noteData.url ? (
                                                <a href={'/api/file?url=' + encodeURIComponent(noteData.url)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#2563eb', fontWeight: 600 }}>📄 PDF İndir</a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Dosya Yok</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {invoices.length === 0 && (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Kayıt bulunamadı</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Yeni Cari Kayıt Ekle</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={saveInvoice}>
                            <div className="form-group"><label className="form-label">Firma *</label>
                                <select className="form-select" value={form.company_id} onChange={up('company_id')} required>
                                    <option value="">Firma seçin</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label className="form-label">Tarih *</label>
                                <input className="form-input" type="date" value={form.due_date} onChange={up('due_date')} required />
                            </div>
                            <div className="form-group"><label className="form-label">Açıklama *</label>
                                <input className="form-input" value={form.desc || ''} onChange={up('desc')} placeholder="Örn: Temmuz Ayı Faturası" required />
                            </div>
                            <div className="form-group"><label className="form-label">Tutar (₺)</label>
                                <input className="form-input" type="number" step="0.01" min="0" value={form.amount || ''} onChange={up('amount')} placeholder="0.00" />
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tutar girilirse müşterinin cari hesabına otomatik borç olarak işlenir.</div>
                            </div>
                            <div className="form-group"><label className="form-label">Dosya (PDF)</label>
                                <input className="form-input" type="file" accept=".pdf,image/*" onChange={(e) => setForm(prev => ({ ...prev, file: e.target.files[0] }))} />
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Faturalar veya PDF ekstreleri yükleyebilirsiniz.</div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Ürün Adedi</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => {
                                        if (itemCount > 0) {
                                            setItemCount(itemCount - 1);
                                            setOemInputs(prev => prev.slice(0, -1));
                                        }
                                    }}>-</button>
                                    <span style={{ fontWeight: 600, fontSize: 16 }}>{itemCount}</span>
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ width: 32, height: 32, padding: 0 }} onClick={() => {
                                        setItemCount(itemCount + 1);
                                        setOemInputs(prev => [...prev, '']);
                                    }}>+</button>
                                </div>
                            </div>

                            {itemCount > 0 && (
                                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Array.from({ length: itemCount }).map((_, i) => (
                                        <div key={i}>
                                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{i + 1}. Ürün OEM No</label>
                                            <input 
                                                className="form-input" 
                                                style={{ height: 36, fontSize: 13 }}
                                                placeholder="Örn: 12345678"
                                                value={oemInputs[i] || ''}
                                                onChange={(e) => {
                                                    const newInputs = [...oemInputs];
                                                    newInputs[i] = e.target.value;
                                                    setOemInputs(newInputs);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Ekleniyor...' : 'Kayıt Ekle'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
