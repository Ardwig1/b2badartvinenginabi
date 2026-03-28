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

const getCircleStyle = (qty, size = 16) => {
    let bg, border, boxShadow;
    if (qty > 15) {
        bg = 'linear-gradient(135deg, #22c55e, #15803d)';
        border = '1px solid #14532d';
        boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`;
    } else if (qty > 0) {
        bg = 'linear-gradient(90deg, #22c55e 50%, #475569 50%)';
        border = '1px solid #1e293b';
        boxShadow = `0 0 ${size / 2}px rgba(34, 197, 94, 0.5), inset 0 2px 4px rgba(255,255,255,0.2)`;
    } else {
        bg = 'linear-gradient(135deg, #ef4444, #991b1b)';
        border = '1px solid #7f1d1d';
        boxShadow = `0 0 ${size / 2}px rgba(239, 68, 68, 0.8), inset 0 2px 4px rgba(255,255,255,0.4)`;
    }
    return {
        width: size, height: size, borderRadius: '50%', background: bg, border, boxShadow, margin: '0 auto', flexShrink: 0
    };
};

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
    const [pendingQtys, setPendingQtys] = useState({});
    const [userId, setUserId] = useState(null);
    const [companyId, setCompanyId] = useState(null);

    // Hover Tooltip State
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredImage, setHoveredImage] = useState(null);
    const [hoveredPriceTooltip, setHoveredPriceTooltip] = useState(null);
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
    const [checkNew, setCheckNew] = useState(false);
    const [checkCampaign, setCheckCampaign] = useState(false);

    const supabase = createClient();

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const fetchSettingsAndFilters = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Use our smart info API that handles showroom and RLS correctly
            const infoRes = await fetch('/api/user/info');
            if (infoRes.ok) {
                const infoData = await infoRes.json();
                
                setUserId(infoData.userId || null);
                setCompanyId(infoData.companyId || null);
                setDiscount(Number(infoData.discountPercent) || 0);
                
                if (infoData.companyId && typeof window !== 'undefined') {
                    localStorage.setItem('b2b_company_id', infoData.companyId);
                }
            }

            // 2. Fetch metadata for filters
            const { data: metaData } = await supabase
                .from('products')
                .select('brand, car_brand, car_model')
                .eq('is_active', true);

            if (metaData) {
                setBrands([...new Set(metaData.map(p => p.brand).filter(Boolean))].sort());
                setCarBrands([...new Set(metaData.map(p => p.car_brand).filter(Boolean))].sort());
            }

            // 3. Fetch rates and settings
            const [ratesRes, marginRes, usdRes] = await Promise.all([
                fetch('/api/rates'),
                fetch('/api/admin/margin'),
                fetch('/api/admin/usd-settings')
            ]);

            if (ratesRes.ok) {
                const data = await ratesRes.json();
                if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
            }

            if (marginRes.ok) {
                const marginData = await marginRes.json();
                if (marginData?.margin !== undefined) setGlobalMargin(marginData.margin);
            }

            if (usdRes.ok) {
                const usdData = await usdRes.json();
                if (usdData?.usd_rate !== undefined) setGlobalUsdRate(usdData.usd_rate);
                if (usdData?.is_active !== undefined) setGlobalUsdActive(usdData.is_active);
            }

        } catch (e) {
            console.error('Fetch catalog settings error:', e);
        } finally {
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => { fetchSettingsAndFilters(); }, [fetchSettingsAndFilters]);

    const searchProducts = async (e) => {
        if (e && e.key && e.key !== 'Enter') return;

        if (!filterText.trim() && !filterBrand && !filterCarBrand && !filterCarModel && !checkIn && !checkLow && !checkNew && !checkCampaign) {
            setProducts([]);
            setHasSearched(false);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        setCurrentPage(1);

        try {
            const productColumns = 'id, code, oem_no, name, brand, car_brand, car_model, category, list_price, currency, stock_merkez, stock_depo, stock_quantity, unit, description, image_url, discount_rate, box_quantity, is_campaign, created_at, profit_margin, cost_price';
            let query = supabase.from('products').select(productColumns).eq('is_active', true);

            if (filterText.trim()) {
                // Multi-word order-independent search logic
                const words = filterText.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);
                
                words.forEach(word => {
                    // Generate variants to handle Turkish/English character issues
                    // Variant 1: Pure English (İ -> I, Ğ -> G, etc.)
                    const wordEng = word
                        .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
                        .replace(/Ö/g, 'O').replace(/Ş/g, 'S').replace(/Ç/g, 'C');
                    
                    // Variant 2: Pure Turkish (I -> İ, G -> Ğ, etc.)
                    const wordTr = word
                        .replace(/I/g, 'İ').replace(/G/g, 'Ğ').replace(/U/g, 'Ü')
                        .replace(/Ö/g, 'O').replace(/S/g, 'Ş').replace(/C/g, 'Ç');

                    const variants = [...new Set([word, wordEng, wordTr])];
                    const columns = ['name', 'code', 'oem_no', 'brand'];
                    
                    const orParts = [];
                    variants.forEach(v => {
                        const term = `%${v}%`;
                        columns.forEach(col => {
                            orParts.push(`${col}.ilike.${term}`);
                        });
                    });
                    
                    // Join all variants and columns for this specific word
                    query = query.or(orParts.join(','));
                });
            }

            if (filterBrand) query = query.eq('brand', filterBrand);
            if (filterCarBrand) query = query.eq('car_brand', filterCarBrand);
            if (filterCarModel) query = query.eq('car_model', filterCarModel);

            const { data, error } = await query.order('brand').order('name');
            if (error) throw error;

            if (companyId && (filterText || filterBrand || filterCarBrand || filterCarModel)) {
                fetch('/api/log-activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        company_id: companyId,
                        action_type: 'search',
                        details: {
                            text: filterText.trim(),
                            brand: filterBrand,
                            carBrand: filterCarBrand,
                            carModel: filterCarModel
                        }
                    })
                }).catch(e => console.error('Search log error:', e));
            }

            setProducts(data || []);
        } catch (err) {
            console.error('Search error:', err);
            showToast('Ürünler yüklenirken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!filterCarBrand) { setCarModels([]); setFilterCarModel(''); return; }
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
        let marginBase = (Number(p.profit_margin) || 36) / 100;
        let rawCost = initialPrice / (1 + marginBase);
        let currentPrice = rawCost * (1 + (globalMargin / 100));

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
        const afterProductDiscount = basePrice * (1 - productDiscount / 100);
        const afterGroupDiscount = afterProductDiscount * (1 - groupDiscount / 100);
        return afterGroupDiscount;
    };

    const getKdvPrice = (p) => {
        return getDiscountedPrice(p) * 1.20;
    };

    const filtered = products.filter(p => {
        if (checkIn && !(p.stock_merkez > 0 || p.stock_depo > 0)) return false;
        if (checkLow) {
            const isMerkezLow = p.stock_merkez > 0 && p.stock_merkez <= 15;
            const isDepoLow = p.stock_depo > 0 && p.stock_depo <= 15;
            if (!isMerkezLow && !isDepoLow) return false;
        }
        if (checkNew) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            if (new Date(p.created_at) < oneWeekAgo) return false;
        }
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
                            setTimeout(() => loadImg(attempts - 1), 1000);
                        } else {
                            resolve(false);
                        }
                    };
                    img.src = url;
                };
                loadImg(5);
            });
        })).then(() => {
            if (!isCancelled) {
                setPageImagesLoading(false);
            }
        });
        return () => { isCancelled = true; };
    }, [chunkUrlHash]);

    const handleAddToCart = (p) => {
        const raw = getPending(p.id);
        if (!raw || raw === '0') return;
        const n = parseInt(raw, 10);
        if (isNaN(n) || n < 1) return;
        const currentQty = safeCartQtys[p.id]?.qty || 0;
        ctxSetQty(p.id, p, currentQty + n);
        setPendingQtys(prev => {
            const next = { ...prev };
            delete next[p.id];
            return next;
        });
        showToast(`${p.name} sepete eklendi (${n} adet)`);
    };

    const getPending = (id) => pendingQtys[id] ?? '';
    const setPending = (id, val) => {
        const raw = String(val);
        if (raw === '' || /^\d+$/.test(raw)) {
            setPendingQtys(prev => ({ ...prev, [id]: raw }));
        }
    };
    const safeCartQtys = cartQtys || {};
    const totalCartItems = Object.values(safeCartQtys).reduce((a, b) => a + (b.qty || 0), 0);

    useEffect(() => {
        if (!filterText.trim() && !filterBrand && !filterCarBrand && !filterCarModel && !checkIn && !checkLow && !checkNew && !checkCampaign) {
            setProducts([]);
            setHasSearched(false);
        }
        setCurrentPage(1);
    }, [filterBrand, filterCarBrand, filterCarModel, filterText, checkIn, checkLow, checkNew, checkCampaign]);

    const clearFilters = () => {
        setFilterBrand(''); setFilterCarBrand(''); setFilterCarModel(''); setFilterText('');
        setCheckIn(false); setCheckLow(false); setCheckNew(false); setCheckCampaign(false);
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
            <div style={{ 
                background: 'linear-gradient(90deg, rgba(30, 64, 175, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)', 
                border: '1px solid rgba(37, 99, 235, 0.2)',
                color: 'var(--primary)', 
                padding: '14px 20px', 
                borderRadius: '16px', 
                marginBottom: '24px', 
                textAlign: 'center', 
                fontWeight: '800', 
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                letterSpacing: '0.5px'
            }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <span>SAAT 16:00’A KADAR VERİLEN SİPARİŞLER AYNI GÜN KARGO’DA</span>
                <span style={{ fontSize: '20px' }}>🚚</span>
            </div>

            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürün Arama</h1>
                    <p className="page-subtitle">{hasSearched ? `${filtered.length} ürün bulundu` : 'Ürün aramak için filtreleri kullanın'} • %{discountPercent} iskonto</p>
                </div>
                <a href="/dashboard/cart" className="btn btn-primary" id="go-cart" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShoppingCartIcon style={{ width: 18, height: 18 }} /> Sepet {totalCartItems > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999, padding: '1px 8px', fontSize: 12 }}>{totalCartItems}</span>}
                </a>
            </div>

            <div className="card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ borderRight: '1px solid var(--border)' }}>
                        {[
                            { label: 'Marka', value: filterBrand, set: setFilterBrand, opts: brands },
                            { label: 'Araç Marka', value: filterCarBrand, set: setFilterCarBrand, opts: carBrands },
                            { label: 'Araç Model', value: filterCarModel, set: setFilterCarModel, opts: carModels },
                        ].map(({ label, value, set, opts }) => (
                            <div key={label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>{label}</div>
                                <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', background: '#fff' }}>
                                    <select
                                        className="form-select"
                                        style={{ border: 'none', background: 'transparent', fontSize: 13, flex: 1, color: '#000' }}
                                        value={value}
                                        onChange={e => set(e.target.value)}
                                    >
                                        <option value="" style={{ color: '#000', background: '#fff' }}>HEPSİ</option>
                                        {opts.map(o => <option key={o} value={o} style={{ color: '#000', background: '#fff' }}>{o}</option>)}
                                    </select>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                            <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>Genel Arama</div>
                            <div style={{ background: '#fef08a', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: 13, outline: 'none', color: '#000' }}
                                    placeholder="Arama yapmak için 'far' veya '2K8941006B' gibi bir oem kodu yazın (Enter'a basmayı unutmayın)"
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value.toLocaleUpperCase('tr-TR'))}
                                    onKeyDown={searchProducts}
                                    id="catalog-search"
                                />
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            { label: 'Kampanya', val: checkCampaign, set: setCheckCampaign },
                            { label: 'Stokta Olanlar', val: checkIn, set: setCheckIn },
                            { label: 'Az Var', val: checkLow, set: setCheckLow },
                            { label: 'Yeni Ürün', val: checkNew, set: setCheckNew },
                        ].map(({ label, val, set }) => (
                            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ width: 16, height: 16 }} />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', background: 'var(--bg-secondary)' }}>
                    <button className="btn btn-primary" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={() => searchProducts()} id="search-btn">Ara</button>
                    <button className="btn btn-danger" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={clearFilters} id="clear-btn">Temizle</button>
                    <button className="btn btn-ghost" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px', background: '#1e293b', color: '#fff' }} onClick={() => { setViewMode(prev => prev === 'catalog' ? 'list' : 'catalog'); setCurrentPage(1); }} id="catalog-btn">{viewMode === 'catalog' ? '🖼️ Liste' : '📊 Katalog'}</button>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a' }} />
                    </div>
                </div>
            </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                    {filtered.slice((currentPage - 1) * perPage, currentPage * perPage).map(p => {
                        const isOutOfStock = !(p.stock_merkez > 0 || p.stock_depo > 0);
                        return (
                            <div key={p.id} style={{
                                background: p.is_campaign ? '#fef08a' : 'var(--bg-card)',
                                border: p.is_campaign ? '1px solid #eab308' : '1px solid var(--border)',
                                color: p.is_campaign ? '#000' : 'inherit',
                                borderRadius: 12,
                                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                                transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default',
                                position: 'relative'
                            }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; handleRowMouseEnter(e, p); }}
                                onMouseMove={e => handleRowMouseMove(e, p)}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; handleRowMouseLeave(); }}
                            >
                                <div style={{ width: '100%', aspectRatio: '1/1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                                    {p.image_url ? (
                                        <img src={p.image_url} alt={p.name || 'Ürün'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} />
                                    ) : (
                                        <CubeIcon style={{ width: 48, height: 48, color: '#ccc' }} />
                                    )}
                                </div>
                                <div style={{ padding: '8px 10px 0', fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.code || '-'}
                                </div>
                                <div style={{ padding: '4px 10px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minHeight: 34, lineHeight: '17px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                    {p.name}
                                </div>
                                <div style={{ padding: '4px 10px 0', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: p.is_campaign ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)' }}>
                                    <span style={{ fontWeight: 600, color: p.is_campaign ? '#b91c1c' : 'var(--danger)' }}>{p.brand || '-'}</span>
                                    <span style={{ color: p.is_campaign ? '#000' : 'inherit' }}>{p.unit || 'AD'}</span>
                                </div>
                                <div
                                    style={{ padding: '6px 10px 0', fontSize: 16, fontWeight: 800, color: p.is_campaign ? '#1e40af' : 'var(--primary)', fontFamily: 'monospace', cursor: 'grab' }}
                                    onMouseEnter={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredPriceTooltip({ product: p, x: rect.left, y: rect.top });
                                    }}
                                    onMouseLeave={() => setHoveredPriceTooltip(null)}
                                >
                                    ₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                                <div style={{ padding: '0 10px', fontSize: 10, color: p.is_campaign ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)' }}>KDV Dahil</div>
                                <div style={{ padding: '6px 10px 0', display: 'flex', gap: 8, fontSize: 11, color: p.is_campaign ? '#000' : 'inherit' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                        <div style={getCircleStyle(p.stock_merkez || 0, 12)} title={p.stock_merkez > 15 ? 'Stokta' : p.stock_merkez > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        İst.
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                                        <div style={getCircleStyle(p.stock_depo || 0, 12)} title={p.stock_depo > 15 ? 'Stokta' : p.stock_depo > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        Depo
                                    </span>
                                </div>
                                <div style={{ padding: '8px 10px 10px', marginTop: 'auto', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', height: 36 }}>
                                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 10px', height: '100%', borderRadius: 0, borderRight: '2px solid #000', fontSize: 18, color: '#000', fontWeight: 800 }}
                                            onClick={(e) => { e.stopPropagation(); const cur = parseInt(getPending(p.id) || '1', 10); setPending(p.id, Math.max(1, (isNaN(cur) ? 1 : cur) - 1)); }}
                                        >−</button>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={getPending(p.id)}
                                            onChange={e => setPending(p.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="Ad."
                                            style={{ width: 45, textAlign: 'center', fontSize: 14, fontWeight: 800, border: 'none', background: 'transparent', outline: 'none', color: '#000' }}
                                        />
                                        <button className="btn btn-ghost btn-sm" style={{ padding: '0 10px', height: '100%', borderRadius: 0, borderLeft: '2px solid #000', fontSize: 18, color: '#000', fontWeight: 800 }}
                                            onClick={(e) => { e.stopPropagation(); const cur = parseInt(getPending(p.id) || '0', 10); setPending(p.id, (isNaN(cur) ? 1 : cur) + 1); }}
                                            disabled={isOutOfStock}
                                        >+</button>
                                    </div>
                                    {(() => {
                                        const pVal = getPending(p.id);
                                        const isPendingEmpty = !pVal || pVal === '0' || pVal.trim() === '';
                                        return (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={(e) => { e.stopPropagation(); handleAddToCart(p); }}
                                                disabled={isOutOfStock || isPendingEmpty}
                                                style={{
                                                    flex: 1,
                                                    opacity: (isOutOfStock || isPendingEmpty) ? 0.35 : 1,
                                                    fontSize: 12,
                                                    padding: '6px 0',
                                                    cursor: (isOutOfStock || isPendingEmpty) ? 'not-allowed' : 'pointer',
                                                    filter: (isOutOfStock || isPendingEmpty) ? 'grayscale(0.5)' : 'none',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {isOutOfStock ? 'Stok Yok' : '🛒 Ekle'}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Marka</th>
                                <th>Stok Kodu</th>
                                <th>OEM No</th>
                                <th>Ürün Adı</th>
                                <th style={{ width: 40, textAlign: 'center' }} title="Ürün Resmi"><PhotoIcon style={{ width: 18, height: 18 }} /></th>
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
                                        style={{ background: p.is_campaign ? '#fef08a' : 'transparent', color: p.is_campaign ? '#000' : 'inherit' }}
                                    >
                                        <td style={{ fontWeight: 600, fontSize: 13, color: p.is_campaign ? '#000' : 'inherit' }}>{p.brand || '-'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: p.is_campaign ? '#1e40af' : 'var(--primary)', fontWeight: p.is_campaign ? 700 : 400 }}>{p.code}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: p.is_campaign ? 'rgba(0,0,0,0.7)' : 'var(--text-muted)' }}>{p.oem_no || '-'}</td>
                                        <td style={{ fontWeight: 600, maxWidth: 220, color: p.is_campaign ? '#000' : 'inherit' }}>{p.name}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            {p.image_url ? (
                                                <div
                                                    style={{ cursor: 'pointer', color: 'var(--primary)', display: 'flex', justifyContent: 'center' }}
                                                    onMouseEnter={(e) => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setHoveredImage({ url: p.image_url, x: rect.left, y: rect.top });
                                                    }}
                                                    onMouseLeave={() => setHoveredImage(null)}
                                                >
                                                    <PhotoIcon style={{ width: 20, height: 20 }} />
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td style={{ fontSize: 12, color: p.is_campaign ? '#000' : 'var(--text-muted)' }}>{p.unit || 'AD'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 800, color: p.is_campaign ? '#b91c1c' : 'var(--danger)' }}>%{discountPercent}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                            <div
                                                style={{ position: 'relative', display: 'inline-block', cursor: 'grab', color: 'var(--primary)', fontWeight: 700 }}
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredPriceTooltip({ product: p, x: rect.left, y: rect.top });
                                                }}
                                                onMouseLeave={() => setHoveredPriceTooltip(null)}
                                            >
                                                ₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div style={getCircleStyle(p.stock_merkez || 0, 16)} title={p.stock_merkez > 15 ? 'Stokta' : p.stock_merkez > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <div style={getCircleStyle(p.stock_depo || 0, 16)} title={p.stock_depo > 15 ? 'Stokta' : p.stock_depo > 0 ? 'Az Kaldı' : 'Stok Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: p.is_campaign ? '#000' : 'inherit' }}>{p.box_quantity || 1}</td>
                                        <td>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', height: 36 }}>
                                                <button className="btn btn-ghost btn-sm" style={{ padding: '0 10px', height: '100%', borderRadius: 0, borderRight: '2px solid #000', fontSize: 18, color: '#000', fontWeight: 800 }}
                                                    onClick={(e) => { e.stopPropagation(); const cur = parseInt(getPending(p.id) || '1', 10); setPending(p.id, Math.max(1, (isNaN(cur) ? 1 : cur) - 1)); }}
                                                >−</button>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={getPending(p.id)}
                                                    onChange={e => setPending(p.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Ad."
                                                    style={{ width: 45, textAlign: 'center', fontSize: 14, fontWeight: 800, border: 'none', background: 'transparent', outline: 'none', color: '#000' }}
                                                />
                                                <button className="btn btn-ghost btn-sm" style={{ padding: '0 10px', height: '100%', borderRadius: 0, borderLeft: '2px solid #000', fontSize: 18, color: '#000', fontWeight: 800 }}
                                                    onClick={(e) => { e.stopPropagation(); const cur = parseInt(getPending(p.id) || '0', 10); setPending(p.id, (isNaN(cur) ? 1 : cur) + 1); }}
                                                    disabled={isOutOfStock}
                                                >+</button>
                                            </div>
                                        </td>
                                        <td>
                                            {(() => {
                                                const pVal = getPending(p.id);
                                                const isPendingEmpty = !pVal || pVal === '0' || pVal.trim() === '';
                                                return (
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={(e) => { e.stopPropagation(); handleAddToCart(p); }}
                                                        disabled={isOutOfStock || isPendingEmpty}
                                                        style={{
                                                            opacity: (isOutOfStock || isPendingEmpty) ? 0.35 : 1,
                                                            whiteSpace: 'nowrap',
                                                            cursor: (isOutOfStock || isPendingEmpty) ? 'not-allowed' : 'pointer',
                                                            filter: (isOutOfStock || isPendingEmpty) ? 'grayscale(0.5)' : 'none',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {isOutOfStock ? 'Stok Yok' : '🛒 Ekle'}
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

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

            {hoveredImage && (
                <div style={{
                    position: 'fixed',
                    left: Math.max(20, hoveredImage.x - 320),
                    top: Math.max(20, hoveredImage.y - 150),
                    width: 300,
                    background: '#fff',
                    border: '1px solid #ddd',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    zIndex: 999999,
                    overflow: 'hidden',
                    pointerEvents: 'none'
                }}>
                    <div style={{ background: '#f8fafc', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #eee' }}>
                        <img src="/omi-logo-sidebar.png" alt="Omi Group" style={{ height: 24, objectFit: 'contain' }} />
                    </div>
                    <div style={{ padding: '12px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px' }}>
                        <img
                            src={hoveredImage.url}
                            alt="Ürün"
                            style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }}
                            onError={(e) => {
                                e.target.src = 'https://via.placeholder.com/300x200?text=G%C3%B6rsel+Bulunamad%C4%B1';
                                e.target.style.opacity = '0.5';
                            }}
                        />
                    </div>
                </div>
            )}

            {hoveredPriceTooltip && (
                <div style={{
                    position: 'fixed',
                    left: Math.max(20, hoveredPriceTooltip.x - 260),
                    top: Math.max(20, hoveredPriceTooltip.y - 120),
                    zIndex: 999999,
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.2s ease forwards'
                }}>
                    <div style={{ textAlign: 'left', minWidth: 260, padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow-xl)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Liste Fiyatı:</span>
                            <span style={{ fontSize: 12 }}>
                                {Number(hoveredPriceTooltip.product.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {hoveredPriceTooltip.product.currency || 'TRY'}
                                {hoveredPriceTooltip.product.currency && hoveredPriceTooltip.product.currency !== 'TRY' && (
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textAlign: 'right' }}>
                                        (₺{getBaseTryPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})
                                    </span>
                                )}
                            </span>
                        </div>
                        {Number(hoveredPriceTooltip.product.discount_rate) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Ürün İskontosu ({hoveredPriceTooltip.product.discount_rate}%):</span>
                                <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                                    -₺{(getBaseTryPrice(hoveredPriceTooltip.product) * Number(hoveredPriceTooltip.product.discount_rate) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        {discountPercent > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Grup İskontosu ({discountPercent}%):</span>
                                <span style={{ fontSize: 12, color: 'var(--danger)' }}>
                                    -₺{(getBaseTryPrice(hoveredPriceTooltip.product) * (1 - Number(hoveredPriceTooltip.product.discount_rate || 0) / 100) * discountPercent / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>İskontolu Fiyat:</span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>₺{getDiscountedPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--primary)', paddingTop: 8, marginTop: 4 }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>KDV Dahil (%20):</span>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 14 }}>₺{getKdvPrice(hoveredPriceTooltip.product).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            )}

            {toast && <div className="toast toast-success">✓ {toast}</div>}
        </div>
    );
}
