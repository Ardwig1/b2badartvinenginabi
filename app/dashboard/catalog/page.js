'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DealerCatalog() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState({});
    const [discountPercent, setDiscountPercent] = useState(0);
    const [toast, setToast] = useState('');

    const supabase = createClient();

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('company:companies(price_group:price_groups(discount_percent))')
            .eq('id', user.id)
            .single();

        const discount = profile?.company?.price_group?.discount_percent || 0;
        setDiscountPercent(discount);

        const { data: prods } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('name');

        setProducts(prods || []);
        const cats = [...new Set((prods || []).map(p => p.category).filter(Boolean))];
        setCategories(cats);
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const getPrice = (listPrice) => {
        const discounted = listPrice * (1 - discountPercent / 100);
        return discounted;
    };

    const addToCart = (product) => {
        setCart(prev => ({ ...prev, [product.id]: { product, qty: (prev[product.id]?.qty || 0) + 1 } }));
        showToast(`${product.name} sepete eklendi`);
    };

    const cartCount = Object.values(cart).reduce((acc, i) => acc + i.qty, 0);

    const filtered = products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
        const matchCat = category === 'all' || p.category === category;
        return matchSearch && matchCat;
    });

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ürün Kataloğu</h1>
                    <p className="page-subtitle">{filtered.length} ürün • %{discountPercent} iskonto uygulandı</p>
                </div>
                <a href="/dashboard/cart" className="btn btn-primary" id="go-cart">
                    🛒 Sepet {cartCount > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999, padding: '1px 8px', fontSize: 12 }}>{cartCount}</span>}
                </a>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input placeholder="Ürün adı, kod, marka..." value={search} onChange={e => setSearch(e.target.value)} id="catalog-search" />
                </div>
                <div className="tabs" style={{ marginBottom: 0 }}>
                    <button className={`tab ${category === 'all' ? 'active' : ''}`} onClick={() => setCategory('all')}>Tümü</button>
                    {categories.map(c => (
                        <button key={c} className={`tab ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="loading-center"><div className="loading-spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card"><div className="empty-state"><div className="empty-state-icon">📦</div><div className="empty-state-title">Ürün bulunamadı</div></div></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {filtered.map(p => (
                        <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', background: 'rgba(37,99,235,0.1)', padding: '2px 8px', borderRadius: 4 }}>{p.code}</div>
                                <div style={{ fontSize: 12, color: p.stock_quantity > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                    {p.stock_quantity > 0 ? `Stok: ${p.stock_quantity}` : 'Stok Yok'}
                                </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Outfit, sans-serif' }}>{p.name}</div>
                            {p.brand && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.brand} {p.category && `• ${p.category}`}</div>}
                            {p.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description}</div>}
                            <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                                {discountPercent > 0 && (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>₺{Number(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                )}
                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                                    ₺{getPrice(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                                    onClick={() => addToCart(p)}
                                    disabled={p.stock_quantity === 0}
                                    id={`add-cart-${p.id}`}
                                >
                                    {p.stock_quantity === 0 ? 'Stok Yok' : '+ Sepete Ekle'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {toast && <div className="toast toast-success">✓ {toast}</div>}
        </div>
    );
}
