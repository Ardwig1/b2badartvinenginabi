'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, PhotoIcon, CubeIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

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
    const [loading, setLoading] = useState(true);
    const [discountPercent, setDiscount] = useState(0);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
    const [toast, setToast] = useState('');
    const [cartQtys, setCartQtys] = useState({});
    const [follows, setFollows] = useState(new Set());
    const [userId, setUserId] = useState(null);

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
    const [checkFollowed, setCheckFollowed] = useState(false);

    const supabase = createClient();

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id);
        const { data: profile } = await supabase
            .from('profiles')
            .select('company:companies(price_group:price_groups(discount_percent))')
            .eq('id', user.id).single();
        setDiscount(profile?.company?.price_group?.discount_percent || 0);

        const { data: prods } = await supabase
            .from('products').select('*').eq('is_active', true).order('brand').order('name');
        const list = prods || [];
        setProducts(list);
        setBrands([...new Set(list.map(p => p.brand).filter(Boolean))]);
        setCarBrands([...new Set(list.map(p => p.car_brand).filter(Boolean))]);

        // Fetch follows
        if (user) {
            const { data: followData } = await supabase
                .from('product_follows')
                .select('product_id')
                .eq('user_id', user.id);
            if (followData) {
                setFollows(new Set(followData.map(f => f.product_id)));
            }
        }

        try {
            const res = await fetch('/api/rates');
            const data = await res.json();
            if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
        } catch (e) {
            console.error('Rates fetch error:', e);
        }

        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Update car models when car brand changes
    useEffect(() => {
        if (!filterCarBrand) { setCarModels([]); setFilterCarModel(''); return; }
        const models = [...new Set(products.filter(p => p.car_brand === filterCarBrand).map(p => p.car_model).filter(Boolean))];
        setCarModels(models);
        setFilterCarModel('');
    }, [filterCarBrand, products]);

    const getBaseTryPrice = (p) => {
        let price = Number(p.list_price) || 0;
        if (p.currency === 'USD') price = price * rates.USD;
        else if (p.currency === 'EUR') price = price * rates.EUR;
        return price;
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
        if (filterBrand && p.brand !== filterBrand) return false;
        if (filterCarBrand && p.car_brand !== filterCarBrand) return false;
        if (filterCarModel && p.car_model !== filterCarModel) return false;
        if (filterText) {
            const q = filterText.toLowerCase();
            if (!p.name?.toLowerCase().includes(q) && !p.code?.toLowerCase().includes(q) &&
                !p.product_number?.toLowerCase().includes(q) &&
                !p.oem_no?.toLowerCase().includes(q) && !p.brand?.toLowerCase().includes(q)) return false;
        }
        const st = getStockStatus(p.stock_quantity);
        if (checkIn && st !== 'in_stock') return false;
        if (checkLow && st !== 'low_stock') return false;
        if (checkWay && p.stock_status !== 'on_the_way') return false;
        if (checkNew && !p.is_new) return false;
        if (checkCampaign && !p.is_campaign) return false;
        if (checkFollowed && !follows.has(p.id)) return false;
        return true;
    });

    const addToCart = (p) => {
        setCartQtys(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }));
        showToast(`${p.name} sepete eklendi`);
    };
    const setQty = (id, val) => {
        const n = parseInt(val, 10);
        setCartQtys(prev => ({ ...prev, [id]: isNaN(n) || n < 0 ? 0 : n }));
    };
    const totalCartItems = Object.values(cartQtys).reduce((a, b) => a + b, 0);

    const toggleFollow = async (productId) => {
        if (!userId) return;
        if (follows.has(productId)) {
            await supabase.from('product_follows').delete().eq('user_id', userId).eq('product_id', productId);
            setFollows(prev => { const next = new Set(prev); next.delete(productId); return next; });
            showToast('Takipten çıkarıldı');
        } else {
            await supabase.from('product_follows').insert({ user_id: userId, product_id: productId });
            setFollows(prev => new Set(prev).add(productId));
            showToast('Takibe alındı');
        }
    };

    const clearFilters = () => {
        setFilterBrand(''); setFilterCarBrand(''); setFilterCarModel(''); setFilterText('');
        setCheckIn(false); setCheckLow(false); setCheckWay(false); setCheckNew(false); setCheckCampaign(false); setCheckFollowed(false);
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
                <th>Stok Kodu</th><th>Ürün Adı</th><th>Marka</th><th>Birim</th><th>Fiyat (KDV Dahil)</th><th>Merkez</th><th>Depo</th><th>Koli</th>
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
                    <p className="page-subtitle">{filtered.length} ürün bulundu • %{discountPercent} iskonto</p>
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
                        {/* Empty rows for visual balance */}
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ background: 'var(--primary)', padding: '10px 16px' }} />
                                <div style={{ padding: '10px 16px' }} />
                            </div>
                        ))}
                        {/* Genel Arama */}
                        <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                            <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center' }}>Genel Arama</div>
                            <div style={{ background: '#fef08a', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                                <input
                                    style={{ border: 'none', background: 'transparent', width: '100%', fontSize: 13, outline: 'none', color: '#000' }}
                                    placeholder="Ara..."
                                    value={filterText}
                                    onChange={e => setFilterText(e.target.value)}
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
                            { label: 'Takipteki Ürünler', val: checkFollowed, set: setCheckFollowed },
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
                    <button className="btn btn-primary" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={() => { }} id="search-btn">Ara</button>
                    <button className="btn btn-danger" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px' }} onClick={clearFilters} id="clear-btn">Temizle</button>
                    <button className="btn btn-ghost" style={{ borderRadius: 0, justifyContent: 'center', padding: '12px', background: '#1e293b', color: '#fff' }} onClick={openCatalogPrint} id="catalog-btn">Katalog</button>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a' }} />
                    </div>
                </div>
            </div>

            {/* Results Table */}
            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon"><CubeIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Ürün bulunamadı</div></div></div>
            ) : (
                <div className="table-wrapper" style={{ minHeight: 'calc(100vh - 300px)' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Görsel</th>
                                <th>Marka</th>
                                <th>Stok Kodu</th>
                                <th>OEM No</th>
                                <th>Ürün Adı</th>
                                <th>Birim</th>
                                <th style={{ textAlign: 'right' }}>Fiyat (KDV Dahil)</th>
                                <th style={{ textAlign: 'center' }}>Merkez</th>
                                <th style={{ textAlign: 'center' }}>Depo</th>
                                <th style={{ textAlign: 'center' }}>Koli Ad.</th>
                                <th style={{ width: 80 }}>Sip.Mik.</th>
                                <th>Sepete At</th>
                                <th style={{ textAlign: 'center' }}>Takip</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => {
                                const stKey = p.stock_status && STOCK_STATUS[p.stock_status] ? p.stock_status : getStockStatus(p.stock_quantity);
                                const st = STOCK_STATUS[stKey];
                                const qty = cartQtys[p.id] || 0;
                                const isOutOfStock = !(p.stock_merkez > 0 || p.stock_depo > 0);
                                const isFollowed = follows.has(p.id);
                                return (
                                    <tr key={p.id}>
                                        {/* Görsel - thumbnail with hover tooltip */}
                                        <td style={{ width: 50, padding: '6px 8px' }}>
                                            {p.image_url ? (
                                                <div className="tooltip-container" style={{ position: 'relative' }}>
                                                    <img
                                                        src={p.image_url}
                                                        alt={p.name}
                                                        style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, border: '1px solid var(--border)', backgroundColor: 'white', cursor: 'pointer' }}
                                                    />
                                                    <div className="tooltip-content img-tooltip">
                                                        <img src={p.image_url} alt={p.name} style={{ width: 300, height: 300, objectFit: 'contain', borderRadius: 8, backgroundColor: 'white' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                                    <CubeIcon style={{ width: 20, height: 20 }} />
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: 13 }}>{p.brand || '-'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{p.code}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{p.oem_no || '-'}</td>
                                        <td style={{ fontWeight: 500, maxWidth: 220 }}>{p.name}</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.unit || 'AD'}</td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                            <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block', cursor: 'grab', color: 'var(--primary)', fontWeight: 700 }}>
                                                ₺{getKdvPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                <div className="tooltip-content price-tooltip">
                                                    <div style={{ textAlign: 'left', minWidth: 240, padding: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 8 }}>
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Liste Fiyatı:</span>
                                                            <span style={{ fontSize: 12 }}>
                                                                {Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {p.currency || 'TRY'}
                                                                {p.currency && p.currency !== 'TRY' && <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textAlign: 'right' }}>(₺{getBaseTryPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })})</span>}
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
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.stock_merkez > 0 ? '#16a34a' : '#dc2626', margin: '0 auto', boxShadow: '0 0 8px rgba(0,0,0,0.2)' }} title={p.stock_merkez > 0 ? 'Merkez: Var' : 'Merkez: Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.stock_depo > 0 ? '#16a34a' : '#dc2626', margin: '0 auto', boxShadow: '0 0 8px rgba(0,0,0,0.2)' }} title={p.stock_depo > 0 ? 'Depo: Var' : 'Depo: Yok'} />
                                        </td>
                                        <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 500 }}>{p.box_quantity || 1}</td>
                                        <td>
                                            <input
                                                type="number" min="0"
                                                value={qty}
                                                onChange={e => setQty(p.id, e.target.value)}
                                                style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: 13 }}
                                                id={`qty-${p.id}`}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => { if ((cartQtys[p.id] || 0) === 0) setQty(p.id, 1); addToCart(p); }}
                                                disabled={isOutOfStock}
                                                style={{ opacity: isOutOfStock ? 0.4 : 1, whiteSpace: 'nowrap' }}
                                                id={`add-cart-${p.id}`}
                                            >
                                                {isOutOfStock ? 'Stok Yok' : '🛒 Ekle'}
                                            </button>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                onClick={() => toggleFollow(p.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                                title={isFollowed ? 'Takipten çıkar' : 'Takip et'}
                                                id={`follow-${p.id}`}
                                            >
                                                {isFollowed ? (
                                                    <StarSolidIcon style={{ width: 20, height: 20, color: '#f59e0b' }} />
                                                ) : (
                                                    <StarIcon style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {toast && <div className="toast toast-success">✓ {toast}</div>}
        </div>
    );
}
