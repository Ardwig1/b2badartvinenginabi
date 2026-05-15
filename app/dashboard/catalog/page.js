'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ShoppingCartIcon, PhotoIcon, CubeIcon, MagnifyingGlassIcon, XMarkIcon, PlusIcon, MinusIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';

const getCircleStyle = (qty, size = 16) => {
    let bg, border, boxShadow, color = '#fff';
    if (qty > 15) { bg = 'linear-gradient(135deg, #22c55e, #15803d)'; border = '1px solid #14532d'; boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`; }
    else if (qty > 5) { bg = 'linear-gradient(90deg, #22c55e 50%, #475569 50%)'; border = '1px solid #1e293b'; boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.5), inset 0 2px 4px rgba(255,255,255,0.2)`; }
    else if (qty > 0) { bg = 'transparent'; border = 'none'; boxShadow = 'none'; color = '#2563eb'; }
    else { bg = 'linear-gradient(135deg, #ef4444, #991b1b)'; border = '1px solid #7f1d1d'; boxShadow = `0 0 ${size / 2}px rgba(239, 68, 68, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`; }
    return { 
        width: size, height: size, borderRadius: '50%', background: bg, border, boxShadow, margin: '0 auto', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontSize: size > 12 ? '16px' : '14px', fontWeight: '900', lineHeight: 1
    };
};

