'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MagnifyingGlassIcon, CubeIcon, ArchiveBoxIcon, PencilSquareIcon, CameraIcon } from '@heroicons/react/24/outline';
import GlobalMarginSettings from '@/components/GlobalMarginSettings';

export default function AdminProducts() {
    const [products, setProducts] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isCampaignOnly, setIsCampaignOnly] = useState(false);
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

            // 🚀 Bypassing 1000 limit via dedicated Admin API
            const url = `/api/admin/products/list?page=${currentPage}&search=${encodeURIComponent(search)}&isCampaignOnly=${isCampaignOnly}&limit=${ITEMS_PER_PAGE}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setProducts(data.products || []);
            setTotalCount(data.totalCount || 0);

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
    }, [currentPage, search, isCampaignOnly]);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    // Sunucu tarafında filtrelenmiş veriyi direkt kullanıyoruz
    const filtered = products;
    const currentChunk = products;

    const openNew = () => {
        setEditing(null);
        setForm({ code: '', oem_no: '', name: '', brand: '', car_brand: '', car_model: '', category: '', cost_price: '', profit_margin: '0', list_price: '', currency: 'TRY', stock_merkez: '0', stock_depo: '0', unit: 'adet', description: '', image_url: '', discount_rate: '0', cart_discount_rate: '0', box_quantity: '1', is_campaign: false, is_fixed_price: false, fixed_price_value: '', fixed_price_currency: 'TRY', supplier_brand: '' });
        setShowModal(true);
    };

    const openEdit = (p) => {
        setEditing(p);
        setForm({ code: p.code, oem_no: p.oem_no || '', name: p.name, brand: p.brand || '', car_brand: p.car_brand || '', car_model: p.car_model || '', category: p.category || '', cost_price: p.cost_price || '', profit_margin: p.profit_margin || '0', list_price: p.list_price, currency: p.currency || 'TRY', stock_merkez: p.stock_merkez || '0', stock_depo: p.stock_depo || '0', unit: p.unit || 'adet', description: p.description || '', image_url: p.image_url || '', discount_rate: p.discount_rate || '0', cart_discount_rate: p.cart_discount_rate || '0', box_quantity: p.box_quantity || '1', is_campaign: !!p.is_campaign, is_fixed_price: !!p.is_fixed_price, fixed_price_value: p.fixed_price_value || '', fixed_price_currency: p.fixed_price_currency || 'TRY', supplier_brand: p.supplier_brand || '' });
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
            cart_discount_rate: Number(form.cart_discount_rate || 0),
            box_quantity: Number(form.box_quantity),
            is_fixed_price: !!form.is_fixed_price,
            fixed_price_value: form.is_fixed_price ? Number(form.fixed_price_value || 0) : null,
            fixed_price_currency: form.is_fixed_price ? form.fixed_price_currency : 'TRY'
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

    const chunkUrlHash = useMemo(() => currentChunk.map(p => p.image_url).filter(Boolean).join('|'), [currentChunk]);

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

    const [excelLoading, setExcelLoading] = useState(false);

    const downloadExcel = async () => {
        setExcelLoading(true);
        try {
            const res = await fetch('/api/admin/products/list?page=1&search=&isCampaignOnly=false&limit=99999');
            const data = await res.json();
            const all = data.products || [];

            const cols = [
                { label: 'Stok Kodu', key: 'code' },
                { label: 'OEM No', key: 'oem_no' },
                { label: 'Ürün Adı', key: 'name' },
                { label: 'Marka', key: 'brand' },
                { label: 'Ürünün Alındığı Firma (GİZLİ)', key: 'supplier_brand' },
                { label: 'Araç Markası', key: 'car_brand' },
                { label: 'Araç Modeli', key: 'car_model' },
                { label: 'Kategori', key: 'category' },
                { label: 'Para Birimi', key: 'currency' },
                { label: 'Geliş Fiyatı', key: 'cost_price' },
                { label: 'Kâr Oranı (%)', key: 'profit_margin' },
                { label: 'Liste Fiyatı', key: 'list_price' },
                { label: 'İskonto Oranı (%)', key: 'discount_rate' },
                { label: 'Sepette İndirim (%)', key: 'cart_discount_rate' },
                { label: 'Birim', key: 'unit' },
                { label: 'Koli Adeti', key: 'box_quantity' },
                { label: 'İstanbul Stok', key: 'stock_merkez' },
                { label: 'Depo Stok', key: 'stock_depo' },
                { label: 'Kampanyalı mı', key: 'is_campaign', fmt: v => v ? 'Evet' : 'Hayır' },
                { label: 'Sabit Fiyatlı mı', key: 'is_fixed_price', fmt: v => v ? 'Evet' : 'Hayır' },
                { label: 'Sabit Fiyat Değeri', key: 'fixed_price_value' },
                { label: 'Sabit Fiyat Dövizi', key: 'fixed_price_currency' },
                { label: 'Durum', key: 'is_active', fmt: v => v ? 'Aktif' : 'Pasif' },
                { label: 'Açıklama', key: 'description' },
                { label: 'Görsel URL', key: 'image_url' },
            ];

            const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const headerRow = cols.map(c => `<th>${esc(c.label)}</th>`).join('');
            const bodyRows = all.map(p =>
                `<tr>${cols.map(c => `<td>${esc(c.fmt ? c.fmt(p[c.key]) : p[c.key])}</td>`).join('')}</tr>`
            ).join('');

            const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>table{border-collapse:collapse}th{background:#e2e8f0;font-weight:bold;border:1px solid #cbd5e1;padding:6px 10px}td{border:1px solid #e2e8f0;padding:5px 10px}</style></head><body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Urunler_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.xls`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) {
            alert('Excel indirilemedi: ' + e.message);
        }
        setExcelLoading(false);
    };

    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkFilters, setBulkFilters] = useState({ search: '', brand: '', car_brand: '', supplier_brand: '', currency: '' });
    const [bulkUpdates, setBulkUpdates] = useState({ profit_margin: '' });

    const handleBulkUpdate = async (e) => {
        e.preventDefault();
        if (!confirm("Seçilen kriterlere uyan TÜM ürünler güncellenecektir. Bu işlem geri alınamaz. Emin misiniz?")) return;
        
        setSaving(true);
        try {
            const res = await fetch('/api/admin/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: bulkFilters,
                    updates: {
                        profit_margin: bulkUpdates.profit_margin !== '' ? Number(bulkUpdates.profit_margin) : undefined
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setShowBulkModal(false);
                fetchProducts();
            } else {
                alert("Hata: " + data.error);
            }
        } catch (e) {
            alert("Sistem hatası: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürünler & Stok</h1>
                    <p className="page-subtitle">{totalCount} ürün {search.trim() ? `("${search.trim()}" araması)` : '(toplam)'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost" onClick={downloadExcel} disabled={excelLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {excelLoading ? '⏳ İndiriliyor...' : '📥 Excel Formatında İndir'}
                    </button>
                    <button className="btn btn-primary" onClick={openNew} id="add-product-btn">+ Yeni Ürün</button>
                </div>
            </div>

            <GlobalMarginSettings onMarginUpdate={setGlobalMargin} />

            <div style={{ marginBottom: 24, width: '100%' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.95)', 
                        borderRadius: '12px',
                        border: '2px solid var(--border)',
                        flex: 1, 
                        minWidth: '250px',
                        height: 50,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.2s ease',
                        overflow: 'hidden'
                    }} onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary)'} onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                        <span style={{ paddingLeft: 18, display: 'flex', color: 'var(--primary)' }}>
                            <MagnifyingGlassIcon style={{ width: 20, height: 20, strokeWidth: 2.5 }} />
                        </span>
                        <input
                            placeholder="Ürün adı, kod, oem, marka ile akıllı filtrele..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            style={{ 
                                flex: 1,
                                padding: '0 16px', 
                                height: '100%', 
                                border: 'none', 
                                outline: 'none',
                                background: 'transparent',
                                color: '#0f172a', // Koyu Lacivert
                                fontSize: '15px',
                                fontWeight: '600',
                                width: '100%'
                            }}
                            id="product-search"
                        />
                    </div>
                    
                    <button 
                        onClick={() => { setIsCampaignOnly(!isCampaignOnly); setCurrentPage(1); }}
                        style={{ 
                            height: 50, 
                            padding: '0 24px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 10,
                            background: isCampaignOnly ? '#f59e0b' : '#f1f5f9',
                            color: isCampaignOnly ? '#ffffff' : '#475569',
                            border: `2px solid ${isCampaignOnly ? '#d97706' : '#e2e8f0'}`,
                            fontWeight: 800,
                            fontSize: '14px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            whiteSpace: 'nowrap',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: isCampaignOnly ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none'
                        }}
                    >
                        {isCampaignOnly ? '⭐ KAMPANYALILAR' : '☆ KAMPANYALILAR'}
                    </button>

                    {search.trim() && (
                        <button 
                            className="btn" 
                            onClick={() => { setSearch(''); setCurrentPage(1); }} 
                            style={{ 
                                height: 50, 
                                borderRadius: '12px', 
                                border: '2px solid #fee2e2', 
                                background: '#fef2f2',
                                color: '#b91c1c',
                                fontWeight: 700,
                                padding: '0 20px',
                                fontSize: '14px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                        >
                            TEMİZLE
                        </button>
                    )}
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
                                            {Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency || 'TRY'}
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
            {!loading && totalCount > ITEMS_PER_PAGE && (() => {
                const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
                return (
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
                        Sayfa {currentPage} / {totalPages}
                    </span>

                    <button
                        className="btn btn-ghost"
                        disabled={currentPage === totalPages}
                        onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{ border: '1px solid var(--border)', background: currentPage === totalPages ? 'var(--bg-secondary)' : '#fff', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                        Sonraki
                    </button>
                </div>
                );
            })()}

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
                                            <span>{rates.USD ? `₺${Number(rates.USD).toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
                                        </div>
                                        <div style={{ width: 1, height: 12, background: 'var(--border)', alignSelf: 'center' }} />
                                        <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', gap: 4 }}>
                                            <span style={{ color: '#2563eb' }}>EUR:</span>
                                            <span>{rates.EUR ? `₺${Number(rates.EUR).toLocaleString('tr-TR', { minimumFractionDigits: 4 })}` : '...'}</span>
                                        </div>
                                    </div>
                                    <label className="form-label">Geliş Fiyatı *</label>
                                    <input className="form-input" type="number" min="0" step="0.01" value={form.cost_price} onChange={up('cost_price')} required id="prod-cost-price" placeholder="Ürünün alış fiyatı" />
                                </div>
                                <div className="form-group"><label className="form-label">Kâr Oranı (%) *</label><input className="form-input" type="number" min="0" step="0.01" value={form.profit_margin} onChange={up('profit_margin')} required id="prod-profit-margin" placeholder="Örn: 30.55" /></div>
                                <div className="form-group">
                                    <label className="form-label">İskonto Oranı (%)</label>
                                    <input 
                                        className="form-input" 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        step="0.1" 
                                        value={form.discount_rate} 
                                        onChange={up('discount_rate')} 
                                        id="prod-discount" 
                                        disabled={!form.is_campaign}
                                        style={{ 
                                            background: !form.is_campaign ? 'var(--bg-secondary)' : 'white',
                                            cursor: !form.is_campaign ? 'not-allowed' : 'text',
                                            opacity: !form.is_campaign ? 0.7 : 1
                                        }}
                                    />
                                    {!form.is_campaign && (
                                        <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4, fontWeight: 600 }}>
                                            İskonto oranı girmek için Kampanyalı ürün olarak işaretleyin
                                        </div>
                                    )}
                                </div>
                                <div className="form-group"><label className="form-label" style={{ color: '#16a34a', fontWeight: 700 }}>🛒 Sepette İndirim (%)</label><input className="form-input" style={{ borderColor: '#16a34a' }} type="number" min="0" max="100" step="0.1" value={form.cart_discount_rate} onChange={up('cart_discount_rate')} id="prod-cart-discount" placeholder="Sepette uygulanacak ekstra indirim" /></div>
                                {Number(form.cost_price) > 0 && (() => {
                                    const cost = Number(form.cost_price) || 0;
                                    const margin = Number(form.profit_margin) || 0;
                                    const discount = Number(form.discount_rate) || 0;
                                    const listPrice = cost * (1 + margin / 100);
                                    const discountedPrice = listPrice * (1 - discount / 100);
                                    const kdvPrice = discountedPrice * 1.20;
                                    const cur = form.currency;
                                    const fmt = (v) => v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                                <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(37, 99, 235, 0.05)', padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(37, 99, 235, 0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={form.is_fixed_price} onChange={e => setForm(prev => ({ ...prev, is_fixed_price: e.target.checked }))} style={{ width: 20, height: 20, cursor: 'pointer' }} id="prod-fixed-price" />
                                        <label className="form-label" htmlFor="prod-fixed-price" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 700, color: '#2563eb' }}>📌 SABİT FİYATLI ÜRÜN (Bayi İskontosu Uygulanmaz)</label>
                                    </div>
                                    
                                    {form.is_fixed_price && (
                                        <div style={{ display: 'flex', gap: 12, marginTop: 4, padding: '12px', background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border)', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="form-label" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>Sabit Fiyat (KDV DAHİL)</label>
                                                <input className="form-input" type="number" step="0.01" value={form.fixed_price_value} onChange={up('fixed_price_value')} placeholder="Örn: 2225 veya 40" style={{ height: 38 }} />
                                            </div>
                                            <div style={{ width: 100 }}>
                                                <label className="form-label" style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>Döviz</label>
                                                <select className="form-select" value={form.fixed_price_currency} onChange={up('fixed_price_currency')} style={{ height: 38 }}>
                                                    <option value="TRY">TRY (₺)</option>
                                                    <option value="USD">USD ($)</option>
                                                    <option value="EUR">EUR (€)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={form.is_campaign} onChange={e => setForm(prev => ({ ...prev, is_campaign: e.target.checked }))} style={{ width: 20, height: 20, cursor: 'pointer' }} id="prod-campaign" />
                                        <label className="form-label" htmlFor="prod-campaign" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 700, color: '#854d0e' }}>🌟 BU ÜRÜN KAMPANYALI ÜRÜNDÜR</label>
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
            {/* Bulk Update Modal */}
            {showBulkModal && (
                <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">📦 Toplu Ürün Güncelleme</h3>
                            <button className="modal-close" onClick={() => setShowBulkModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleBulkUpdate}>
                            <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase' }}>1. Adım: Filtrele (Hangi Ürünler?)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">İsim/Kod/Marka Arama</label>
                                        <input className="form-input" value={bulkFilters.search} onChange={e => setBulkFilters(prev => ({ ...prev, search: e.target.value }))} placeholder="Örn: abc" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tedarikçi Firma (GİZLİ)</label>
                                        <input className="form-input" value={bulkFilters.supplier_brand} onChange={e => setBulkFilters(prev => ({ ...prev, supplier_brand: e.target.value }))} placeholder="Örn: korea otomotiv" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Marka (Tam Eşleşme)</label>
                                        <select className="form-select" value={bulkFilters.brand} onChange={e => setBulkFilters(prev => ({ ...prev, brand: e.target.value }))}>
                                            <option value="">TÜMÜ</option>
                                            {Array.from(new Set(products.map(p => p.brand).filter(Boolean))).sort().map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Para Birimi</label>
                                        <select className="form-select" value={bulkFilters.currency} onChange={e => setBulkFilters(prev => ({ ...prev, currency: e.target.value }))}>
                                            <option value="">TÜMÜ</option>
                                            <option value="TRY">TRY (₺)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                    💡 İpucu: Birden fazla filtreyi aynı anda kullanabilirsiniz.
                                </div>
                            </div>

                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: 16, borderRadius: 12, border: '1px solid #10b98133', marginBottom: 24 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 12, textTransform: 'uppercase' }}>2. Adım: Güncelle (Ne Değişecek?)</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: '#059669', fontWeight: 600 }}>Yeni Kâr Oranı (%)</label>
                                        <input className="form-input" type="number" step="0.01" value={bulkUpdates.profit_margin} onChange={e => setBulkUpdates(prev => ({ ...prev, profit_margin: e.target.value }))} placeholder="Örn: 50" />
                                    </div>

                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                                    💡 Sadece değiştirmek istediğiniz alanı doldurun, diğerini boş bırakın.
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || !bulkUpdates.profit_margin} style={{ background: '#10b981', borderColor: '#059669' }}>
                                    {saving ? 'Güncelleniyor...' : 'Seçili Ürünleri Güncelle 🚀'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

