'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [stockTarget, setStockTarget] = useState(null);
    const [stockQty, setStockQty] = useState('');
    const [stockNote, setStockNote] = useState('');
    const [stockType, setStockType] = useState('in');
    const [form, setForm] = useState({ code: '', product_number: '', name: '', brand: '', category: '', list_price: '', stock_quantity: '', unit: 'adet', description: '', image_url: '' });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const supabase = createClient();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        setProducts(data || []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    const openNew = () => {
        setEditing(null);
        setForm({ code: '', product_number: '', name: '', brand: '', category: '', list_price: '', stock_quantity: '0', unit: 'adet', description: '', image_url: '' });
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({ code: p.code, product_number: p.product_number || '', name: p.name, brand: p.brand || '', category: p.category || '', list_price: p.list_price, stock_quantity: p.stock_quantity, unit: p.unit || 'adet', description: p.description || '', image_url: p.image_url || '' });
        setShowModal(true);
    };

    const openStock = (p) => {
        setStockTarget(p);
        setStockQty('');
        setStockNote('');
        setStockType('in');
        setShowStockModal(true);
    };

    const saveProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = { ...form, list_price: Number(form.list_price), stock_quantity: Number(form.stock_quantity) };
        if (editing) {
            await supabase.from('products').update(payload).eq('id', editing.id);
        } else {
            await supabase.from('products').insert(payload);
        }
        setSaving(false);
        setShowModal(false);
        fetchProducts();
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith('image/')) return alert('Lütfen geçerli bir resim dosyası bırakın.');
        await uploadImage(file);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadImage(file);
    };

    const uploadImage = async (file) => {
        setUploadingImage(true);
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const { data, error } = await supabase.storage.from('products').upload(fileName, file);
        if (error) {
            alert('Resim yüklenemedi: Lütfen Supabase SQL editöründen ürünler için Storage tablosunu aktif ettiğinizden emin olun. \n' + error.message);
            setUploadingImage(false);
            return;
        }
        const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
        setForm(prev => ({ ...prev, image_url: publicUrl }));
        setUploadingImage(false);
    };

    const toggleActive = async (p) => {
        await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
        fetchProducts();
    };

    const saveStock = async (e) => {
        e.preventDefault();
        const qty = parseInt(stockQty);
        if (!qty || qty <= 0) return;
        const change = stockType === 'in' ? qty : stockType === 'out' ? -qty : qty;
        await supabase.from('stock_movements').insert({ product_id: stockTarget.id, type: stockType, quantity: stockType === 'out' ? -qty : qty, note: stockNote });
        await supabase.from('products').update({ stock_quantity: Math.max(0, Number(stockTarget.stock_quantity) + change) }).eq('id', stockTarget.id);
        setShowStockModal(false);
        fetchProducts();
    };

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.product_number?.toLowerCase().includes(search.toLowerCase()) ||
        p.brand?.toLowerCase().includes(search.toLowerCase())
    );

    const up = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürünler & Stok</h1>
                    <p className="page-subtitle">{products.length} ürün kayıtlı</p>
                </div>
                <button className="btn btn-primary" onClick={openNew} id="add-product-btn">+ Yeni Ürün</button>
            </div>

            <div style={{ marginBottom: 20 }}>
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input placeholder="Ürün adı, kod, marka..." value={search} onChange={e => setSearch(e.target.value)} id="product-search" />
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Görsel</th><th>Stok Kodu</th><th>Ürün Numarası</th><th>Ürün Adı</th><th>Marka</th><th>Kategori</th>
                                <th>Liste Fiyatı</th><th>Stok</th><th>Durum</th><th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        {p.image_url ? (
                                            <img src={p.image_url} alt="img" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                                        ) : (
                                            <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📦</div>
                                        )}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{p.code}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--info)', fontWeight: 600 }}>{p.product_number || '-'}</td>
                                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                                    <td>{p.brand || '-'}</td>
                                    <td>{p.category || '-'}</td>
                                    <td>₺{Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span style={{ color: p.stock_quantity <= 5 ? 'var(--danger)' : p.stock_quantity <= 20 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                                            {p.stock_quantity} {p.unit}
                                        </span>
                                    </td>
                                    <td><span className={`badge ${p.is_active ? 'badge-approved' : 'badge-rejected'}`}>{p.is_active ? 'Aktif' : 'Pasif'}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openStock(p)} id={`stock-btn-${p.id}`}>📦 Stok</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} id={`edit-btn-${p.id}`}>✏️ Düzenle</button>
                                            <button className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(p)} id={`toggle-btn-${p.id}`}>
                                                {p.is_active ? 'Pasif' : 'Aktif'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Product Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={saveProduct}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                <div className="form-group"><label className="form-label">Stok Kodu *</label><input className="form-input" value={form.code} onChange={up('code')} required id="prod-code" /></div>
                                <div className="form-group"><label className="form-label">Ürün Numarası</label><input className="form-input" value={form.product_number} onChange={up('product_number')} id="prod-number" placeholder="Örn: 12345-ABC" /></div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Ürün Adı *</label><input className="form-input" value={form.name} onChange={up('name')} required id="prod-name" /></div>
                                <div className="form-group"><label className="form-label">Marka</label><input className="form-input" value={form.brand} onChange={up('brand')} id="prod-brand" /></div>
                                <div className="form-group"><label className="form-label">Kategori</label><input className="form-input" value={form.category} onChange={up('category')} id="prod-category" /></div>
                                <div className="form-group"><label className="form-label">Liste Fiyatı (₺) *</label><input className="form-input" type="number" min="0" step="0.01" value={form.list_price} onChange={up('list_price')} required id="prod-price" /></div>
                                <div className="form-group"><label className="form-label">Birim</label>
                                    <select className="form-select" value={form.unit} onChange={up('unit')} id="prod-unit">
                                        <option value="adet">Adet</option><option value="kg">Kg</option><option value="litre">Litre</option><option value="metre">Metre</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Başlangıç Stok</label><input className="form-input" type="number" min="0" value={form.stock_quantity} onChange={up('stock_quantity')} id="prod-stock" /></div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <label className="form-label">Ürün Görseli</label>
                                    <div
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        style={{
                                            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                                            padding: 24,
                                            textAlign: 'center',
                                            borderRadius: 8,
                                            background: isDragging ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                                        }}
                                        onClick={() => document.getElementById('file-upload').click()}
                                    >
                                        <input type="file" id="file-upload" hidden accept="image/*" onChange={handleFileSelect} />
                                        {uploadingImage ? (
                                            <div className="loading-spinner" style={{ width: 24, height: 24, margin: '8px auto' }} />
                                        ) : form.image_url ? (
                                            <div style={{ position: 'relative' }}>
                                                <img src={form.image_url} alt="preview" style={{ maxHeight: 120, borderRadius: 8 }} />
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_url: '' })) }} style={{ position: 'absolute', top: -10, right: -10, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span style={{ fontSize: 32 }}>📸</span>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                                    Resmi buraya sürükleyin veya <span style={{ color: 'var(--primary)', fontWeight: 500 }}>tıklayıp seçin</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <input className="form-input" value={form.image_url} onChange={up('image_url')} placeholder="Veya internetten bir görsel URL'sini buraya yapıştırıp ekleyebilirsiniz (https://...)" id="prod-image-url" style={{ fontSize: 13 }} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Açıklama</label><textarea className="form-textarea" style={{ minHeight: 70 }} value={form.description} onChange={up('description')} id="prod-desc" /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving} id="save-product-btn">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stock Modal */}
            {showStockModal && stockTarget && (
                <div className="modal-overlay" onClick={() => setShowStockModal(false)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Stok Hareketi</h3>
                            <button className="modal-close" onClick={() => setShowStockModal(false)}>✕</button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{stockTarget.name}</strong> — Mevcut stok: <strong style={{ color: 'var(--primary)' }}>{stockTarget.stock_quantity}</strong>
                        </p>
                        <form onSubmit={saveStock}>
                            <div className="form-group">
                                <label className="form-label">İşlem Türü</label>
                                <select className="form-select" value={stockType} onChange={e => setStockType(e.target.value)} id="stock-type">
                                    <option value="in">Stok Girişi (+)</option>
                                    <option value="out">Stok Çıkışı (-)</option>
                                    <option value="adjustment">Sayım Düzeltmesi</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Miktar *</label>
                                <input className="form-input" type="number" min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} required id="stock-qty" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Not</label>
                                <input className="form-input" value={stockNote} onChange={e => setStockNote(e.target.value)} placeholder="Opsiyonel not" id="stock-note" />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowStockModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" id="save-stock-btn">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