export default function DealerCatalog() {
    const [products, setProducts] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [pageImagesLoading, setPageImagesLoading] = useState(false);
    const isSearchingRef = useRef(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [viewMode, setViewMode] = useState('catalog');
    const perPage = viewMode === 'list' ? 15 : 10;
    const [selectedImage, setSelectedImage] = useState(null);
    const [discountPercent, setDiscount] = useState(0);
    const [priceGroup, setPriceGroup] = useState(null);
    const [globalMargin, setGlobalMargin] = useState(0); // Default to 0 for dealers
    const [globalUsdRate, setGlobalUsdRate] = useState(0);
    const [globalUsdActive, setGlobalUsdActive] = useState(false);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [toast, setToast] = useState('');
    const { cartItems: cartQtys, setQty: ctxSetQty } = useCart();
    const [pendingQtys, setPendingQtys] = useState({});
    
    // Hover Tooltip States
    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoveredPriceTooltip, setHoveredPriceTooltip] = useState(null);

    const [brands, setBrands] = useState([]);
    const [carBrands, setCarBrands] = useState([]);
    const [carModels, setCarModels] = useState([]);
    const [filterBrand, setFilterBrand] = useState('');
    const [filterCarBrand, setFilterCarBrand] = useState('');
    const [filterCarModel, setFilterCarModel] = useState('');
    const [filterText, setFilterText] = useState('');
    const [checkIn, setCheckIn] = useState(false);
    const [checkLow, setCheckLow] = useState(false);
    const [checkNew, setCheckNew] = useState(false);
    const [checkCampaign, setCheckCampaign] = useState(false);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const infoRes = await fetch(`/api/user/info?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' });
            if (infoRes.ok) {
                const data = await infoRes.json();
                setDiscount(Number(data.discountPercent) || 0);
                setPriceGroup(data.priceGroup || null);
            }
            const metaRes = await fetch('/api/products/metadata');
            if (metaRes.ok) { const data = await metaRes.json(); setBrands(data.brands || []); setCarBrands(data.carBrands || []); }
            const [ratesRes, usdRes] = await Promise.all([fetch('/api/rates'), fetch('/api/admin/usd-settings')]);
            if (ratesRes.ok) { const d = await ratesRes.json(); setRates({ USD: d.USD || 1, EUR: d.EUR || 1 }); }
            if (usdRes.ok) { const d = await usdRes.json(); setGlobalUsdRate(d.usd_rate || 0); setGlobalUsdActive(d.is_active || false); }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const searchProducts = async (e) => {
        if (e && e.key && e.key !== 'Enter') return;
        if (!filterText.trim() && !filterBrand && !filterCarBrand && !filterCarModel && !checkIn && !checkLow && !checkNew && !checkCampaign) {
            alert('Lütfen arama yapmak için en az bir filtre seçin.');
            return;
        }
        isSearchingRef.current = true;
        setLoading(true); setHasSearched(true); setCurrentPage(1);
        try {
            const response = await fetch('/api/products/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filterText: filterText.trim(), brand: filterBrand, carBrand: filterCarBrand, carModel: filterCarModel, is_new: checkNew, is_campaign: checkCampaign }) });
            const data = await response.json();
            setProducts(data || []);

            // LOG ACTIVITY: SEARCH (Including all filter states)
            fetch('/api/log-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action_type: 'search',
                    details: { 
                        text: filterText.trim(), 
                        brand: filterBrand, 
                        carBrand: filterCarBrand, 
                        carModel: filterCarModel,
                        is_campaign: checkCampaign,
                        is_new: checkNew,
                        in_stock: checkIn,
                        low_stock: checkLow
                    }
                })
            }).catch(e => console.error('Log search error:', e));
        } catch (err) { console.error(err); } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => {
        setProducts([]);
        setHasSearched(false);
        setCurrentPage(1);
    }, [filterBrand, filterCarBrand, filterCarModel, filterText, checkIn, checkLow, checkNew, checkCampaign]);

    useEffect(() => {
        if (!filterCarBrand) { setCarModels([]); setFilterCarModel(''); return; }
        fetch(`/api/products/metadata?carBrand=${encodeURIComponent(filterCarBrand)}`).then(res => res.json()).then(data => { setCarModels(data.carModels || []); setFilterCarModel(''); });
    }, [filterCarBrand]);

    const getBaseTryPrice = (p) => {
        let price = Number(p.list_price) || 0;
        // Apply globalMargin as an additional markup if it's set (showroom mode)
        if (globalMargin > 0) {
            price = price * (1 + (globalMargin / 100));
        }

        if (globalUsdActive && globalUsdRate > 0 && p.currency === 'USD') price = price * globalUsdRate;
        else { 
            if (p.currency === 'USD') price = price * (rates.USD || 1); 
            else if (p.currency === 'EUR') price = price * (rates.EUR || 1); 
        }
        return price;
    };

    const getDiscountedPrice = (p) => {
        if (p.is_fixed_price && p.fixed_price_value > 0) {
            let price = Number(p.fixed_price_value);
            const cur = p.fixed_price_currency || 'TRY';
            if (cur === 'USD' && rates?.USD) price *= rates.USD;
            else if (cur === 'EUR' && rates?.EUR) price *= rates.EUR;
            return price;
        }
        const base = getBaseTryPrice(p);
        let effectiveGroupDiscount = discountPercent;
        if (priceGroup?.rules && p.supplier_brand) {
            const rule = priceGroup.rules[p.supplier_brand];
            if (rule !== undefined) effectiveGroupDiscount = Number(rule);
        }
        return base * (1 - (Number(p.discount_rate) || 0) / 100) * (1 - effectiveGroupDiscount / 100);
    };

    const getKdvPrice = (p) => getDiscountedPrice(p) * 1.20;

    const getEffectiveDiscount = (p) => {
        if (p.is_fixed_price) return '-';
        if (priceGroup?.rules && p.supplier_brand) {
            const rule = priceGroup.rules[p.supplier_brand];
            if (rule !== undefined) return `%${rule}`;
        }
        return `%${discountPercent}`;
    };

    const filtered = useMemo(() => {
        return products.filter(p => {
            if (checkIn && !(p.stock_merkez > 0 || p.stock_depo > 0)) return false;
            if (checkLow) { if (!((p.stock_merkez > 0 && p.stock_merkez <= 15) || (p.stock_depo > 0 && p.stock_depo <= 15))) return false; }
            if (checkCampaign && !p.is_campaign) return false;
            return true;
        });
    }, [products, checkIn, checkLow, checkCampaign]);

    const perPageItems = useMemo(() => filtered.slice((currentPage - 1) * perPage, currentPage * perPage), [filtered, currentPage, perPage]);

    useEffect(() => {
        const urls = perPageItems.map(p => p.image_url).filter(Boolean);
        if (urls.length === 0) { 
            setPageImagesLoading(false); 
            isSearchingRef.current = false;
            return; 
        }
        
        setPageImagesLoading(true);
        let loadedCount = 0;
        const total = urls.length;
        const timeout = setTimeout(() => { 
            setPageImagesLoading(false); 
            isSearchingRef.current = false;
        }, 1500);

        urls.forEach(url => {
            const img = new window.Image();
            img.onload = img.onerror = () => {
                loadedCount++;
                if (loadedCount === total) { 
                    clearTimeout(timeout); 
                    setPageImagesLoading(false); 
                    isSearchingRef.current = false;
                }
            };
            img.src = url;
        });
        return () => clearTimeout(timeout);
    }, [perPageItems]);

    const handleAddToCart = (p) => {
        const raw = pendingQtys[p.id] || '1';
        const n = parseInt(raw, 10);
        if (isNaN(n) || n < 1) return;
        ctxSetQty(p.id, p, (cartQtys[p.id]?.qty || 0) + n);

        fetch('/api/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action_type: 'cart_add',
                details: { id: p.id, name: p.name, code: p.code, oem_no: p.oem_no, qty: n }
            })
        }).catch(e => console.error('Log cart error:', e));

        setPendingQtys(prev => { const next = { ...prev }; delete next[p.id]; return next; });
        showToast(`${p.name} eklendi.`);
    };

    return (
        <div className="page-wrapper catalog-page">
            <div className="shipping-banner">📦 SAAT 16:00’A KADAR VERİLEN SİPARİŞLER AYNI GÜN KARGO’DA 🚚</div>
            <div className="stock-warning" style={{ marginBottom: 8 }}>🚨 ÖDEME ÖNCESİ STOK TEYİTİ İÇİN İLETİŞİME GEÇEBİLİRSİNİZ 🚨</div>
            <div className="stock-warning">⚠️ DEPO İSTANBUL DIŞINDADIR - DEPO’DA OLAN ÜRÜNLER KARGO İLE GÖNDERİLMEKTEDİR ⚠️</div>

            <div className="page-header">
                <div><h1 className="page-title">Ürün Arama</h1><p className="page-subtitle">{hasSearched ? `${filtered.length} ürün bulundu` : 'Ürün aramak için filtreleri kullanın'} • %{discountPercent} iskonto</p></div>
                <a href="/dashboard/cart" className="btn btn-primary cart-link">
                    <ShoppingCartIcon style={{ width: 18 }} /> Sepet {Object.values(cartQtys || {}).reduce((a, b) => a + (b.qty || 0), 0) > 0 && <span className="badge-qty">{Object.values(cartQtys || {}).reduce((a, b) => a + (b.qty || 0), 0)}</span>}
                </a>
            </div>

            <div className="card filter-card">
                <div className="filter-grid">
                    <div className="filter-inputs">
                        {[
                            { label: 'Marka', value: filterBrand, set: setFilterBrand, opts: brands },
                            { label: 'Araç Marka', value: filterCarBrand, set: setFilterCarBrand, opts: carBrands },
                            { label: 'Araç Model', value: filterCarModel, set: setFilterCarModel, opts: carModels },
                        ].map(({ label, value, set, opts }) => (
                            <div key={label} className="filter-row">
                                <div className="filter-label">{label}</div>
                                <div className="filter-control"><select value={value} onChange={e => set(e.target.value)}><option value="">HEPSİ</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
                            </div>
                        ))}
                        <div className="filter-row search-row">
                            <div className="filter-label">Genel Arama</div>
                            <div className="filter-control search-input"><input placeholder="Arama yapmak için 'far' veya '2K8941006B' gibi bir oem kodu yazın" value={filterText} onChange={e => setFilterText(e.target.value.toUpperCase())} onKeyDown={searchProducts} /></div>
                        </div>
                    </div>
                    <div className="filter-checks">
                        {[
                            { label: 'Kampanya', val: checkCampaign, set: setCheckCampaign },
                            { label: 'Stokta Olanlar', val: checkIn, set: setCheckIn },
                            { label: 'Az Var', val: checkLow, set: setCheckLow },
                            { label: 'Yeni Ürün', val: checkNew, set: setCheckNew },
                        ].map(({ label, val, set }) => (
                            <label key={label} className="check-item"><input type="checkbox" checked={val} onChange={e => set(e.target.checked)} /> {label}</label>
                        ))}
                    </div>
                </div>
                <div className="filter-actions">
                    <button className="btn btn-primary" onClick={() => searchProducts()}>Ara</button>
                    <button className="btn btn-danger" onClick={() => { setFilterBrand(''); setFilterCarBrand(''); setFilterCarModel(''); setFilterText(''); setProducts([]); setHasSearched(false); setCheckIn(false); setCheckLow(false); setCheckNew(false); setCheckCampaign(false); }}>Temizle</button>
                    <button className="btn btn-ghost dark-btn" onClick={() => setViewMode(v => v === 'catalog' ? 'list' : 'catalog')}>{viewMode === 'catalog' ? '🖼️ Liste' : '📊 Katalog'}</button>
                    <div className="status-indicator"><div className="status-dot" /></div>
                </div>
            </div>

            {loading || pageImagesLoading ? (
                <div className="card" style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                    <div style={{ marginTop: 16, fontWeight: 600, color: 'var(--primary)', textAlign: 'center' }}>
                        {loading ? 'Ürünler Aranıyor...' : 'Ürün Görselleri Hazırlanıyor...'}
                        {pageImagesLoading && (
                            <div style={{ marginTop: 12 }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { setPageImagesLoading(false); isSearchingRef.current = false; }} style={{ fontSize: 12, textDecoration: 'underline' }}>Beklemeden sonuçları gör</button>
                            </div>
                        )}
                    </div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card empty-card">{hasSearched ? 'Ürün bulunamadı' : 'Arama yapmak için kriterleri girin'}</div>
            ) : viewMode === 'list' ? (
                <div className="list-view-grid">
                    {perPageItems.map(p => (
                        <div key={p.id} className={`product-card ${p.is_campaign ? 'campaign' : ''}`}>
                            <div className="p-img" onClick={() => p.image_url && setSelectedImage({ url: p.image_url, name: p.name })}>{p.image_url ? <img src={p.image_url} loading="lazy" /> : <CubeIcon className="w-12 h-12 text-gray-300" />}</div>
                            <div className="p-details">
                                <div className="p-code" style={{ color: '#2563eb' }}>{p.code}</div>
                                <div className="p-name" style={{ color: p.is_campaign ? '#000' : 'inherit' }}>{p.name}</div>
                                <div className="p-brand-row"><span className="p-brand"><strong>Marka:</strong> {p.brand}</span><span><strong>Birim:</strong> {p.unit || 'AD'}</span></div>
                                <div className="p-price" onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredPriceTooltip({ product: p, x: r.left, y: r.top }); }} onMouseLeave={() => setHoveredPriceTooltip(null)}>₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                <div className="p-kdv">KDV Dahil</div>
                                <div className="p-stock"><div style={getCircleStyle(p.stock_merkez, 10)} /> İst. <div style={getCircleStyle(p.stock_depo, 10)} /> Depo</div>
                                <div className="p-action">
                                    <div className="p-qty"><button onClick={() => setPendingQtys(prev => ({ ...prev, [p.id]: Math.max(1, (parseInt(prev[p.id] || '1', 10) - 1)) }))}>-</button><input value={pendingQtys[p.id] ?? '1'} onChange={e => setPendingQtys(prev => ({ ...prev, [p.id]: e.target.value }))} /><button onClick={() => setPendingQtys(prev => ({ ...prev, [p.id]: (parseInt(prev[p.id] || '1', 10) + 1) }))}>+</button></div>
                                    <button className="btn btn-primary add-btn" onClick={() => handleAddToCart(p)}>🛒</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead><tr><th>MARKA</th><th>STOK KODU</th><th>OEM NO</th><th>ÜRÜN ADI</th><th style={{ textAlign: 'center' }}><PhotoIcon className="w-5" /></th><th>BİRİM</th><th>BAYİ İSK.</th><th>KAMPANYA</th><th>SEPETTE %</th><th style={{ textAlign: 'right' }}>FİYAT (KDV DAHİL)</th><th style={{ textAlign: 'center' }}>İSTANBUL</th><th style={{ textAlign: 'center' }}>DEPO</th><th>KOLİ AD.</th><th>SİP.MİK.</th><th>SEPETE AT</th></tr></thead>
                        <tbody>
                            {perPageItems.map(p => (
                                <tr key={p.id} className={p.is_campaign ? 'campaign-row' : ''}>
                                    <td data-label="Marka">{p.brand}</td>
                                    <td data-label="Stok Kodu" className="font-mono" style={{ color: p.is_campaign ? '#1e40af' : '#2563eb', fontWeight: 600 }}>{p.code}</td>
                                    <td data-label="OEM No" style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.oem_no || '-'}</td>
                                    <td data-label="Ürün Adı" className="font-bold">{p.name}</td>
                                    <td data-label="Resim" className="text-center">{p.image_url ? (<div style={{ cursor: 'zoom-in', display: 'flex', justifyContent: 'center' }} onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredImage({ url: p.image_url, x: r.left, y: r.top }); }} onMouseLeave={() => setHoveredImage(null)} onClick={() => setSelectedImage({ url: p.image_url, name: p.name })}><PhotoIcon style={{ width: 20, color: p.is_campaign ? '#1e40af' : '#2563eb' }} /></div>) : '-'}</td>
                                    <td data-label="Birim">{p.unit || 'AD'}</td>
                                    <td data-label="Bayi İsk." className="text-center" style={{ fontWeight: 800, color: '#2563eb' }}>{getEffectiveDiscount(p)}</td>
                                    <td data-label="Kampanya" className="text-center" style={{ fontWeight: 800, color: '#dc2626' }}>{Number(p.discount_rate) > 0 ? `%${p.discount_rate}` : '-'}</td>
                                    <td data-label="Sepette %" className="text-center" style={{ fontWeight: 800, color: '#16a34a' }}>{Number(p.cart_discount_rate) > 0 ? `%${p.cart_discount_rate}` : '-'}</td>
                                    <td data-label="Fiyat" className="text-right font-bold" style={{ fontWeight: 800, cursor: 'help', color: '#2563eb' }} onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredPriceTooltip({ product: p, x: r.left, y: r.top }); }} onMouseLeave={() => setHoveredPriceTooltip(null)}>₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                    <td data-label="İstanbul"><div style={getCircleStyle(p.stock_merkez, 14)}>{p.stock_merkez > 0 && p.stock_merkez <= 5 ? p.stock_merkez : ''}</div></td>
                                    <td data-label="Depo"><div style={getCircleStyle(p.stock_depo, 14)}>{p.stock_depo > 0 && p.stock_depo <= 5 ? p.stock_depo : ''}</div></td>
                                    <td data-label="Koli Ad." className="text-center">{p.box_quantity || 1}</td>
                                    <td data-label="Sip.Mik."><div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', height: 32 }}><button className="btn btn-ghost btn-sm" style={{ padding: '0 8px', height: '100%', borderRadius: 0, borderRight: '2px solid #000', fontSize: 16, color: '#000', fontWeight: 800 }} onClick={() => setPendingQtys(prev => ({ ...prev, [p.id]: Math.max(1, (parseInt(prev[p.id] || '1', 10) - 1)) }))}>−</button><input value={pendingQtys[p.id] ?? '1'} onChange={e => setPendingQtys(prev => ({ ...prev, [p.id]: e.target.value }))} style={{ width: 35, textAlign: 'center', border: 'none', fontWeight: 800, fontSize: 13, background: 'transparent', outline: 'none', color: '#000' }} /><button className="btn btn-ghost btn-sm" style={{ padding: '0 8px', height: '100%', borderRadius: 0, borderLeft: '2px solid #000', fontSize: 16, color: '#000', fontWeight: 800 }} onClick={() => setPendingQtys(prev => ({ ...prev, [p.id]: (parseInt(prev[p.id] || '1', 10) + 1) }))}>+</button></div></td>
                                    <td data-label="Sepete At">
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => handleAddToCart(p)} disabled={!(p.stock_merkez > 0 || p.stock_depo > 0)} style={{ whiteSpace: 'nowrap', minWidth: '80px', justifyContent: 'center' }}>{!(p.stock_merkez > 0 || p.stock_depo > 0) ? 'Yok' : '🛒 Ekle'}</button>
                                            <a href={`/dashboard/orders?tab=items&search=${p.code}`} className="btn btn-ghost btn-sm" style={{ background: '#475569', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>Geçmiş</a>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {filtered.length > perPage && (
                <div className="pagination">
                    <button className="btn btn-ghost" disabled={currentPage === 1} onClick={() => { setCurrentPage(prev => prev - 1); window.scrollTo({ top: 0 }); }}>Önceki</button>
                    <span>Sayfa {currentPage} / {Math.ceil(filtered.length / perPage)}</span>
                    <button className="btn btn-ghost" disabled={currentPage === Math.ceil(filtered.length / perPage)} onClick={() => { setCurrentPage(prev => prev + 1); window.scrollTo({ top: 0 }); }}>Sonraki</button>
                </div>
            )}

            {toast && <div className="toast toast-success">{toast}</div>}

            {hoveredImage && (
                <div style={{ position: 'fixed', left: Math.max(20, hoveredImage.x - 320), top: Math.max(20, hoveredImage.y - 150), width: 300, background: '#fff', border: '1px solid #ddd', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', borderRadius: '12px', zIndex: 999999, overflow: 'hidden', pointerEvents: 'none' }}><div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src={hoveredImage.url} style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }} /></div></div>
            )}

            {hoveredPriceTooltip && (
                <div style={{ position: 'fixed', left: Math.max(20, hoveredPriceTooltip.x - 280), top: Math.max(20, hoveredPriceTooltip.y - 140), zIndex: 999999, pointerEvents: 'none' }}>
                    <div style={{ textAlign: 'left', minWidth: 280, padding: '16px', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        {hoveredPriceTooltip.product.is_fixed_price ? (
                            <>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#60a5fa', marginBottom: 8, textTransform: 'uppercase' }}>📌 Sabit Fiyatlı Ürün</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #3b82f6', paddingTop: 10 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>KDV Dahil (%20):</span>
                                    <span style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>₺{getKdvPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 10 }}><span style={{ fontSize: 13, color: '#94a3b8' }}>Liste Fiyatı:</span><div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{Number(hoveredPriceTooltip.product.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {hoveredPriceTooltip.product.currency}</div>{hoveredPriceTooltip.product.currency !== 'TRY' && (<div style={{ fontSize: 11, color: '#94a3b8' }}>(₺{getBaseTryPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>)}</div></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Ürün İskontosu (%{hoveredPriceTooltip.product.discount_rate}):</span>
                                    <span style={{ fontSize: 13, color: '#f87171' }}>-₺{(getBaseTryPrice(hoveredPriceTooltip.product) * Number(hoveredPriceTooltip.product.discount_rate) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Grup İskontosu (%{discountPercent}):</span>
                                    <span style={{ fontSize: 13, color: '#f87171' }}>-₺{(getBaseTryPrice(hoveredPriceTooltip.product) * (1 - Number(hoveredPriceTooltip.product.discount_rate || 0) / 100) * discountPercent / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 13, color: '#94a3b8' }}>İskontolu Fiyat:</span><span style={{ fontSize: 14, fontWeight: 700 }}>₺{getDiscountedPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #3b82f6', paddingTop: 10, marginTop: 6 }}><span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>KDV Dahil (%20):</span><span style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>₺{getKdvPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {selectedImage && (
                <div className="img-modal-overlay" onClick={() => setSelectedImage(null)}><div className="img-modal-content" onClick={e => e.stopPropagation()}><button className="img-modal-close" onClick={() => setSelectedImage(null)}>✕</button><img src={selectedImage.url} alt={selectedImage.name} /><div className="img-modal-caption">{selectedImage.name}</div></div></div>
            )}

            <style jsx>{`
                .shipping-banner { background: linear-gradient(90deg, rgba(30,64,175,0.1), rgba(37,99,235,0.1)); border: 1px solid rgba(37,99,235,0.2); color: var(--primary); padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 8px; }
                .stock-warning { background: linear-gradient(90deg, rgba(185,28,28,0.1), rgba(220,38,38,0.1)); border: 1px solid rgba(220,38,38,0.2); color: #b91c1c; padding: 12px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 14px; margin-bottom: 20px; }
                .badge-qty { background: rgba(255,255,255,0.3); border-radius: 99px; padding: 1px 6px; font-size: 11px; }
                .filter-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--border); }
                .filter-inputs { border-right: 1px solid var(--border); }
                .filter-row { display: grid; grid-template-columns: 130px 1fr; border-bottom: 1px solid var(--border); }
                .filter-label { background: var(--primary); color: #fff; padding: 10px 16px; font-weight: 700; font-size: 13px; display: flex; align-items: center; }
                .filter-control { padding: 6px 12px; display: flex; background: #fff; }
                .filter-control select, .filter-control input { border: none; background: transparent; width: 100%; outline: none; font-size: 13px; color: #000; }
                .search-input { background: #fef08a !important; }
                .filter-checks { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
                .check-item { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 500; }
                .filter-actions { display: grid; grid-template-columns: 1fr 1fr 1fr auto; background: var(--bg-secondary); }
                .filter-actions button { border-radius: 0; padding: 12px; font-weight: 700; }
                .dark-btn { background: #1e293b !important; color: #fff !important; }
                .status-dot { width: 16px; height: 16px; border-radius: 50%; background: #16a34a; }
                .campaign-row, .campaign-row td { background: #fef08a !important; color: #000; }
                .list-view-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
                .product-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
                .product-card.campaign { background: #fef08a; border-color: #eab308; }
                .p-img { width: 100%; aspect-ratio: 1/1; background: #fff; display: flex; align-items: center; justifyContent: center; border-bottom: 1px solid var(--border); overflow: hidden; cursor: zoom-in; }
                .p-img img { width: 100%; height: 100%; object-fit: contain; padding: 8px; }
                .p-details { padding: 10px; flex: 1; display: flex; flex-direction: column; }
                .p-code { font-size: 11px; font-family: monospace; color: var(--primary); font-weight: 700; }
                .p-name { font-size: 12px; font-weight: 700; min-height: 34px; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
                .p-brand-row { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); }
                .p-price { font-size: 16px; font-weight: 800; color: var(--primary); font-family: monospace; margin-top: 4px; }
                .p-kdv { font-size: 10px; color: var(--text-muted); margin-bottom: 4px; }
                .p-stock { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; }
                .p-action { margin-top: auto; padding-top: 10px; display: flex; gap: 6px; }
                .p-qty { display: flex; align-items: center; background: #fff; border: 2px solid #000; borderRadius: 8px; height: 32px; overflow: hidden; }
                .p-qty button { border: none; background: none; padding: 0 8px; font-weight: 800; color: #000; }
                .p-qty input { width: 35px; border: none; text-align: center; font-weight: 800; font-size: 12px; outline: none; }
                .add-btn { flex: 1; height: 32px; padding: 0; }
                .pagination { display: flex; justify-content: center; align-items: center; padding: 24px 0; gap: 16px; }
                .img-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justifyContent: center; z-index: 1000000; backdrop-filter: blur(8px); cursor: zoom-out; }
                .img-modal-content { position: relative; width: 90vw; height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .img-modal-content img { max-width: 100%; max-height: 80vh; object-fit: contain; box-shadow: 0 0 50px rgba(0,0,0,0.5); borderRadius: 8px; }
                .img-modal-close { position: absolute; top: 20px; right: 20px; color: #fff; background: none; border: none; font-size: 32px; cursor: pointer; z-index: 1000001; }
                .img-modal-caption { margin-top: 20px; color: #fff; font-weight: 700; background: rgba(0,0,0,0.6); padding: 10px 24px; border-radius: 30px; font-size: 15px; }

                @media (max-width: 768px) {
                    .filter-grid { grid-template-columns: 1fr; }
                    .filter-inputs { border-right: none; }
                    .filter-row { grid-template-columns: 1fr; border-bottom: 1px solid var(--border); }
                    .filter-label { padding: 6px 12px; font-size: 11px; }
                    .filter-control { padding: 8px 12px; }
                    .filter-checks { flex-direction: row; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--border); }
                    .check-item { background: var(--bg-surface); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 12px; }
                    .filter-actions { grid-template-columns: 1fr 1fr; gap: 8px; background: transparent; padding: 12px; }
                    .filter-actions button { border-radius: 12px !important; }
                    .list-view-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
                }
            `}</style>
        </div>
    );
}
