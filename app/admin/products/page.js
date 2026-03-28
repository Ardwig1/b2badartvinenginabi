'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MagnifyingGlassIcon, CubeIcon, ArchiveBoxIcon, PencilSquareIcon, CameraIcon } from '@heroicons/react/24/outline';
import GlobalMarginSettings from '@/components/GlobalMarginSettings';

export default function AdminProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [globalMargin, setGlobalMargin] = useState(36);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const [pageImagesLoading, setPageImagesLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [stockTarget, setStockTarget] = useState(null);
    const [campaignTarget, setCampaignTarget] = useState(null);
    const [campaignRate, setCampaignRate] = useState('10');
    const [stockQty, setStockQty] = useState('');
    const [stockNote, setStockNote] = useState('');
    const [stockLocation, setStockLocation] = useState('merkez');
    const [stockType, setStockType] = useState('in');
    const [form, setForm] = useState({ code: '', oem_no: '', name: '', brand: '', car_brand: '', car_model: '', category: '', cost_price: '', profit_margin: '0', list_price: '', currency: 'TRY', stock_merkez: '0', stock_depo: '0', unit: 'adet', description: '', image_url: '', discount_rate: '0', box_quantity: '1', is_campaign: false, supplier_brand: '' });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [rates, setRates] = useState({ USD: null, EUR: null });
    const supabase = createClient();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const marginRes = await fetch('/api/admin/margin');
            const marginData = await marginRes.json();
            if (marginData?.margin !== undefined) {
                setGlobalMargin(marginData.margin);
            }

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProducts(data || []);

            // Also fetch rates for the modal
            const ratesRes = await fetch('/api/rates');
            const ratesData = await ratesRes.json();
            if (ratesData.USD && ratesData.EUR) {
                setRates({ USD: ratesData.USD, EUR: ratesData.EUR });
            }
        } catch (e) {
            console.error('Fetch error:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // Client-side filtering based on search term
    const filtered = search.trim()
        ? products.filter(p => {
            const term = search.trim().toLowerCase();
            return (p.name && p.name.toLowerCase().includes(term)) ||
                (p.code && p.code.toLowerCase().includes(term)) ||
                (p.oem_no && p.oem_no.toLowerCase().includes(term)) ||
                (p.brand && p.brand.toLowerCase().includes(term));
        })
        : products;

    const openNew = () => {
        setEditing(null);
        setForm({ code: '', oem_no: '', name: '', brand: '', car_brand: '', car_model: '', category: '', cost_price: '', profit_margin: '0', list_price: '', currency: 'TRY', stock_merkez: '0', stock_depo: '0', unit: 'adet', description: '', image_url: '', discount_rate: '0', box_quantity: '1', is_campaign: false, supplier_brand: '' });
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({ code: p.code, oem_no: p.oem_no || '', name: p.name, brand: p.brand || '', car_brand: p.car_brand || '', car_model: p.car_model || '', category: p.category || '', cost_price: p.cost_price || '', profit_margin: p.profit_margin || '0', list_price: p.list_price, currency: p.currency || 'TRY', stock_merkez: p.stock_merkez || '0', stock_depo: p.stock_depo || '0', unit: p.unit || 'adet', description: p.description || '', image_url: p.image_url || '', discount_rate: p.discount_rate || '0', box_quantity: p.box_quantity || '1', is_campaign: !!p.is_campaign, supplier_brand: p.supplier_brand || '' });
        setShowModal(true);
    };

    const toggleCampaign = async (p) => {
        if (!p.is_campaign) {
            setCampaignTarget(p);
            setCampaignRate('10');
            setShowCampaignModal(true);
        } else {
            // When deactivating, reset is_campaign AND discount_rate
            await supabase.from('products').update({ is_campaign: false, discount_rate: 0 }).eq('id', p.id);
            fetchProducts();
        }
    };

    const saveCampaign = async (e) => {
        e.preventDefault();
        const numRate = Number(campaignRate);
        if (isNaN(numRate) || numRate <= 0 || numRate > 100) {
            alert("Geçersiz bir indirim oranı girdiniz!");
            return;
        }
        await supabase.from('products').update({ is_campaign: true, discount_rate: numRate }).eq('id', campaignTarget.id);
        setShowCampaignModal(false);
        fetchProducts();
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
        const merkez = Number(form.stock_merkez);
        const depo = Number(form.stock_depo);
        const costPrice = Number(form.cost_price) || 0;
        const profitMargin = Number(form.profit_margin) || 0;
        const calculatedListPrice = costPrice * (1 + profitMargin / 100);
        const payload = { 
            ...form, 
            cost_price: costPrice, 
            profit_margin: profitMargin, 
            list_price: calculatedListPrice, 
            stock_merkez: merkez, 
            stock_depo: depo, 
            stock_quantity: merkez + depo, 
            discount_rate: form.is_campaign ? Number(form.discount_rate) : 0, 
            box_quantity: Number(form.box_quantity) 
        };
        if (editing) {
            await supabase.from('products').update(payload).eq('id', editing.id);
        } else {
            await supabase.from('products').insert(payload);
        }
        setSaving(false);
        setShowModal(false);

        // Re-fetch products to see updates
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
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Yükleme başarısız oldu');
            }

            const data = await response.json();
            if (data.success && data.url) {
                setForm(prev => ({ ...prev, image_url: data.url }));
            } else {
                throw new Error('Geçerli bir URL alınamadı');
            }
        } catch (error) {
            alert('Resim yüklenemedi: ' + error.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const toggleActive = async (p) => {
        await supabase.from('products').update({ is_active: !p.is_active }).eq('id', p.id);
        fetchProducts();
    };

    const deleteProduct = async (p) => {
        if (!confirm(`"${p.name}" ürününü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
        
        const { error } = await supabase.from('products').delete().eq('id', p.id);
        
        if (error) {
            if (error.code === '23503') {
                alert('Bu ürün silinemez çünkü bu ürüne ait siparişler veya stok hareketleri mevcut. Lütfen bunun yerine ürünü pasife alın.');
            } else {
                alert('Silme işlemi sırasında hata oluştu: ' + error.message);
            }
            return;
        }
        
        fetchProducts();
    };

    const saveStock = async (e) => {
        e.preventDefault();
        const qty = parseInt(stockQty);
        if (!qty || qty <= 0) return;

        const change = stockType === 'in' ? qty : stockType === 'out' ? -qty : qty;
        await supabase.from('stock_movements').insert({ product_id: stockTarget.id, type: stockType, quantity: stockType === 'out' ? -qty : qty, note: stockNote });

        const fieldToUpdate = stockLocation === 'merkez' ? 'stock_merkez' : 'stock_depo';
        const currentValue = Number(stockTarget[fieldToUpdate] || 0);
        const newValue = Math.max(0, currentValue + change);

        const updatePayload = { [fieldToUpdate]: newValue };
        // also update total stock_quantity just in case
        const otherValue = Number(stockTarget[stockLocation === 'merkez' ? 'stock_depo' : 'stock_merkez'] || 0);
        updatePayload.stock_quantity = newValue + otherValue;

        await supabase.from('products').update(updatePayload).eq('id', stockTarget.id);
        setShowStockModal(false);
        fetchProducts();
    };

    const currentChunk = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const chunkUrlHash = currentChunk.map(p => p.image_url).filter(Boolean).join('|');

    useEffect(() => {
        let isCancelled = false;
        const urls = chunkUrlHash ? chunkUrlHash.split('|') : [];
        if (urls.length === 0) {
            setPageImagesLoading(false);
            return;
        }

        setPageImagesLoading(true);

        Promise.all(urls.map(url => {
            return new Promise(resolve => {
                const loadImg = (attempts) => {
                    const img = new window.Image();
                    img.onload = () => resolve(true);
                    img.onerror = () => {
                        if (attempts > 0) {
                            setTimeout(() => loadImg(attempts - 1), 1000); // retry aggressively
                        } else {
                            resolve(false);
                        }
                    };
                    img.src = url;
                };
                loadImg(5); // 5 retries per image
            });
        })).then(() => {
            if (!isCancelled) {
                setPageImagesLoading(false);
            }
        });

        return () => { isCancelled = true; };
    }, [chunkUrlHash]);

    const up = (f) => (e) => setForm(prev => ({ ...prev, [f]: e.target.value }));

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürünler & Stok</h1>
                    <p className="page-subtitle">{filtered.length} ürün {search.trim() ? `("${search.trim()}" araması)` : '(toplam)'}</p>
                </div>
                <button className="btn btn-primary" onClick={openNew} id="add-product-btn">+ Yeni Ürün</button>
            </div>

            <GlobalMarginSettings onMarginUpdate={setGlobalMargin} />

            <div style={{ marginBottom: 20 }}>
                <div className="search-bar" style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <span className="search-icon" style={{ position: 'absolute', left: 16, display: 'flex' }}><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
                        <input
                            placeholder="Ürün adı, kod, oem, marka ile filtrele..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            style={{ width: '100%', paddingLeft: 40, paddingRight: 16, height: 44, borderRadius: 8, border: '1px solid var(--border)', outline: 'none' }}
                            id="product-search"
                        />
                    </div>
                    {search.trim() && <button className="btn btn-ghost" onClick={() => { setSearch(''); setCurrentPage(1); }}>Temizle</button>}
                </div>
            </div>

            {loading || pageImagesLoading ? (
                <div className="card" style={{ minHeight: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                    <div style={{ marginTop: 16, fontWeight: 600, color: 'var(--primary)' }}>
                        {pageImagesLoading ? 'Ürün Görselleri Yükleniyor...' : 'Yükleniyor...'}
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ minHeight: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--text-muted)' }}>
                        <CubeIcon style={{ width: 32, height: 32 }} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Ürün Bulunamadı
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Arama kriterlerine uyan ürün yok veya pasif duruma alınmış olabilir.
                    </div>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Görsel</th><th>Stok Kodu</th><th>OEM No</th><th>Ürün Adı</th><th>Marka</th><th>Alnan F.</th><th>Kategori</th>
                                <th>Liste Fiyatı</th><th>İskonto %</th><th style={{ textAlign: 'center' }}>Koli</th><th style={{ textAlign: 'center' }}>İstanbul</th><th style={{ textAlign: 'center' }}>Depo</th><th>Durum</th><th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentChunk.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        {p.image_url ? (
                                            <img src={p.image_url} alt="img" width={36} height={36} loading="lazy" style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                                        ) : (
                                            <div style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}><CubeIcon style={{ width: 20, height: 20 }} /></div>
                                        )}
                                    </td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{p.code}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--info)', fontWeight: 600 }}>{p.oem_no || '-'}</td>
                                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                                    <td>{p.brand || '-'}</td>
                                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{p.supplier_brand || '-'}</td>
                                    <td>{p.category || '-'}</td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>
                                            {Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {p.currency || 'TRY'}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center', color: Number(p.discount_rate) > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{Number(p.discount_rate) > 0 ? `%${p.discount_rate}` : '-'}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 500 }}>{p.box_quantity || 1}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success)' }}>{p.stock_merkez || 0}</td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>{p.stock_depo || 0}</td>
                                    <td><span className={`badge ${p.is_active ? 'badge-approved' : 'badge-rejected'}`}>{p.is_active ? 'Aktif' : 'Pasif'}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button 
                                                className={`btn btn-sm ${p.is_campaign ? 'btn-warning' : 'btn-ghost'}`} 
                                                onClick={() => toggleCampaign(p)}
                                                title="Kampanya Durumu"
                                                style={{ padding: '4px 8px', borderColor: p.is_campaign ? '#eab308' : 'var(--border)' }}
                                            >
                                                {p.is_campaign ? '⭐' : '☆'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openStock(p)} id={`stock-btn-${p.id}`}><ArchiveBoxIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Stok</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} id={`edit-btn-${p.id}`}><PencilSquareIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Düzenle</button>
                                             <button className={`btn btn-sm ${p.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(p)} id={`toggle-btn-${p.id}`} title={p.is_active ? 'Pasife Al' : 'Aktifleştir'}>
                                                {p.is_active ? 'Pasif' : 'Aktif'}
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p)} style={{ padding: '4px 8px' }} title="Tamamen Sil">
                                                Sil
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && filtered.length > ITEMS_PER_PAGE && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', gap: 12 }}>
                    <button
                        className="btn btn-ghost"
                        disabled={currentPage === 1}
                        onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{ border: '1px solid var(--border)', background: currentPage === 1 ? 'var(--bg-secondary)' : '#fff', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                        Önceki
                    </button>

                    <span style={{ fontSize: 14, fontWeight: 500, padding: '0 12px' }}>
                        Sayfa {currentPage} / {Math.ceil(filtered.length / ITEMS_PER_PAGE)}
                    </span>

                    <button
                        className="btn btn-ghost"
                        disabled={currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE)}
                        onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{ border: '1px solid var(--border)', background: currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE) ? 'var(--bg-secondary)' : '#fff', opacity: currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE) ? 0.5 : 1, cursor: currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
                    >
                        Sonraki
                    </button>
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
                                <div className="form-group"><label className="form-label">OEM No</label><input className="form-input" value={form.oem_no} onChange={up('oem_no')} id="prod-oem" placeholder="Örn: 12345-ABC" /></div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}><label className="form-label">Ürün Adı *</label><input className="form-input" value={form.name} onChange={up('name')} required id="prod-name" /></div>
                                <div className="form-group"><label className="form-label">Marka</label><input className="form-input" value={form.brand} onChange={up('brand')} id="prod-brand" /></div>
                                <div className="form-group"><label className="form-label" style={{ color: 'var(--danger)', fontWeight: 700 }}>Ürünün Alındığı Firma (GİZLİ)</label><input className="form-input" style={{ borderColor: 'var(--danger)' }} value={form.supplier_brand} onChange={up('supplier_brand')} id="prod-supplier-brand" placeholder="Örn: X Tedarikçisi" /></div>
                                <div className="form-group"><label className="form-label">Araç Markası</label><input className="form-input" value={form.car_brand} onChange={up('car_brand')} id="prod-car-brand" placeholder="Örn: RENAULT" /></div>
                                <div className="form-group"><label className="form-label">Araç Modeli</label><input className="form-input" value={form.car_model} onChange={up('car_model')} id="prod-car-model" placeholder="Örn: CLIO 5" /></div>
                                <div className="form-group"><label className="form-label">Kategori</label><input className="form-input" value={form.category} onChange={up('category')} id="prod-category" /></div>
                                <div className="form-group"><label className="form-label">Para Birimi</label>
                                    <select className="form-select" value={form.currency} onChange={up('currency')} id="prod-currency">
                                        <option value="TRY">TRY (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        gap: 12, 
                                        background: 'var(--bg-surface)', 
                                        padding: '8px 12px', 
                                        borderRadius: 'var(--radius)', 
                                        border: '1px solid var(--border-light)',
                                        marginBottom: 4,
                                        width: 'fit-content'
                                    }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 4 }}>
                                            <span style={{ color: '#16a34a' }}>USD:</span>
                                            <span>{rates.USD ? `₺${rates.USD.toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
                                        </div>
                                        <div style={{ width: 1, height: 12, background: 'var(--border)', alignSelf: 'center' }} />
                                        <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 4 }}>
                                            <span style={{ color: '#2563eb' }}>EUR:</span>
                                            <span>{rates.EUR ? `₺${rates.EUR.toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
                                        </div>
                                    </div>
                                    <label className="form-label">Geliş Fiyatı *</label>
                                    <input className="form-input" type="number" min="0" step="0.01" value={form.cost_price} onChange={up('cost_price')} required id="prod-cost-price" placeholder="Ürünün alış fiyatı" />
                                </div>
                                <div className="form-group"><label className="form-label">Kâr Oranı (%) *</label><input className="form-input" type="number" min="0" step="0.1" value={form.profit_margin} onChange={up('profit_margin')} required id="prod-profit-margin" placeholder="Örn: 30" /></div>
                                <div className="form-group"><label className="form-label">İskonto Oranı (%)</label><input className="form-input" type="number" min="0" max="100" step="0.1" value={form.discount_rate} onChange={up('discount_rate')} id="prod-discount" /></div>
                                {Number(form.cost_price) > 0 && (() => {
                                    const cost = Number(form.cost_price) || 0;
                                    const margin = Number(form.profit_margin) || 0;
                                    const discount = Number(form.discount_rate) || 0;
                                    const listPrice = cost * (1 + margin / 100);
                                    const discountedPrice = listPrice * (1 - discount / 100);
                                    const kdvPrice = discountedPrice * 1.20;
                                    const cur = form.currency;
                                    const fmt = (v) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
                                    return (
                                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
                                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>💰 Fiyat Hesaplama</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Geliş Fiyatı</div>
                                                        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 14 }}>{fmt(cost)} {cur}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Liste Fiyatı (+%{margin})</div>
                                                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>{fmt(listPrice)} {cur}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>İskontolu {discount > 0 ? `(-%${discount})` : ''}</div>
                                                        <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 15 }}>{fmt(discountedPrice)} {cur}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>KDV Dahil (%20)</div>
                                                        <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 16 }}>{fmt(kdvPrice)} {cur}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div className="form-group"><label className="form-label">Birim</label>
                                    <select className="form-select" value={form.unit} onChange={up('unit')} id="prod-unit">
                                        <option value="adet">Adet</option><option value="kg">Kg</option><option value="litre">Litre</option><option value="metre">Metre</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Koli Adeti</label><input className="form-input" type="number" min="1" value={form.box_quantity} onChange={up('box_quantity')} id="prod-box-qty" /></div>
                                <div className="form-group"><label className="form-label">İstanbul Stok</label><input className="form-input" type="number" min="0" value={form.stock_merkez} onChange={up('stock_merkez')} id="prod-merkez" /></div>
                                <div className="form-group"><label className="form-label">Depo Stok</label><input className="form-input" type="number" min="0" value={form.stock_depo} onChange={up('stock_depo')} id="prod-depo" /></div>
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
                                            <div style={{ position: 'relative', width: 120, height: 120 }}>
                                                <img src={form.image_url} alt="preview" width={120} height={120} loading="lazy" style={{ objectFit: 'contain', borderRadius: 8 }} />
                                                <button type="button" onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_url: '' })) }} style={{ position: 'absolute', top: -10, right: -10, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✕</button>
                                            </div>
                                        ) : (
                                            <>
                                                <CameraIcon style={{ width: 32, height: 32, color: 'var(--text-muted)' }} />
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
                                <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(234, 179, 8, 0.1)', padding: '10px 16px', borderRadius: 8, border: '1px solid #eab308' }}>
                                    <input type="checkbox" checked={form.is_campaign} onChange={e => setForm(prev => ({ ...prev, is_campaign: e.target.checked }))} style={{ width: 20, height: 20, cursor: 'pointer' }} id="prod-campaign" />
                                    <label className="form-label" htmlFor="prod-campaign" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 700, color: '#854d0e' }}>🌟 BU ÜRÜN KAMPANYALI ÜRÜNDÜR</label>
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
                            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label className="form-label">Konum</label>
                                    <select className="form-select" value={stockLocation} onChange={e => setStockLocation(e.target.value)} id="stock-location">
                                        <option value="merkez">İstanbul Depo</option>
                                        <option value="depo">Şube Depo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">İşlem Türü</label>
                                    <select className="form-select" value={stockType} onChange={e => setStockType(e.target.value)} id="stock-type">
                                        <option value="in">Stok Girişi (+)</option>
                                        <option value="out">Stok Çıkışı (-)</option>
                                        <option value="adjustment">Sayım Düzeltmesi</option>
                                    </select>
                                </div>
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
            {/* Campaign Modal */}
            {showCampaignModal && campaignTarget && (
                <div className="modal-overlay" onClick={() => setShowCampaignModal(false)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Kampanya Tanımla</h3>
                            <button className="modal-close" onClick={() => setShowCampaignModal(false)}>✕</button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{campaignTarget.name}</strong> ürünü için kampanya indirim oranını belirleyin.
                        </p>
                        <form onSubmit={saveCampaign}>
                            <div className="form-group">
                                <label className="form-label">İndirim Oranı (%) *</label>
                                <input 
                                    className="form-input" 
                                    type="number" 
                                    min="1" 
                                    max="100" 
                                    step="0.1"
                                    value={campaignRate} 
                                    onChange={e => setCampaignRate(e.target.value)} 
                                    required 
                                    autoFocus
                                    id="campaign-rate" 
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCampaignModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" style={{ background: '#eab308', borderColor: '#eab308' }} id="save-campaign-btn">Kampanyayı Başlat ⭐</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
