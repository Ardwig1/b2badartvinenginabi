'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCartIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useCart } from '@/components/CartProvider';

export default function DealerCart() {
    const { cartItems: contextCartItems, setQty: ctxSetQty, addToCart: ctxAddToCart, clearCart } = useCart();

    // Convert cartItems object to array for rendering
    const cartItems = useMemo(() => {
        return Object.values(contextCartItems).filter(item => item.qty > 0);
    }, [contextCartItems]);

    const [products, setProducts] = useState([]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [companyId, setCompanyId] = useState('');
    const [shipping, setShipping] = useState('');
    const [shippingMethod, setShippingMethod] = useState('Kargo');
    const [isDifferentAddress, setIsDifferentAddress] = useState(false);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState({ USD: 1, EUR: 1 });
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

        try {
            const res = await fetch('/api/rates');
            const data = await res.json();
            if (data?.USD && data?.EUR) setRates({ USD: data.USD, EUR: data.EUR });
        } catch (e) {
            console.error('Rates fetch error:', e);
        }

        setLoading(false);
    }, []);

    useEffect(() => { fetchUser(); }, [fetchUser]);

    const getBaseTryPrice = (p) => {
        let price = Number(p.list_price) || 0;
        if (p.currency === 'USD') price = price * rates.USD;
        else if (p.currency === 'EUR') price = price * rates.EUR;
        return price;
    };
    const getDiscountedPrice = (p) => getBaseTryPrice(p) * (1 - discountPercent / 100);

    const addProduct = async (productId) => {
        if (!productId) return;
        const { data: prod } = await supabase.from('products').select('*').eq('id', productId).single();
        if (prod) ctxAddToCart(prod);
    };

    const [searchProducts, setSearchProducts] = useState([]);
    const [productSearch, setProductSearch] = useState('');

    const searchProds = async (q) => {
        setProductSearch(q);
        if (q.length < 2) { setSearchProducts([]); return; }
        const { data } = await supabase.from('products').select('*').eq('is_active', true).or(`name.ilike.%${q}%,code.ilike.%${q}%`).limit(6);
        setSearchProducts(data || []);
    };

    const updateQty = (p, delta) => {
        const currentQty = contextCartItems[p.id]?.qty || 0;
        ctxSetQty(p.id, p, currentQty + delta);
    };
    const removeItem = (p) => ctxSetQty(p.id, p, 0);

    const subtotal = cartItems.reduce((acc, i) => acc + (getBaseTryPrice(i.product) * i.qty), 0);
    const totalDiscount = cartItems.reduce((acc, i) => acc + (getBaseTryPrice(i.product) * (discountPercent / 100) * i.qty), 0);
    const totalAfterDiscount = subtotal - totalDiscount;
    const vat = totalAfterDiscount * 0.20;
    const grandTotal = totalAfterDiscount + vat;

    const placeOrder = async () => {
        if (cartItems.length === 0) return;
        setSubmitting(true);
        const finalAddress = isDifferentAddress ? shipping : 'Sistem Kayıtlı Firma Adresi';
        const finalNote = `[${shippingMethod}] ${note}`;

        const { data: order } = await supabase.from('orders').insert({
            company_id: companyId,
            shipping_address: finalAddress,
            note: finalNote,
            total_amount: grandTotal,
            status: 'pending',
        }).select().single();

        if (order) {
            await supabase.from('order_items').insert(cartItems.map(i => ({
                order_id: order.id,
                product_id: i.product.id,
                quantity: i.qty,
                unit_price: getDiscountedPrice(i.product),
                total_price: getDiscountedPrice(i.product) * i.qty,
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
        clearCart();
        setSubmitting(false);
        setSuccess(true);
    };

    if (success) {
        return (
            <div className="page-wrapper" style={{ textAlign: 'center', paddingTop: 80 }}>
                <div style={{ color: '#16a34a', marginBottom: 20, display: 'flex', justifyContent: 'center' }}><CheckCircleIcon style={{ width: 72, height: 72 }} /></div>
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
                                <span className="search-icon"><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></span>
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
                                            <div style={{ color: 'var(--primary)', fontWeight: 600 }}>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart items */}
                    {cartItems.length === 0 ? (
                        <div className="card"><div className="empty-state"><div className="empty-state-icon"><ShoppingCartIcon style={{ width: 32, height: 32 }} /></div><div className="empty-state-title">Sepetiniz boş</div><div className="empty-state-text">Katalogdan ürün ekleyin</div></div></div>
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
                                            <td>₺{getDiscountedPrice(p).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p, -1)} id={`minus-${p.id}`}>−</button>
                                                    <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }} onClick={() => updateQty(p, 1)} id={`plus-${p.id}`}>+</button>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₺{(getDiscountedPrice(p) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                                            <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(p)} id={`remove-${p.id}`}>✕</button></td>
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

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Gönderim Şekli</label>
                        <select className="form-input" value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}>
                            <option value="Kargo">Kargo</option>
                            <option value="Kurye">Kurye</option>
                            <option value="Elden Teslim">Elden Teslim</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <input type="checkbox" id="diff-address" checked={isDifferentAddress} onChange={e => setIsDifferentAddress(e.target.checked)} />
                        <label htmlFor="diff-address" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Farklı Sevk Adresi Kullan</label>
                    </div>

                    {isDifferentAddress && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">Farklı Teslimat Adresi</label>
                            <textarea className="form-textarea" style={{ minHeight: 70 }} value={shipping} onChange={e => setShipping(e.target.value)} placeholder="Teslimat adresi..." id="shipping-address" />
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Sepet Notu (opsiyonel)</label>
                        <textarea className="form-textarea" style={{ minHeight: 70 }} value={note} onChange={e => setNote(e.target.value)} placeholder="Siparişle ilgili notunuz..." id="order-note" />
                    </div>

                    <hr className="divider" style={{ margin: '16px 0' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Ara Toplam</span>
                            <span>₺{subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {discountPercent > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                                <span>İskonto (%{discountPercent})</span>
                                <span>-₺{totalDiscount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>KDV (%20)</span>
                            <span>₺{vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 16 }}>
                        <span>Genel Toplam</span>
                        <span>₺{grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} disabled={cartItems.length === 0 || submitting} onClick={placeOrder} id="place-order-btn">
                        {submitting ? 'Sipariş veriliyor...' : '✓ Sipariş Onayla'}
                    </button>
                </div>
            </div>
        </div>
    );
}
