'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCompanyDetail, searchAdminProducts, addAdminCartItem, placeAdminOrder } from './actions';
import { ArrowLeftIcon, BuildingOfficeIcon, ShoppingCartIcon, MagnifyingGlassIcon, DocumentTextIcon, BanknotesIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const statusMap = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

function ActivityIcon({ type }) {
    if (type === 'search') return <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 6, borderRadius: '50%' }}><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></div>;
    if (type?.startsWith('cart_')) return <div style={{ background: '#fef3c7', color: '#d97706', padding: 6, borderRadius: '50%' }}><ShoppingCartIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'order_placed') return <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: '50%' }}><CheckCircleIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'payment_init') return <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: '50%' }}><BanknotesIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'payment_failed') return <div style={{ background: '#fee2e2', color: '#dc2626', padding: 6, borderRadius: '50%' }}><ExclamationCircleIcon style={{ width: 14, height: 14 }} /></div>;
    return <div style={{ background: '#f3f4f6', color: '#4b5563', padding: 6, borderRadius: '50%' }}><DocumentTextIcon style={{ width: 14, height: 14 }} /></div>;
}

function ActivityText({ act }) {
    if (act.action_type === 'search') return <span>Aradı: <strong>{act.details?.text || act.details?.term || 'Bilinmiyor'}</strong> {act.details?.brand ? `(Marka: ${act.details.brand})` : ''}</span>;
    if (act.action_type === 'cart_add') return <span>Sepete Eklendi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''} ({act.details?.qty} adet)</span>;
    if (act.action_type === 'cart_update') return <span>Sepet Güncellendi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''} ({act.details?.prevQty} → {act.details?.newQty} adet)</span>;
    if (act.action_type === 'cart_remove') return <span>Sepetten Silindi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''}</span>;
    if (act.action_type === 'cart_clear') return <span>Sepet Temizlendi (Veya Sıfırlandı)</span>;
    if (act.action_type === 'order_placed') return <span style={{ color: 'var(--success)', fontWeight: 600 }}>Sipariş Verildi! (Sepet Boşaltıldı) - Toplam: {act.details?.total ? `${act.details.total.toLocaleString('tr-TR')} TL` : 'Belirsiz'}</span>;
    if (act.action_type === 'payment_init') return <span>Ödeme İşlemi Başlatıldı (Tosla) - Tutar: <strong>{act.details?.amount ? `${(parseFloat(act.details.amount)/100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : 'Belirsiz'}</strong></span>;
    if (act.action_type === 'payment_failed') return <span>Ödeme Başarısız (Banka Reddetti) - Nedeni: <strong style={{color: 'var(--danger)'}}>{act.details?.errMsg || 'Bilinmiyor'}</strong></span>;
    return <span>{act.action_type}</span>;
}

const presetDescriptions = [
    "YapıKredi Link Pos",
    "Tosla Link Pos",
    "QNB Link Pos",
    "İş Bankası Link Pos",
    "EnPara Pos",
    "YapıKredi IBAN",
    "İşBankası IBAN",
    "Nakit",
    "İade",
    "Diğer"
];

export default function AdminCompanyDetail() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState(null);
    const [activities, setActivities] = useState([]);
    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cart, setCart] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [errorMsg, setErrorMsg] = useState('');
    const [showTxModal, setShowTxModal] = useState(false);
    const [txForm, setTxForm] = useState({ type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
    const [txSaving, setTxSaving] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [addQty, setAddQty] = useState(1);
    const [adding, setAdding] = useState(false);
    const [extraData, setExtraData] = useState({ settings: null, usdSettings: null, marketRates: { USD: 1, EUR: 1 } });
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderSaving, setOrderSaving] = useState(false);

    const fetchDetails = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);

        try {
            const res = await fetchCompanyDetail(params.id);
            if (!res.success) throw new Error(res.error);

            setCompany(res.data.company);
            setActivities(res.data.activities);
            setOrders(res.data.orders);
            setTransactions(res.data.transactions);
            setCart(res.data.cart || []);
            setExtraData({
                settings: res.data.settings,
                usdSettings: res.data.usdSettings,
                marketRates: res.data.marketRates || { USD: 1, EUR: 1 }
            });
        } catch (e) {
            console.error('Fetch Error:', e);
            setErrorMsg(e.message);
        }

        setLoading(false);
    }, [params.id]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    const handleAddTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const res = await fetch('/api/admin/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: company.id,
                    type: txForm.type,
                    amount: txForm.amount,
                    description: txForm.description === 'Diğer' ? txForm.customDescription : txForm.description,
                    documentNo: txForm.documentNo
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'İşlem başarısız');
            setShowTxModal(false);
            setTxForm({ type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
            fetchDetails(); // Reload data immediately
        } catch(err) {
            alert('Hata: ' + err.message);
        }
        setTxSaving(false);
    };

    const handleSearch = async (val) => {
        setSearchTerm(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        const res = await searchAdminProducts(val);
        if (res.success) setSearchResults(res.data);
        setSearching(false);
    };

    const handleAddCartItem = async () => {
        if (!selectedProduct) return;
        setAdding(true);
        try {
            const res = await addAdminCartItem(company.id, selectedProduct, addQty);
            if (res.success) {
                setShowAddModal(false);
                setSearchTerm('');
                setSearchResults([]);
                setSelectedProduct(null);
                setAddQty(1);
                fetchDetails(); // Refresh cart
            } else {
                alert('Hata: ' + res.error);
            }
        } catch (e) {
            alert('Hata: ' + e.message);
        }
        setAdding(false);
    };

    // PRICING LOGIC (Matching Catalog)
    const getBaseTryPrice = (p) => {
        if (!p) return 0;
        const globalMargin = extraData.settings?.margin || 36;
        const usdActive = extraData.usdSettings?.is_active;
        const usdRate = Number(extraData.usdSettings?.usd_rate);
        
        let initialPrice = Number(p.list_price) || 0;
        let rawCost = initialPrice / 1.36;
        let currentPrice = rawCost * (1 + (globalMargin / 100));

        if (usdActive && usdRate !== null && usdRate >= 0 && p.currency === 'USD') {
            currentPrice = currentPrice * usdRate;
        } else {
            if (p.currency === 'USD') currentPrice = currentPrice * extraData.marketRates.USD;
            else if (p.currency === 'EUR') currentPrice = currentPrice * extraData.marketRates.EUR;
        }
        return currentPrice;
    };

    const getDiscountedPrice = (p) => {
        const basePrice = getBaseTryPrice(p);
        const productDiscount = Number(p.discount_rate) || 0;
        const pg = Array.isArray(company?.price_group) ? company.price_group[0] : company?.price_group;
        const groupDiscount = pg?.discount_percent || 0;
        
        const afterProductDiscount = basePrice * (1 - productDiscount / 100);
        const afterGroupDiscount = afterProductDiscount * (1 - groupDiscount / 100);
        return afterGroupDiscount;
    };

    const getKdvPrice = (p) => getDiscountedPrice(p) * 1.20;

    const calculateTotals = () => {
        let subtotal = 0;
        const processedItems = cart.map(item => {
            const price = getDiscountedPrice(item.fullProduct);
            const total = price * item.qty;
            subtotal += total;
            return { ...item, price, total };
        });
        const tax = subtotal * 0.20;
        const total = subtotal + tax;
        return { items: processedItems, subtotal, tax, total };
    };

    const handlePlaceOrder = async () => {
        const totals = calculateTotals();
        setOrderSaving(true);
        const res = await placeAdminOrder(company.id, totals.items, totals);
        if (res.success) {
            setShowOrderModal(false);
            fetchDetails(); // Refresh all
            alert('Sipariş başarıyla oluşturuldu!');
        } else {
            alert('Hata: ' + res.error);
        }
        setOrderSaving(false);
    };

    if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="loading-spinner" /></div></div>;
    if (errorMsg) return <div className="page-wrapper"><div className="empty-state" style={{ color: 'red' }}>Veritabanı Hatası: {errorMsg}</div></div>;
    if (!company) return <div className="page-wrapper"><div className="empty-state">Firma bulunamadı.</div></div>;

    const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0);
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/companies')} style={{ paddingLeft: 0, marginBottom: 8, color: 'var(--text-secondary)' }}>
                        <ArrowLeftIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Firmalara Dön
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, background: 'var(--brand)', color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BuildingOfficeIcon style={{ width: 24, height: 24 }} />
                        </div>
                        <div>
                            <h1 className="page-title" style={{ margin: 0 }}>{company.name}</h1>
                            <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                <span>Vergi No: <strong style={{ color: 'var(--text-primary)' }}>{company.tax_number}</strong></span>
                                <span>•</span>
                                <span>Durum: <span className={`badge ${statusBadge[company.status]}`} style={{ padding: '2px 6px', fontSize: 11 }}>{statusMap[company.status]}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button className="btn btn-primary" onClick={() => setShowTxModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <BanknotesIcon style={{ width: 18, height: 18 }} /> Bakiye İşlemi (Borç/Alacak)
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Yetkili & İletişim</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{company.contact_person || 'Belirtilmedi'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{company.phone || '-'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{company.email || '-'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', marginBottom: 8, textTransform: 'uppercase' }}>📍 Adres & İskonto Grubu</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            {company.address ? `${company.address}${company.district ? `, ${company.district}` : ''}${company.city ? ` / ${company.city}` : ''}` : 'Adres bilgisi yok'}
                        </div>
                        {(() => {
                            const pg = Array.isArray(company.price_group) ? company.price_group[0] : company.price_group;
                            if (!pg) return null;
                            return (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Fiyat Grubu:</span>{' '}
                                    <strong style={{ color: 'var(--brand)' }}>
                                        {pg.name} {pg.discount_percent !== undefined ? `(%${pg.discount_percent} İskonto)` : ''}
                                    </strong>
                                </div>
                            );
                        })()}
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Sistem Bilgileri</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Bayi Kodu:</span> <strong style={{ fontFamily: 'monospace' }}>{company.dealer_code || '-'}</strong></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Kullanıcı:</span> <strong style={{ fontFamily: 'monospace' }}>{company.user_code || '-'}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 24 }}>
                <button className={`tab ${activeTab === 'activity' ? 'active' : ''}`} onClick={() => setActiveTab('activity')}>Son Hareketler (Arama & Sepet)</button>
                <button className={`tab ${activeTab === 'cart' ? 'active' : ''}`} onClick={() => setActiveTab('cart')}>Güncel Sepeti ({cart.length})</button>
                <div style={{ marginLeft: 'auto', display: activeTab === 'cart' ? 'block' : 'none' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Ürün Ekle</button>
                </div>
                <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Sipariş Geçmişi ({orders.length})</button>
                <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Cari Hesap Hareketleri ({transactions.length})</button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'cart' && (
                <div className="card" style={{ padding: 0 }}>
                    {(!cart || cart.length === 0) ? (
                        <div className="empty-state" style={{ padding: 40 }}>Müşterinin sepeti şu anda boş.</div>
                    ) : (() => {
                        const { items: processedItems, subtotal, tax, total } = calculateTotals();
                        return (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Ürün</th>
                                        <th>OEM No</th>
                                        <th style={{ textAlign: 'center' }}>Adet</th>
                                        <th style={{ textAlign: 'right' }}>Birim Fiyat</th>
                                        <th style={{ textAlign: 'right' }}>Ara Toplam</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processedItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{item.fullProduct?.name || 'Bilinmeyen Ürün'}</td>
                                            <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{item.fullProduct?.oem_no || '-'}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand)' }}>{item.qty}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.price)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            <div style={{ padding: '24px', borderTop: '2px solid var(--border)', background: 'rgba(15, 23, 42, 0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                                            <span>Ara Toplam:</span>
                                            <span>{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)' }}>
                                            <span>KDV (%20):</span>
                                            <span>{formatCurrency(tax)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                                            <span>GENEL TOPLAM:</span>
                                            <span>{formatCurrency(total)}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                        <button 
                                            className="btn btn-primary" 
                                            style={{ height: 48, padding: '0 32px', fontSize: 15, fontWeight: 700 }}
                                            onClick={() => setShowOrderModal(true)}
                                        >
                                            <ShoppingCartIcon style={{ width: 20, height: 20, marginRight: 8 }} />
                                            Siparişi Oluştur
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.01)', fontSize: 12, color: 'var(--brand)', fontWeight: 500 }}>
                                * Birim fiyatlar; firmanın iskonto grubu, ürünün kampanya durumu ve güncel kur oranları dahil edilerek hesaplanmıştır.
                            </div>
                        </div>
                        );
                    })()}
                </div>
            )}
            {activeTab === 'activity' && (
                <div className="card">
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>Müşterinin Son İşlemleri</h3>
                    {(!activities || activities.length === 0) ? (
                        <div className="empty-state">Henüz herhangi bir arama veya sepete ekleme işlemi yapmamış.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
                            {/* Dikey çizgi */}
                            <div style={{ position: 'absolute', left: 19, top: 10, bottom: 10, width: 2, background: 'var(--border)', zIndex: 0 }} />

                            {activities.map(act => (
                                <div key={act.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                    <div style={{ background: 'var(--bg-card)', padding: '4px 0' }}><ActivityIcon type={act.action_type} /></div>
                                    <div style={{ background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 10, flex: 1 }}>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}><ActivityText act={act} /></div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(act.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="card" style={{ padding: 0 }}>
                    {(!orders || orders.length === 0) ? (
                        <div className="empty-state" style={{ padding: 40 }}>Sipariş bulunamadı.</div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sipariş No</th>
                                        <th>Tarih</th>
                                        <th>Tutar</th>
                                        <th>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(o => (
                                        <tr key={o.id}>
                                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{o.id.split('-')[0]}</td>
                                            <td>{formatDate(o.created_at)}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--brand)' }}>{formatCurrency(o.total_amount)}</td>
                                            <td>
                                                <span className={`badge ${o.status === 'delivered' ? 'badge-approved' : (o.status === 'cancelled' ? 'badge-rejected' : 'badge-pending')}`}>
                                                    {o.status === 'delivered' ? 'Teslim Edildi' : (o.status === 'cancelled' ? 'İptal' : 'İşleniyor')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'transactions' && (() => {
                const totalDebt = transactions.reduce((acc, tx) => acc + (Number(tx.debt) || 0), 0);
                const totalCredit = transactions.reduce((acc, tx) => acc + (Number(tx.credit) || 0), 0);
                const finalBalance = transactions.length > 0 ? (transactions[0].balance_after || 0) : 0;

                return (
                    <div className="card" style={{ padding: 0 }}>
                        {(!transactions || transactions.length === 0) ? (
                            <div className="empty-state" style={{ padding: 40 }}>Cari işlem veya fatura bulunamadı.</div>
                        ) : (
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Tarih</th>
                                            <th>Vade Tarihi</th>
                                            <th>Evrak No</th>
                                            <th>İşlem Türü</th>
                                            <th style={{ textAlign: 'right' }}>Borç</th>
                                            <th style={{ textAlign: 'right' }}>Alacak</th>
                                            <th style={{ textAlign: 'right' }}>Bakiye</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map(tx => (
                                            <tr key={tx.id}>
                                                <td style={{ fontWeight: 500 }}>{formatDate(tx.created_at)}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{tx.due_date ? new Date(tx.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{tx.document_no ? tx.document_no.slice(0, 8).toUpperCase() : '-'}</td>
                                                <td>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: tx.transaction_type === 'KREDİ KARTI' || tx.transaction_type === 'HAVALE/EFT' || tx.transaction_type?.includes('TAHSİLAT') ? 'var(--success)' :
                                                                tx.transaction_type === 'TOPTAN SATIŞ' ? 'var(--primary)' : 'var(--text-secondary)'
                                                    }}>
                                                        {tx.transaction_type}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: tx.debt > 0 ? 600 : 400, color: tx.debt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                    {tx.debt > 0 ? formatCurrency(tx.debt) : '0,00'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: tx.credit > 0 ? 600 : 400, color: tx.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                                    {tx.credit > 0 ? formatCurrency(tx.credit) : '0,00'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                                    {formatCurrency(tx.balance_after)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                                            <td colspan="4" style={{ textAlign: 'right', fontWeight: 700, padding: 16 }}>GENEL TOPLAM</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--danger)', fontSize: 15 }}>{formatCurrency(totalDebt)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)', fontSize: 15 }}>{formatCurrency(totalCredit)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 16, color: finalBalance < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatCurrency(finalBalance)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* BALANCE ADJUSTMENT MODAL */}
            {showTxModal && (
                <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Bakiye İşlemi Ekle</h3>
                            <button className="modal-close" onClick={() => setShowTxModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddTx}>
                            <div className="form-group">
                                <label className="form-label">İşlem Türü *</label>
                                <select className="form-select" value={txForm.type} onChange={e => setTxForm(prev => ({ ...prev, type: e.target.value }))} required>
                                    <option value="debt">Borçlandır (Firma Bize Borçlanır)</option>
                                    <option value="credit">Alacaklandır / Tahsilat (Firma Ödeme Yapar)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Tutar (₺) *</label>
                                <input className="form-input" type="number" step="0.01" min="0.01" value={txForm.amount} onChange={e => setTxForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="Örn: 1500.50" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Açıklama Seçin *</label>
                                <select 
                                    className="form-select" 
                                    value={txForm.description} 
                                    onChange={e => setTxForm(prev => ({ ...prev, description: e.target.value }))} 
                                    required
                                >
                                    {presetDescriptions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            {txForm.description === 'Diğer' && (
                                <div className="form-group">
                                    <label className="form-label">Manuel Açıklama *</label>
                                    <input 
                                        className="form-input" 
                                        type="text" 
                                        value={txForm.customDescription} 
                                        onChange={e => setTxForm(prev => ({ ...prev, customDescription: e.target.value }))} 
                                        placeholder="Kendi açıklamanızı yazın..." 
                                        required 
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Evrak / İşlem No</label>
                                <input className="form-input" type="text" value={txForm.documentNo} onChange={e => setTxForm(prev => ({ ...prev, documentNo: e.target.value }))} placeholder="(İsteğe bağlı)" />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowTxModal(false)}>İptal</button>
                                <button type="submit" className="btn btn-primary" disabled={txSaving}>{txSaving ? 'İşleniyor...' : 'İşlemi Kaydet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => { setShowAddModal(false); setSelectedProduct(null); setSearchResults([]); setSearchTerm(''); }}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Sepete Ürün Ekle</h3>
                            <button className="modal-close" onClick={() => { setShowAddModal(false); setSelectedProduct(null); setSearchResults([]); setSearchTerm(''); }}>✕</button>
                        </div>
                        <div style={{ padding: 20 }}>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label">Ürün Ara (İsim, Kod veya OEM)</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Ürün adı, kod veya OEM yazın..." 
                                        value={searchTerm} 
                                        onChange={e => handleSearch(e.target.value)}
                                        autoFocus
                                        style={{ paddingRight: 40 }}
                                    />
                                    {searching && <div style={{ position: 'absolute', right: 12, top: 11 }}><div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /></div>}
                                </div>
                                
                                {searchResults.length > 0 && !selectedProduct && (
                                    <div style={{ 
                                        marginTop: 8, 
                                        maxHeight: 250, 
                                        overflowY: 'auto', 
                                        border: '1px solid var(--border)', 
                                        borderRadius: 10,
                                        background: 'var(--bg-card)',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        zIndex: 10
                                    }}>
                                        {searchResults.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); setSearchResults([]); }}
                                                style={{ 
                                                    padding: '12px 16px', 
                                                    cursor: 'pointer', 
                                                    borderBottom: '1px solid var(--border)',
                                                    transition: 'all 0.2s',
                                                    backgroundColor: 'transparent'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.05)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{p.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 4 }}>
                                                    <span>Kod: <strong style={{ color: 'var(--text-secondary)' }}>{p.code}</strong></span>
                                                    <span>Marka: <strong style={{ color: 'var(--text-secondary)' }}>{p.brand}</strong></span>
                                                    <span>OEM: <strong style={{ color: 'var(--text-secondary)' }}>{p.oem_no}</strong></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedProduct && (
                                <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid var(--brand)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--brand)' }}>{selectedProduct.name}</div>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', height: 'auto', padding: '2px 8px' }} onClick={() => { setSelectedProduct(null); setSearchTerm(''); }}>Değiştir</button>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{selectedProduct.brand} | {selectedProduct.oem_no}</div>
                                    
                                    <div className="form-group" style={{ marginTop: 20, maxWidth: 140 }}>
                                        <label className="form-label">Eklenecek Adet</label>
                                        <input 
                                            type="number" 
                                            className="form-input" 
                                            min="1" 
                                            value={addQty} 
                                            onChange={e => setAddQty(e.target.value)} 
                                            style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="btn btn-ghost" onClick={() => { setShowAddModal(false); setSelectedProduct(null); setSearchResults([]); setSearchTerm(''); }}>İptal</button>
                                <button 
                                    className="btn btn-primary" 
                                    disabled={!selectedProduct || adding}
                                    onClick={handleAddCartItem}
                                    style={{ minWidth: 120 }}
                                >
                                    {adding ? 'Ekleniyor...' : 'Sepete Ekle'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showOrderModal && (
                <div className="modal-overlay" onClick={() => setShowOrderModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Sipariş Onayı</h3>
                            <button className="modal-close" onClick={() => setShowOrderModal(false)}>✕</button>
                        </div>
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ 
                                width: 64, height: 64, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                                color: 'var(--brand)'
                            }}>
                                <ShoppingCartIcon style={{ width: 32, height: 32 }} />
                            </div>
                            
                            <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Siparişi oluşturmak istiyor musunuz?</h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                                <strong>{company.name}</strong> firması adına <strong>{cart.length} kalem</strong> üründen oluşan 
                                <br />
                                <strong style={{ color: 'var(--text-primary)', fontSize: 20, display: 'block', marginTop: 8 }}>
                                    {formatCurrency(calculateTotals().total)}
                                </strong>
                                tutarındaki sipariş sisteme kaydedilecek ve cari hesaba borç olarak işlenecektir.
                            </p>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={() => setShowOrderModal(false)} style={{ minWidth: 120 }}>Vazgeç</button>
                                <button 
                                    className="btn btn-primary" 
                                    onClick={handlePlaceOrder} 
                                    disabled={orderSaving}
                                    style={{ minWidth: 160 }}
                                >
                                    {orderSaving ? 'Oluşturuluyor...' : 'Siparişi Tamamla'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
