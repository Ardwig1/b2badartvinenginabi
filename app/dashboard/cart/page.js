'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DealerCart() {
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItems] = useState([]); // [{product, qty}]
    const [discountPercent, setDiscountPercent] = useState(0);
    const [companyId, setCompanyId] = useState('');
    const [shipping, setShipping] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchUser = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
            .from('profiles')
            .select('company_id, company:companies(price_group:price_groups(discount_percent))')
            .eq('id', user.id)
            .single();
        setCompanyId(profile?.company_id || '');
        setDiscountPercent(profile?.company?.price_group?.discount_percent || 0);
        setLoading(false);
    }, []);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const getPrice = (listPrice) => listPrice * (1 - discountPercent / 100);

    const addProduct = async (productId) => {
        if (!productId) return;
        const existing = cartItems.find(i => i.product.id === productId);
        if (existing) {
            setCartItems(prev => prev.map(i => i.product.id === productId ? { ...i, qty: i.qty + 1 } : i));
        } else {
            const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
            if (prod) setCartItems(prev => [...prev, { product: prod, qty: 1 }]);
        }
    };

    const [searchProducts, setSearchProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');

    const searchProds = async (q) => {
        setProductSearch(q);
        if (q.length < 2) { setSearchProducts([]); return; }
        const { data } = await supabase.from('products').select('*').eq('is_active', true).or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(6);
        setSearchProducts(data || []);
    };

    const updateQty = (id, delta) => {
        setCartItems(prev => prev.map(i => i.product.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i).filter(i => i.qty > 0));
    };
    const removeItem = (id) => setCartItems(prev => prev.filter(i => i.product.id !== id));

    const subtotal = cartItems.reduce((acc, i) => acc + getPrice(i.product.list_price) * i.qty, 0);

    const placeOrder = async () => {
        if (cartItems.length === 0) return;
        setSubmitting(true);
        const { data: order } = await supabase.from('orders').insert({
            company_id: companyId,
            shipping_address: shipping,
            note,
            total_amount: subtotal,
            status: 'pending',
        }).select().single();

        if (order) {
            await supabase.from('order_items').insert(cartItems.map(i => ({
                order_id: order.id,
                product_id: i.product.id,
                quantity: i.qty,
                unit_price: getPrice(i.product.list_price),
                total_price: getPrice(i.product.list_price) * i.qty,
            })));
            // Reduce stock
            for (const item of cartItems) {
                await supabase.rpc('decrement_stock', { product_id: item.product.id, qty: item.qty }).catch(() => {
                    supabase.from('products').select('stock_quantity').eq('id', item.product.id).single().then(({ data }) => {
                        supabase.from('products').update({ stock_quantity: Math.max(0, (data?.stock_quantity || 0) - item.qty) }).eq('id', item.product.id);
                    });
                });
            }
        }
        setCartItems([]);
        setSubmitting(false);
        setSuccess(true);
    };

    if (success) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: 80 }}>
                <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Sipariş Alındı!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Siparişiniz oluşturuldu. Siparişlerim sayfasından takip edebilirsiniz.</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <a href="/dashboard/orders" className="btn btn-primary">Siparişlerimə Git</a>
                    <a href="/dashboard/catalog" className="btn btn-ghost">Alışverişe Devam</a>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sepetim & Sipariş Ver</h1>
                    <p className="page-subtitle">{cartItems.length} ürün çeşidi</p>
                </div>
                <a href="/dashboard/catalog" className="btn btn-ghost">← Kataloğa Dön</a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
                <div>
                    {/* Product search & add */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-title" style={{ marginBottom: 12 }}>Katalogdan Ekle</div>
                        <div style={{ position: 'relative' }}>
                            <div className="search-bar" style={{ width: '100%' }}>
                                <span className="search-icon">🔍</span>
                                <input placeholder="Ürün adı veya kodunu yazın..." value={productSearch} onChange={e => searchProds(e.target.value)} id="cart-product-search" />
                            </div>
                            {searchProducts.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', zIndex: 100, marginTop: 4 }}>
                                    {searchProducts.map(p => (
                                        <div key={p.id} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}
                                            onClick={() => { addProduct(p.id); setProductSearch(''); setSearchProducts([]); }}>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div>
                                            </div>
                                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>₺{getPrice(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart items */}
                    {cartItems.length === 0 ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-icon">🛒</div><div className="empty-state-title">Sepetiniz boş</div><div className="empty-state-text">Katalogdan ürün ekleyin</div></div></div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th>Ürün</th><th>Birim Fiyat</th><th>Miktar</th><th>Toplam</th><th></th></tr></thead>
                                <tbody>
                                    {cartItems.map(({ product: p, qty }) => (
                                        <tr key={p.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</div>
                                            </td>
                                            <td>₺{getPrice(p.list_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p.id, -1)} id={`minus-${p.id}`}>−</button>
                                                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p.id, 1)} id={`plus-${p.id}`}>+</button>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₺{(getPrice(p.list_price) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(p.id)} id={`remove-${p.id}`}>✕</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Order summary */}
                <div className="card" style={{ position: 'sticky', top: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Sipariş Özeti</div>
                    <div className="form-group">
                        <label className="form-label">Teslimat Adresi</label>
                        <textarea className="form-textarea" style={{ minHeight: 70 }} value={shipping} onChange={e => setShipping(e.target.value)} placeholder="Teslimat adresi..." id="shipping-address" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Not (opsiyonel)</label>
                        <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Sipariş notu..." id="order-note" />
                    </div>
                    <hr className="divider" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 16 }}>
                        <span>Toplam</span>
                        <span>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={cartItems.length === 0 || submitting} onClick={placeOrder} id="place-order-btn">
                        {submitting ? 'Sipariş veriliyor...' : '✓ Sipariş Ver'}
                    </button>
                </div>
            </div>
        </div>
    );
}
