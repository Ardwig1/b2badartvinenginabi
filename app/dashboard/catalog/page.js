'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getUserDiscount } from '../actions';
import { ShoppingCartIcon, PhotoIcon, CubeIcon, StarIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useCart } from '@/components/CartProvider';

const STOCK_STATUS = {
    'in_stock': { label: 'Var', color: '#16a34a', bg: '#dcfce7', dot: '🟢' },
    'low_stock': { label: 'Az Var', color: '#ca8a04', bg: '#fef9c3', dot: '🟡' },
    'on_the_way': { label: 'Yolda', color: '#db2777', bg: '#fce7f3', dot: '🩷' },
    'out_of_stock': { label: 'Yok', color: '#dc2626', bg: '#fee2e2', dot: '🔴' },
    'special': { label: 'Özel Sipariş', color: '#7c3aed', bg: '#ede9fe', dot: '⭐' },
};

function getStockStatus(qty) {
    if (qty > 10) return 'in_stock';
    if (qty > 0) return 'low_stock';
    return 'out_of_stock';
}

export default function DealerCatalog() {
    const [products, setProducts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [hasSearched, setHasSearched] = useState(false);
    const [viewMode, setViewMode] = useState('catalog'); // 'catalog' = görselsiz kompakt, 'list' = görselli
    const perPage = viewMode === 'list' ? 15 : 10;
    const [pageImagesLoading, setPageImagesLoading] = useState(false);
    const [discountPercent, setDiscount] = useState(0);
    const [globalMargin, setGlobalMargin] = useState(36);
    const [globalUsdRate, setGlobalUsdRate] = useState(0);
    const [globalUsdActive, setGlobalUsdActive] = useState(false);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [toast, setToast] = useState('');
    const { cartItems: cartQtys, setQty: ctxSetQty, addToCart: ctxAddToCart } = useCart();
    const [userId, setUserId] = useState(null);

    // Hover Tooltip State
    const [hoveredRow, setHoveredRow] = useState(null);
    const hoverTimeoutRef = useRef(null);
    const mousePosRef = useRef({ x: 0, y: 0 });

    const handleRowMouseEnter = (e, p) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredRow({ product: p, x: mousePosRef.current.x, y: mousePosRef.current.y });
        }, 1000);
    };

    const handleRowMouseMove = (e, p) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        if (hoveredRow && hoveredRow.product.id === p.id) {
            setHoveredRow(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
        }
    };

    const handleRowMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredRow(null);
    };

    // Filters
    const [brands, setBrands] = useState([]);
    const [carBrands, setCarBrands] = useState([]);
    const [carModels, setCarModels] = useState([]);
    const [filterBrand, setFilterBrand] = useState('');
    const [filterCarBrand, setFilterCarBrand] = useState('');
    const [filterCarModel, setFilterCarModel] = useState('');
    const [filterText, setFilterText] = useState('');
    const [checkIn, setCheckIn] = useState(false);
    const [checkLow, setCheckLow] = useState(false);
    const [checkWay, setCheckWay] = useState(false);
    const [checkNew, setCheckNew] = useState(false);
    const [checkCampaign, setCheckCampaign] = useState(false);

    const supabase = createClient();

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const fetchSettingsAndFilters = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);

        if (user?.id) {
            const disc = await getUserDiscount(user.id);
            setDiscount(disc || 0);
        }

        // Fetch just the distinct brands and car_brands/car_models for the dropdowns
        // Because Supabase 'distinct' isn't natively supported, we'll fetch a lightweight list
        // of unique brands from a custom RPC or just limit the columns if the table isn't massive.
        // For now, let's fetch a list of distinct metadata to populate the dropdowns.
        const { data: metaData } = await supabase
            .from('products')
            .select('brand, car_brand, car_model')
            .eq('is_active', true);

        if (metaData) {
            setBrands([...new Set(metaData.map(p => p.brand).filter(Boolean))].sort());
            setCarBrands([...new Set(metaData.map(p => p.car_brand).filter(Boolean))].sort());
            // We'll set all possible car models for the current filter down below
        }

        try {
            const res = await fetch('/api/rates');
            const data = await res.json();
            if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
        } catch (e) {
            console.error('Rates fetch error:', e);
        }

        try {
            const [marginRes, usdRes] = await Promise.all([
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings')
            ]);
            const marginData = await marginRes.json();
            const usdData = await usdRes.json();

            if (marginData?.margin !== undefined) {
                setGlobalMargin(marginData.margin);
            }
            if (usdData?.usd_rate !== undefined) {
                setGlobalUsdRate(usdData.usd_rate);
            }
            if (usdData?.is_active !== undefined) {
                setGlobalUsdActive(usdData.is_active);
            }
        } catch (e) {
            console.error('Settings fetch error:', e);
        }

        setLoading(false);
    }, []);

    useEffect(() => { fetchSettingsAndFilters(); }, [fetchSettingsAndFilters]);

    // This fetching only happens on manual search.
    const searchProducts = async (e) => {
        if (e && e.key && e.key !== 'Enter') return;

        if (!filterText.trim() && !filterBrand && !filterCarBrand && !filterCarModel && !checkIn && !checkLow && !checkWay && !checkNew && !checkCampaign) {
            setProducts([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setCurrentPage(1);

        try {
            let query = supabase.from('products').select('*').eq('is_active', true);

            // Text search
            if (filterText.trim()) {
                const term = `%${filterText.trim()}%`;
                query = query.or(`name.ilike.${term},code.ilike.${term},product_number.ilike.${term},oem_no.ilike.${term},brand.ilike.${term}`);
            }

            // Dropdown filters
            if (filterBrand) query = query.eq('brand', filterBrand);
            if (filterCarBrand) query = query.eq('car_brand', filterCarBrand);
            if (filterCarModel) query = query.eq('car_model', filterCarModel);

            // Note: We'll fetch the matching set, then apply the client-side checkboxes in the `filtered` variable,
            // because querying custom dynamic stock logic in Supabase directly via REST filter is tricky (e.g., checkIn, checkWay).
            const { data, error } = await query.order('brand').order('name');
            if (error) throw error;

            setProducts(data || []);
        } catch (err) {
            console.error('Search error:', err);
            showToast('Ürünler yüklenirken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    // Update car models when car brand changes based on API fetch (or skip for now, since we don't have all data. We'll use a hack to fetch car models when carbrand is selected)
    useEffect(() => {
        if (!filterCarBrand) { setCarModels([]); setFilterCarModel(''); return; }
        // Fetch model list for this car brand directly
        supabase.from('products')
            .select('car_model')
            .eq('car_brand', filterCarBrand)
            .eq('is_active', true)
            .then(({ data }) => {
                if (data) setCarModels([...new Set(data.map(p => p.car_model).filter(Boolean))].sort());
                setFilterCarModel('');
            });
    }, [filterCarBrand, supabase]);

    const getBaseTryPrice = (p) => {
        let initialPrice = Number(p.list_price) || 0;
        // The list_price natively includes a 36% margin. We reverse it out, and apply the new dynamic margin.
        let rawCost = initialPrice / 1.36;
        let currentPrice = rawCost * (1 + (globalMargin / 100));

        // B2B USD Mantığı:
        // Eğer global olarak USD Sabitleme açıksa ve geçerli bir kur varsa (sıfır dahil),
        // SADECE USD bazlı ürünlerin fiyatını adminin belirlediği kurla TRY olarak renderla.
        if (globalUsdActive && globalUsdRate !== null && globalUsdRate >= 0 && p.currency === 'USD') {
            currentPrice = currentPrice * globalUsdRate;
        } else {
            if (p.currency === 'USD') currentPrice = currentPrice * rates.USD;
            else if (p.currency === 'EUR') currentPrice = currentPrice * rates.EUR;
        }

        return currentPrice;
    };

    const getDiscountedPrice = (p) => {
        const basePrice = getBaseTryPrice(p);
        const productDiscount = Number(p.discount_rate) || 0;
        const groupDiscount = discountPercent || 0;
        // Apply product discount first, then group discount
        const afterProductDiscount = basePrice * (1 - productDiscount / 100);
        const afterGroupDiscount = afterProductDiscount * (1 - groupDiscount / 100);
        return afterGroupDiscount;
    };

    const getKdvPrice = (p) => {
        return getDiscountedPrice(p) * 1.20;
    };

    const filtered = products.filter(p => {
        // We already server-side filtered branding, car brand, car model, and text, so we only need to filter stock, new, campaign, follows here
        const st = getStockStatus(p.stock_quantity);
        if (checkIn && st !== 'in_stock') return false;
        if (checkLow && st !== 'low_stock') return false;
        if (checkWay && p.stock_status !== 'on_the_way') return false;
        if (checkNew && !p.is_new) return false;
        if (checkCampaign && !p.is_campaign) return false;
        return true;
    });

    const currentChunk = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
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

    const addToCart = (p) => {
        ctxAddToCart(p);
        showToast(`${p.name} sepete eklendi`);
    };
    const setQty = (p, val) => {
        const n = parseInt(val, 10);
        ctxSetQty(p.id, p, isNaN(n) ? 0 : n);
    };
    const safeCartQtys = cartQtys || {};
    const totalCartItems = Object.values(safeCartQtys).reduce((a, b) => a + (b.qty || 0), 0);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterBrand, filterCarBrand, filterCarModel, filterText, checkIn, checkLow, checkWay, checkNew, checkCampaign]);

    const clearFilters = () => {
        setFilterBrand(''); setFilterCarBrand(''); setFilterCarModel(''); setFilterText('');
        setCheckIn(false); setCheckLow(false); setCheckWay(false); setCheckNew(false); setCheckCampaign(false);
        setProducts([]);
        setHasSearched(false);
        setCurrentPage(1);
    };

    const openCatalogPrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { showToast('Pop-up engellendi, lütfen izin verin'); return; }
        const rows = filtered.map(p => `
            <tr>
                <td>${p.code || ''}</td>
                <td>${p.name || ''}</td>
                <td>${p.brand || ''}</td>
                <td>${p.unit || 'AD'}</td>
                <td style="text-align:right">₺${getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td style="text-align:center">${p.stock_merkez > 0 ? '✅' : '❌'}</td>
                <td style="text-align:center">${p.stock_depo > 0 ? '✅' : '❌'}</td>
                <td style="text-align:center">${p.box_quantity || 1}</td>
            </tr>
        `).join('');
        printWindow.document.write(`<!DOCTYPE html><html><head><title>OMİ GROUPS - Ürün Kataloğu</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { text-align: center; margin-bottom: 8px; }
            p { text-align: center; color: #666; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { background: #1e40af; color: white; padding: 8px 12px; text-align: left; }
            td { padding: 6px 12px; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) { background: #f8f8f8; }
            @media print { body { padding: 0; } }
        </style></head><body>
        <h1>OMİ GROUPS - Ürün Kataloğu</h1>
        <p>${filtered.length} ürün • ${new Date().toLocaleDateString('tr-TR')}</p>
        <table>
            <thead><tr>
                <th>Stok Kodu</th><th>Ürün Adı</th><th>Marka</th><th>Birim</th><th>Fiyat (KDV Dahil)</th><th>İstanbul</th><th>Depo</th><th>Koli</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <script>setTimeout(()=>window.print(),500)</script>
        </body></html>`);
        printWindow.document.close();
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürün Arama</h1>
                    <p className="page-subtitle">{hasSearched ? `${filtered.length} ürün bulundu` : 'Ürün aramak için filtreleri kullanın'} • %{discountPercent} iskonto</p>
                </div>
                <a href="/dashboard/cart" className="btn btn-primary" id="go-cart" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingCartIcon style={{ width: 18, height: 18 }} /> Sepet {totalCartItems > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999, padding: '1px 8px', fontSize: 12 }}>{totalCartItems}</span>}
                </a>
            </div>

            {/* Search Panel */}
            <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                {/* Filter Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid var(--border)' }}>
                    {/* Left: dropdowns */}
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                        {[
                            { label: 'Marka', value: filterBrand, set: setFilterBrand, opts: brands },
                            { label: 'Araç Marka', value: filterCarBrand, set: setFilterCarBrand, opts: carBrands },
                            { label: 'Araç Model', value: filterCarModel, set: setFilterCarModel, opts: carModels },
                        ].map(({ label, value, set, opts }) => (
                            <div key={label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>{label}</div>
                                <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center' }}>
                                    <select className="form-select" style={{ border: 'none', background: 'transparent', fontSize: 13, flex: 1 }} value={value} onChange={e => set(e.target.value)}>
                                        <option value="">HEPSİ</option>
                                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}

                        {/* Genel Arama */}
                        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                            <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>Genel Arama</div>
                            <div style={{ background: '#fef08a', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: 13, outline: 'none', color: '#000' }}
                                    placeholder="Ara... (Enter'a basın)"
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
                                    onKeyDown={searchProducts}
                                    id="catalog-search"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right: checkboxes */}
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { label: 'Kampanya', val: checkCampaign, set: setCheckCampaign },
                            { label: 'Stokta Olanlar', val: checkIn, set: setCheckIn },
                            { label: 'Az Var', val: checkLow, set: setCheckLow },
                            { label: 'Yolda Olanlar', val: checkWay, set: setCheckWay },
                            { label: 'Yeni Ürün', val: checkNew, set: setCheckNew },
                        ].map(({ label, val, set }) => (
                            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ width: 16, height: 16 }} />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Action bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', background: 'var(--bg-secondary)' }}>
                    <button className="btn btn-primary" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={() => searchProducts()} id="search-btn">Ara</button>
                    <button className="btn btn-danger" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={clearFilters} id="clear-btn">Temizle</button>
                    <button className="btn btn-ghost" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px', background: '#1e293b', color: '#fff' }} onClick={() => { setViewMode(prev => prev === 'catalog' ? 'list' : 'catalog'); setCurrentPage(1); }} id="catalog-btn">{viewMode === 'catalog' ? '🖼️ Liste' : '📊 Katalog'}</button>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a' }} />
                    </div>
                </div>
            </div>

            {/* Results Table */}
            {loading || pageImagesLoading ? (
                <div className="card" style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                    <div style={{ marginTop: 16, fontWeight: 600, color: 'var(--primary)' }}>
                        {pageImagesLoading ? 'Katalog Görselleri Yükleniyor...' : 'Yükleniyor...'}
                    </div>
                </div>
            ) : !hasSearched ? (
                <div className="card" style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--text-muted)' }}>
                        <MagnifyingGlassIcon style={{ width: 32, height: 32 }} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        Katalogda Arama Yapın
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, textAlign: 'center' }}>
                        Lütfen ilgili filtreleme seçeneklerini doldurup veya genel arama kısmına yazıp "Ara" düğmesine basın.
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon"><CubeIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Ürün bulunamadı</div></div></div>
            ) : viewMode === 'list' ? (
                /* ========== LİSTE MODU: Trendyol-style Card Grid ========== */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                    {filtered.slice((currentPage - 1) * perPage, currentPage * perPage).map(p => {
                        const isOutOfStock = !(p.stock_merkez > 0 || p.stock_depo > 0);
                        const isFollowed = follows.has(p.id);
                        return (
                            <div key={p.id} style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default',
                                position: 'relative'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; handleRowMouseEnter(e, p); }}
                                onMouseMove={e => handleRowMouseMove(e, p)}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; handleRowMouseLeave(); }}
                            >
                                {/* Ürün Görseli */}
                                <div style={{ width: '100%', aspectRatio: '1/1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                                    {p.image_url ? (
                                        <img src={p.image_url} alt={p.name || 'Ürün'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                                    ) : (
                                        <CubeIcon style={{ width: 48, height: 48, color: '#ccc' }} />
                                    )}
                                </div>

                                {/* Stok Kodu */}
                                <div style={{ padding: '8px 10px 0', fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.code || '-'}
                                </div>

                                {/* Ürün Adı */}
                                <div style={{ padding: '4px 10px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minHeight: 34, lineHeight: '17px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                    {p.name}
                                </div>

                                {/* Marka + Birim */}
                                <div style={{ padding: '4px 10px 0', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>{p.brand || '-'}</span>
                                    <span>{p.unit || 'AD'}</span>
                                </div>

                                {/* Fiyat */}
                                <div style={{ padding: '6px 10px 0', fontSize: 16, fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                                    ₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                                <div style={{ padding: '0 10px', fontSize: 10, color: 'var(--text-muted)' }}>KDV Dahil</div>

                                {/* Stok durumu */}
                                <div style={{ padding: '6px 10px 0', display: 'flex', gap: 8, fontSize: 11 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.stock_merkez > 0 ? '#16a34a' : '#dc2626' }} />
                                        İst.
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.stock_depo > 0 ? '#16a34a' : '#dc2626' }} />
                                        Depo
                                    </span>
                                </div>

                                {/* Sepet */}
                                <div style={{ padding: '8px 10px 10px', marginTop: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input
                                        type="number" min="0"
                                        value={safeCartQtys[p.id]?.qty || ''}
                                        onChange={e => setQty(p, e.target.value)}
                                        style={{ width: 44, padding: '4px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 12 }}
                                    />
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => { if ((safeCartQtys[p.id]?.qty || 0) === 0) setQty(p, 1); else addToCart(p); }}
                                        disabled={isOutOfStock}
                                        style={{ flex: 1, opacity: isOutOfStock ? 0.4 : 1, fontSize: 12, padding: '6px 0' }}
                                    >
                                        {isOutOfStock ? 'Yok' : '🛒 Ekle'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ========== KATALOG MODU: Kompakt Tablo (görselsiz) ========== */
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Marka</th>
                                <th>Stok Kodu</th>
                                <th>OEM No</th>
                                <th>Ürün Adı</th>
                                <th>Birim</th>
                                <th style={{ textAlign: 'center' }}>İskonto</th>
                                <th style={{ textAlign: 'right' }}>Fiyat (KDV Dahil)</th>
                                <th style={{ textAlign: 'center' }}>İstanbul</th>
                                <th style={{ textAlign: 'center' }}>Depo</th>
                                <th style={{ textAlign: 'center' }}>Koli Ad.</th>
                                <th style={{ width: 80 }}>Sip.Mik.</th>
                                <th>Sepete At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice((currentPage - 1) * perPage, currentPage * perPage).map(p => {
                                const isOutOfStock = !(p.stock_merkez > 0 || p.stock_depo > 0);
                                return (
                                    <tr key={p.id}
                                        onMouseEnter={(e) => handleRowMouseEnter(e, p)}
                                        onMouseMove={(e) => handleRowMouseMove(e, p)}
                                        onMouseLeave={handleRowMouseLeave}
                                    >
                                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.brand || '-'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{p.code}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.oem_no || '-'}</td>
                                        <td style={{ fontWeight: 500, maxWidth: 220 }}>{p.name}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.unit || 'AD'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>%{discountPercent}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                            <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block', cursor: 'grab', color: 'var(--primary)', fontWeight: 700 }}>
                                                ₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                <div className="tooltip-content price-tooltip">
                                                    <div style={{ textAlign: 'left', minWidth: 240, padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Liste Fiyatı:</span>
                                                            <span style={{ fontSize: 12 }}>
                                                                {Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {p.currency || 'TRY'}
                                                                {p.currency && p.currency !== 'TRY' && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textAlign: 'right' }}>(₺{((Number(p.list_price) / 1.36) * (1 + (globalMargin / 100)) * rates[p.currency]).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})</span>}
                                                            </span>
                                                        </div>
                                                        {Number(p.discount_rate) > 0 && (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Ürün İskontosu ({p.discount_rate}%):</span>
                                                                <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                                                                    -₺{(getBaseTryPrice(p) * Number(p.discount_rate) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {discountPercent > 0 && (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Grup İskontosu ({discountPercent}%):</span>
                                                                <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                                                                    -₺{(getBaseTryPrice(p) * (1 - Number(p.discount_rate || 0) / 100) * discountPercent / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>İskontolu Fiyat:</span>
                                                            <span style={{ fontWeight: 600, fontSize: 13 }}>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--primary)', paddingTop: 8, marginTop: 4 }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>KDV Dahil (%20):</span>
                                                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.stock_merkez > 15 ? '#16a34a' : p.stock_merkez > 0 ? 'conic-gradient(#16a34a 0deg, #16a34a 180deg, rgba(255,255,255,0.15) 180deg, rgba(255,255,255,0.15) 360deg)' : '#dc2626', margin: '0 auto', boxShadow: '0 0 6px rgba(0,0,0,0.2)', border: p.stock_merkez > 0 && p.stock_merkez <= 15 ? '1px solid rgba(22,163,74,0.4)' : 'none' }} title={p.stock_merkez > 15 ? 'Stokta' : p.stock_merkez > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.stock_depo > 15 ? '#16a34a' : p.stock_depo > 0 ? 'conic-gradient(#16a34a 0deg, #16a34a 180deg, rgba(255,255,255,0.15) 180deg, rgba(255,255,255,0.15) 360deg)' : '#dc2626', margin: '0 auto', boxShadow: '0 0 6px rgba(0,0,0,0.2)', border: p.stock_depo > 0 && p.stock_depo <= 15 ? '1px solid rgba(22,163,74,0.4)' : 'none' }} title={p.stock_depo > 15 ? 'Stokta' : p.stock_depo > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 500 }}>{p.box_quantity || 1}</td>
                                        <td>
                                            <input
                                                type="number" min="0"
                                                value={safeCartQtys[p.id]?.qty || ''}
                                                onChange={e => setQty(p, e.target.value)}
                                                style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 13 }}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => { if ((safeCartQtys[p.id]?.qty || 0) === 0) setQty(p, 1); else addToCart(p); }}
                                                disabled={isOutOfStock}
                                                style={{ opacity: isOutOfStock ? 0.4 : 1, whiteSpace: 'nowrap' }}
                                            >
                                                {isOutOfStock ? 'Stok Yok' : '🛒 Ekle'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {!loading && hasSearched && filtered.length > perPage && (
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
                        Sayfa {currentPage} / {Math.ceil(filtered.length / perPage)}
                    </span>

                    <button
                        className="btn btn-ghost"
                        disabled={currentPage === Math.ceil(filtered.length / perPage)}
                        onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        style={{ border: '1px solid var(--border)', background: currentPage === Math.ceil(filtered.length / perPage) ? 'var(--bg-secondary)' : '#fff', opacity: currentPage === Math.ceil(filtered.length / perPage) ? 0.5 : 1, cursor: currentPage === Math.ceil(filtered.length / perPage) ? 'not-allowed' : 'pointer' }}
                    >
                        Sonraki
                    </button>
                </div>
            )}

            {hoveredRow && (
                <div style={{
                    position: 'fixed',
                    left: Math.min(hoveredRow.x + 15, typeof window !== 'undefined' ? window.innerWidth - 300 : 0),
                    top: Math.min(hoveredRow.y + 15, typeof window !== 'undefined' ? window.innerHeight - 200 : 0),
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    padding: '16px',
                    borderRadius: '8px',
                    zIndex: 99999,
                    minWidth: '260px',
                    pointerEvents: 'none',
                    fontSize: 13,
                    color: 'var(--text-primary)'
                }}>
                    {(() => {
                        const hp = hoveredRow.product;
                        const activeUsdRate = globalUsdActive && globalUsdRate > 0 ? globalUsdRate : (rates?.USD || 1);
                        const netTl = getDiscountedPrice(hp);
                        const netTlKdv = getKdvPrice(hp);
                        const netUsd = netTl / activeUsdRate;
                        const netUsdKdv = netTlKdv / activeUsdRate;

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Net Fiyat ($)</span>
                                    <span>: ${netUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Net Fiyat KDV Dahil ($)</span>
                                    <span>: ${netUsdKdv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Net Fiyat (₺)</span>
                                    <span>: ₺{netTl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600 }}>Net Fiyat KDV Dahil (₺)</span>
                                    <span>: ₺{netTlKdv.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', textAlign: 'center' }}>
                                    {hp.id}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {toast && <div className="toast toast-success">✓ {toast}</div>}
        </div>
    );
}
