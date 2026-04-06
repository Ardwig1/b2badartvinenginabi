'use client';
import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchCompanyDetail, searchAdminProducts, addAdminCartItem, placeAdminOrder, addExtraDiscount, deleteExtraDiscount } from './actions';
import { ArrowLeftIcon, BuildingOfficeIcon, ShoppingCartIcon, MagnifyingGlassIcon, DocumentTextIcon, BanknotesIcon, ExclamationCircleIcon, CheckCircleIcon, TrashIcon, PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';

const statusMap = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

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

function ActivityIcon({ type }) {
    if (type === 'search') return <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 6, borderRadius: '50%' }}><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></div>;
    if (type?.startsWith('cart_')) return <div style={{ background: '#fef3c7', color: '#d97706', padding: 6, borderRadius: '50%' }}><ShoppingCartIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'order_placed') return <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: '50%' }}><CheckCircleIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'payment_init') return <div style={{ background: '#dcfce7', color: '#16a34a', padding: 6, borderRadius: '50%' }}><BanknotesIcon style={{ width: 14, height: 14 }} /></div>;
    if (type === 'payment_failed') return <div style={{ background: '#fee2e2', color: '#dc2626', padding: 6, borderRadius: '50%' }}><ExclamationCircleIcon style={{ width: 14, height: 14 }} /></div>;
    return <div style={{ background: '#f3f4f6', color: '#4b5563', padding: 6, borderRadius: '50%' }}><DocumentTextIcon style={{ width: 14, height: 14 }} /></div>;
}

function ActivityText({ act }) {
    if (act.action_type === 'search') {
        const d = act.details || {};
        const parts = [];
        if (d.text) parts.push(`"${d.text}"`);
        if (d.brand) parts.push(`Marka: ${d.brand}`);
        if (d.carBrand) parts.push(`Araç: ${d.carBrand}`);
        if (d.carModel) parts.push(`Model: ${d.carModel}`);
        
        if (parts.length === 0) return <span>Ürün listesini inceledi (Kriter seçilmedi)</span>;
        return <span>Aradı: <strong>{parts.join(' / ')}</strong></span>;
    }
    if (act.action_type === 'cart_add') return <span>Sepete Eklendi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''} ({act.details?.qty} adet)</span>;
    if (act.action_type === 'cart_update') return <span>Sepet Güncellendi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''} ({act.details?.prevQty} → {act.details?.newQty} adet)</span>;
    if (act.action_type === 'cart_remove') return <span>Sepetten Silindi: <strong>{act.details?.name || 'Ürün'}</strong>{act.details?.oem_no ? <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}> (OEM: {act.details.oem_no})</span> : ''}</span>;
    if (act.action_type === 'cart_clear') return <span>Sepet Temizlendi (Veya Sıfırlandı)</span>;
    if (act.action_type === 'order_placed') return <span style={{ color: 'var(--success)', fontWeight: 600 }}>Sipariş Verildi! (Sepet Boşaltıldı) - Toplam: {act.details?.total ? `${act.details.total.toLocaleString('tr-TR')} TL` : 'Belirsiz'}</span>;
    if (act.action_type === 'payment_init') return <span>Ödeme İşlemi Başlatıldı (Tosla) - Tutar: <strong>{act.details?.amount ? `${(parseFloat(act.details.amount)/100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL` : 'Belirsiz'}</strong></span>;
    if (act.action_type === 'payment_failed') return <span>Ödeme Başarısız (Banka Reddetti) - Nedeni: <strong style={{color: 'var(--danger)'}}>{act.details?.errMsg || 'Bilinmiyor'}</strong></span>;
    return <span>{act.action_type}</span>;
}

export default function AdminCompanyDetail() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState(null);
    const [activities, setActivities] = useState([]);
    const [orders, setOrders] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [cart, setCart] = useState([]);
    const [extraDiscounts, setExtraDiscounts] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [errorMsg, setErrorMsg] = useState('');
    const [showTxModal, setShowTxModal] = useState(false);
    const [txForm, setTxForm] = useState({ type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [addQty, setAddQty] = useState(1);
    const [adding, setAdding] = useState(false);
    const [extraData, setExtraData] = useState({ settings: null, usdSettings: null, marketRates: { USD: 1, EUR: 1 } });
    const [orderSaving, setOrderSaving] = useState(false);
    const [extraDiscRate, setExtraDiscRate] = useState('10');
    const [isSavingExtra, setIsSavingExtra] = useState(false);

    // Editing states
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [txSaving, setTxSaving] = useState(false);

    const searchRef = useRef(null);

    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const [expandedRow, setExpandedRow] = useState(null);

    const handleExpand = async (tx) => {
        if (expandedRow === tx.id) { setExpandedRow(null); return; }
        setExpandedRow(tx.id);
        if (tx.transaction_type === 'TOPTAN SATIŞ' && !orderDetails[tx.id]) {
            setLoadingDetails(prev => ({ ...prev, [tx.id]: true }));
            const searchId = tx.order_id || tx.document_no;
            const { data } = await supabase.from('order_items')
                .select('*, product:products(name, code, oem_no)')
                .eq('order_id', searchId);
            setOrderDetails(prev => ({ ...prev, [tx.id]: data || [] }));
            setLoadingDetails(prev => ({ ...prev, [tx.id]: false }));
        }
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
    const formatDate = (dateStr) => new Date(dateStr).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const openEditModal = async (tx) => {
        let items = [];
        if (tx.transaction_type === 'TOPTAN SATIŞ') {
            const { data } = await supabase.from('order_items')
                .select('*, product:products(name, code, oem_no)')
                .eq('order_id', tx.order_id || tx.document_no);
            items = (data || []).map(item => ({
                ...item,
                unit_price_vat: (parseFloat(item.unit_price) * 1.20).toFixed(2)
            }));
        }
        const date = new Date(tx.created_at);
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date - tzOffset).toISOString().slice(0, 16);
        setEditForm({ ...tx, created_at: localISOTime, order_items: items });
        setShowEditModal(true);
    };

    const handleEditTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const localDate = new Date(editForm.created_at);
            const utcDate = new Date(localDate.getTime()).toISOString();
            const payload = {
                ...editForm,
                created_at: utcDate,
                order_items: editForm.order_items.map(item => ({
                    ...item,
                    unit_price: parseFloat(item.unit_price_vat) / 1.20,
                    total_price: (parseFloat(item.unit_price_vat) / 1.20) * parseInt(item.quantity)
                }))
            };
            const res = await fetch('/api/admin/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Güncelleme başarısız');
            setShowEditModal(false);
            fetchDetails(); 
        } catch(err) { alert('Hata: ' + err.message); }
        setTxSaving(false);
    };

    const handleDeleteTx = async (tx) => {
        if (!confirm('Bu cari işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm bakiyeler yeniden hesaplanır.')) return;
        try {
            const res = await fetch(`/api/admin/transactions?id=${tx.id}&companyId=${tx.company_id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Silme işlemi başarısız');
            fetchDetails();
        } catch (err) { alert('Hata: ' + err.message); }
    };

    const updateEditItem = (idx, field, val) => {
        const newItems = [...editForm.order_items];
        newItems[idx][field] = val;
        const newDebtVat = newItems.reduce((acc, item) => acc + (parseInt(item.quantity || 0) * parseFloat(item.unit_price_vat || 0)), 0);
        setEditForm(prev => ({ ...prev, order_items: newItems, debt: prev.transaction_type === 'TOPTAN SATIŞ' ? newDebtVat : prev.debt }));
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (searchRef.current && !searchRef.current.contains(event.target)) { setSearchResults([]); }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
            setExtraDiscounts(res.data.extraDiscounts || []);
            setExtraData({ settings: res.data.settings, usdSettings: res.data.usdSettings, marketRates: res.data.marketRates || { USD: 1, EUR: 1 } });
        } catch (e) { setErrorMsg(e.message); }
        setLoading(false);
    }, [params.id]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

    const handleAddTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const res = await fetch('/api/admin/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: company.id, type: txForm.type, amount: txForm.amount, description: txForm.description === 'Diğer' ? txForm.customDescription : txForm.description, documentNo: txForm.documentNo }) });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'İşlem başarısız');
            setShowTxModal(false);
            setTxForm({ type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
            fetchDetails(); 
        } catch(err) { alert('Hata: ' + err.message); }
        setTxSaving(false);
    };

    const handleSearch = async (val) => {
        setSearchTerm(val);
        if (val.length < 2) { setSearchResults([]); return; }
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
            if (res.success) { setShowAddModal(false); setSearchTerm(''); setSearchResults([]); setSelectedProduct(null); setAddQty(1); fetchDetails(); }
            else { alert('Hata: ' + res.error); }
        } catch (e) { alert('Hata: ' + e.message); }
        setAdding(false);
    };

    const handleAddExtraDiscount = async () => {
        if (!selectedProduct || !extraDiscRate) return;
        setIsSavingExtra(true);
        const res = await addExtraDiscount(company.id, selectedProduct.id, extraDiscRate);
        if (res.success) { setSelectedProduct(null); setSearchTerm(''); setSearchResults([]); fetchDetails(); }
        else { alert('Hata: ' + res.error); }
        setIsSavingExtra(false);
    };

    const handleDeleteExtraDiscount = async (id) => {
        if (!confirm('Bu ek iskontoyu silmek istediğinize emin misiniz?')) return;
        const res = await deleteExtraDiscount(id, company.id);
        if (res.success) fetchDetails();
        else alert('Hata: ' + res.error);
    };

    const getBaseTryPrice = (p) => {
        if (!p) return 0;
        const globalMargin = extraData.settings?.margin || 36;
        const usdActive = extraData.usdSettings?.is_active;
        const usdRate = Number(extraData.usdSettings?.usd_rate);
        let initialPrice = Number(p.list_price) || 0;
        let marginBase = (Number(p.profit_margin) || 36) / 100;
        let rawCost = initialPrice / (1 + marginBase);
        let currentPrice = rawCost * (1 + (globalMargin / 100));
        if (usdActive && usdRate !== null && usdRate >= 0 && p.currency === 'USD') { currentPrice = currentPrice * usdRate; }
        else {
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
        return basePrice * (1 - productDiscount / 100) * (1 - groupDiscount / 100);
    };

    const calculateTotals = () => {
        let subtotal = 0;
        const processedItems = cart.map(item => {
            const p = item.fullProduct;
            const qty = item.qty;
            const base = getBaseTryPrice(p);
            const prodDiscount = Number(p.discount_rate || 0);
            const pg = Array.isArray(company?.price_group) ? company.price_group[0] : company?.price_group;
            const groupDiscount = pg?.discount_percent || 0;
            const normalPrice = base * (1 - prodDiscount / 100) * (1 - groupDiscount / 100);
            const extra = extraDiscounts.find(d => d.product_id === p.id && !d.is_used);
            let itemTotal = 0;
            let finalUnitPrice = normalPrice;
            if (extra) {
                const extraDiscPrice = normalPrice * (1 - Number(extra.discount_rate) / 100);
                itemTotal = (extraDiscPrice * 1) + (normalPrice * (qty - 1));
                finalUnitPrice = itemTotal / qty;
            } else { itemTotal = normalPrice * qty; }
            subtotal += itemTotal;
            return { ...item, price: finalUnitPrice, total: itemTotal, hasExtra: !!extra, extraRate: extra?.discount_rate };
        });
        const tax = subtotal * 0.20;
        const total = subtotal + tax;
        return { items: processedItems, subtotal, tax, total };
    };

    if (loading) return <div className="page-wrapper"><div className="loading-center"><div className="loading-spinner" /></div></div>;
    if (errorMsg) return <div className="page-wrapper"><div className="empty-state" style={{ color: 'red' }}>Veritabanı Hatası: {errorMsg}</div></div>;
    if (!company) return <div className="page-wrapper"><div className="empty-state">Firma bulunamadı.</div></div>;

    return (
        <div className="page-wrapper">
            <div className="page-header" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/admin/companies')} style={{ paddingLeft: 0, marginBottom: 8, color: 'var(--text-secondary)' }}><ArrowLeftIcon style={{ width: 14, height: 14, marginRight: 4 }} /> Firmalara Dön</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 48, height: 48, background: 'var(--brand)', color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BuildingOfficeIcon style={{ width: 24, height: 24 }} /></div>
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
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button className="btn btn-primary" onClick={() => setShowTxModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BanknotesIcon style={{ width: 18, height: 18 }} /> Bakiye İşlemi (Borç/Alacak)</button></div>
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
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{company.address ? `${company.address}${company.district ? `, ${company.district}` : ''}${company.city ? ` / ${company.city}` : ''}` : 'Adres bilgisi yok'}</div>
                        {(() => {
                            const pg = Array.isArray(company.price_group) ? company.price_group[0] : company.price_group;
                            if (!pg) return null;
                            return (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Fiyat Grubu:</span>{' '}
                                    <strong style={{ color: 'var(--brand)' }}>{pg.name} {pg.discount_percent !== undefined ? `(%${pg.discount_percent} İskonto)` : ''}</strong>
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
                <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Sipariş Geçmişi ({orders.length})</button>
                <button className={`tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Cari Hesap Hareketleri ({transactions.length})</button>
                <button className={`tab ${activeTab === 'extra_discount' ? 'active' : ''}`} onClick={() => setActiveTab('extra_discount')}>Ek İskonto Sayfası</button>
            </div>

            {/* TAB CONTENT */}
            {activeTab === 'extra_discount' && (
                <div className="card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>Firma Bazlı Ek İskonto Yönetimi</h3>
                    <div style={{ background: 'rgba(37, 99, 235, 0.03)', padding: 20, borderRadius: 12, border: '1px solid rgba(37, 99, 235, 0.1)', marginBottom: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px auto', gap: 16, alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={searchRef}>
                                <label className="form-label">Ürün Ara</label>
                                <input type="text" className="form-input" placeholder="İsim, kod veya OEM..." value={searchTerm} onChange={e => handleSearch(e.target.value)} />
                                {searchResults.length > 0 && !selectedProduct && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 300, overflowY: 'auto', background: '#0f172a', borderRadius: 12, zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
                                        {searchResults.map(p => (
                                            <div key={p.id} onClick={() => { setSelectedProduct(p); setSearchTerm(p.name); setSearchResults([]); }} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#f8fafc' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.code} | {p.oem_no}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">İskonto (%)</label><input type="number" className="form-input" value={extraDiscRate} onChange={e => setExtraDiscRate(e.target.value)} /></div>
                            <button className="btn btn-primary" style={{ height: 44 }} onClick={handleAddExtraDiscount} disabled={!selectedProduct || isSavingExtra}>Tanımla</button>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Ürün</th><th>OEM / Kod</th><th style={{ textAlign: 'center' }}>Ek İskonto</th><th style={{ textAlign: 'center' }}>İşlem</th></tr></thead>
                            <tbody>
                                {extraDiscounts.map(disc => (
                                    <tr key={disc.id}>
                                        <td style={{ fontWeight: 600 }}>{disc.product?.name}</td>
                                        <td>{disc.product?.code} <br /> <small>{disc.product?.oem_no}</small></td>
                                        <td style={{ textAlign: 'center' }}><span style={{ background: disc.is_used ? 'rgba(239, 68, 68, 0.1)' : 'rgba(22, 163, 74, 0.1)', color: disc.is_used ? '#ef4444' : '#16a34a', padding: '4px 10px', borderRadius: 20, fontWeight: 700 }}>%{disc.discount_rate} {disc.is_used && '(Kullanıldı)'}</span></td>
                                        <td style={{ textAlign: 'center' }}><button className="btn btn-ghost" onClick={() => handleDeleteExtraDiscount(disc.id)} style={{ color: 'var(--danger)' }}><TrashIcon style={{ width: 18, height: 18 }} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'cart' && (
                <div className="card" style={{ padding: 0 }}>
                    {cart.length === 0 ? <div className="empty-state" style={{ padding: 40 }}>Sepet boş.</div> : (() => {
                        const { items: processedItems, subtotal, tax, total } = calculateTotals();
                        return (
                            <div className="table-wrapper">
                                <table>
                                    <thead><tr><th>Ürün</th><th>OEM No</th><th style={{ textAlign: 'center' }}>Adet</th><th style={{ textAlign: 'right' }}>Birim Fiyat</th><th style={{ textAlign: 'right' }}>Ara Toplam</th></tr></thead>
                                    <tbody>{processedItems.map((item, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{item.fullProduct?.name}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{item.fullProduct?.oem_no}</td>
                                            <td style={{ textAlign: 'center' }}>{item.qty}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                                <div style={{ padding: 24, display: 'flex', justifyContent: 'flex-end', gap: 40 }}>
                                    <div style={{ minWidth: 200 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>KDV (%20):</span><span>{formatCurrency(tax)}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, borderTop: '1px solid var(--border)', marginTop: 8 }}><span>GENEL TOPLAM:</span><span>{formatCurrency(total)}</span></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="card">
                    {activities.map(act => (
                        <div key={act.id} style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <ActivityIcon type={act.action_type} />
                            <div><div style={{ fontSize: 14 }}><ActivityText act={act} /></div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(act.created_at)}</div></div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'orders' && (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                        <table>
                            <thead><tr><th>Sipariş No</th><th>Tarih</th><th>Tutar</th><th>Durum</th></tr></thead>
                            <tbody>{orders.map(o => (
                                <tr key={o.id}>
                                    <td style={{ fontWeight: 600 }}>#{o.id.split('-')[0]}</td>
                                    <td>{formatDate(o.created_at)}</td>
                                    <td>{formatCurrency(o.total_amount)}</td>
                                    <td><span className={`badge ${statusBadge[o.status]}`}>{statusMap[o.status]}</span></td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (() => {
                const totalDebt = transactions.reduce((acc, tx) => acc + (Number(tx.debt) || 0), 0);
                const totalCredit = transactions.reduce((acc, tx) => acc + (Number(tx.credit) || 0), 0);
                return (
                    <div className="card" style={{ padding: 0 }}>
                        <div className="table-wrapper">
                            <table>
                                <thead><tr><th style={{ textAlign: 'center' }}>İşlem</th><th>Tarih</th><th>Evrak No</th><th>Tür</th><th style={{ textAlign: 'right' }}>Borç</th><th style={{ textAlign: 'right' }}>Alacak</th><th style={{ textAlign: 'right' }}>Bakiye</th><th style={{ textAlign: 'center' }}>Sil</th></tr></thead>
                                <tbody>{transactions.map(tx => {
                                    const isExpanded = expandedRow === tx.id;
                                    return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    <button onClick={() => handleExpand(tx)} className="btn btn-sm btn-ghost">{isExpanded ? 'Gizle' : 'Detay'}</button>
                                                    <button onClick={() => openEditModal(tx)} className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 8px' }}><PencilSquareIcon style={{ width: 14, height: 14 }} /></button>
                                                </div>
                                            </td>
                                            <td>{formatDate(tx.created_at)}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{tx.document_no?.toUpperCase()}</td>
                                            <td>{tx.transaction_type}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{tx.debt > 0 ? formatCurrency(tx.debt) : '-'}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{tx.credit > 0 ? formatCurrency(tx.credit) : '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? '#ef4444' : '#22c55e' }}>{formatCurrency(tx.balance_after)}</td>
                                            <td style={{ textAlign: 'center' }}><button onClick={() => handleDeleteTx(tx)} className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }}><TrashIcon style={{ width: 16, height: 16 }} /></button></td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '8px 24px 20px 80px', background: 'transparent' }}>
                                                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 20, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
                                                        <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12, fontWeight: 800, letterSpacing: '1px' }}>
                                                            {tx.transaction_type === 'TOPTAN SATIŞ' ? `İşlem İçeriği — ${tx.document_no?.slice(0, 8).toUpperCase()}` : 'İşlem Detayı'}
                                                        </h4>
                                                        {tx.transaction_type === 'TOPTAN SATIŞ' ? (
                                                            loadingDetails[tx.id] ? (
                                                                <div style={{ fontSize: 13, color: '#cbd5e1' }}>Yükleniyor...</div>
                                                            ) : (orderDetails[tx.id] || []).length === 0 ? (
                                                                <div style={{ fontSize: 13, color: '#cbd5e1' }}>İçerik bulunamadı.</div>
                                                            ) : (
                                                                <table style={{ margin: 0, fontSize: 13, background: 'transparent' }}>
                                                                    <thead>
                                                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                                                            <th style={{ color: '#94a3b8' }}>Ürün Kodu</th>
                                                                            <th style={{ color: '#94a3b8' }}>Ürün Adı</th>
                                                                            <th style={{ textAlign: 'right', color: '#94a3b8' }}>Miktar</th>
                                                                            <th style={{ textAlign: 'right', color: '#94a3b8' }}>Birim Fiyat (KDV'li)</th>
                                                                            <th style={{ textAlign: 'right', color: '#94a3b8' }}>Tutar</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {orderDetails[tx.id].map(item => (
                                                                            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                <td style={{ color: '#cbd5e1' }}>{item.product?.code}</td>
                                                                                <td style={{ color: '#f8fafc' }}>{item.product?.name}</td>
                                                                                <td style={{ textAlign: 'right', color: '#cbd5e1' }}>{item.quantity}</td>
                                                                                <td style={{ textAlign: 'right', color: '#cbd5e1' }}>{formatCurrency(item.unit_price * 1.20)}</td>
                                                                                <td style={{ textAlign: 'right', color: '#f8fafc', fontWeight: 600 }}>{formatCurrency(item.total_price * 1.20)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        ) : (
                                                            <div style={{ fontSize: 14, color: '#cbd5e1' }}><strong>Açıklama:</strong> {tx.description || '-'}</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );})}</tbody>
                                <tfoot>
                                    <tr style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                                        <td colSpan="4" style={{ textAlign: 'right' }}>GENEL TOPLAM</td>
                                        <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatCurrency(totalDebt)}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatCurrency(totalCredit)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalCredit - totalDebt)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                );
            })()}

            {/* MODALS */}
            {showTxModal && (
                <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Bakiye İşlemi Ekle</h3><button onClick={() => setShowTxModal(false)}>✕</button></div>
                        <form onSubmit={handleAddTx}>
                            <select className="form-select" value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} required><option value="debt">Borçlandır</option><option value="credit">Alacaklandır</option></select>
                            <input className="form-input" type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} placeholder="Tutar" required />
                            <div className="form-group">
                                <label className="form-label">Açıklama Seçin *</label>
                                <select className="form-select" value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} required>
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
                                        onChange={e => setTxForm({...txForm, customDescription: e.target.value})} 
                                        placeholder="Kendi açıklamanızı yazın..." 
                                        required 
                                    />
                                </div>
                            )}
                            <input className="form-input" type="text" value={txForm.documentNo} onChange={e => setTxForm({...txForm, documentNo: e.target.value})} placeholder="Evrak No" />
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={txSaving}>Kaydet</button>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && editForm && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" style={{ maxWidth: 650, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>İşlemi Düzenle</h3><button onClick={() => setShowEditModal(false)}>✕</button></div>
                        <form onSubmit={handleEditTx}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group"><label>Tarih</label><input className="form-input" type="datetime-local" value={editForm.created_at} onChange={e => setEditForm({...editForm, created_at: e.target.value})} required /></div>
                                <div className="form-group"><label>Evrak No</label><input className="form-input" type="text" value={editForm.document_no} onChange={e => setEditForm({...editForm, document_no: e.target.value})} /></div>
                            </div>
                            <div className="form-group"><label>Açıklama</label><input className="form-input" type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /></div>
                            {editForm.transaction_type === 'TOPTAN SATIŞ' && (
                                <div style={{ marginTop: 20 }}>
                                    <h4 style={{ marginBottom: 10 }}>SİPARİŞ İÇERİĞİ</h4>
                                    <div className="table-wrapper"><table style={{ fontSize: 12 }}>
                                        <thead><tr><th>Ürün</th><th style={{ textAlign: 'right' }}>Miktar</th><th style={{ textAlign: 'right' }}>Birim Fiyat (KDV'li)</th><th style={{ textAlign: 'right' }}>Toplam</th></tr></thead>
                                        <tbody>{editForm.order_items.map((item, idx) => (
                                            <tr key={item.id}>
                                                <td><div>{item.product?.code}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.product?.name}</div></td>
                                                <td style={{ textAlign: 'right' }}><input className="form-input" style={{ textAlign: 'right', padding: 4, width: 60 }} type="number" value={item.quantity} onChange={e => updateEditItem(idx, 'quantity', e.target.value)} /></td>
                                                <td style={{ textAlign: 'right' }}><input className="form-input" style={{ textAlign: 'right', padding: 4, width: 80 }} type="number" step="0.01" value={item.unit_price_vat} onChange={e => updateEditItem(idx, 'unit_price_vat', e.target.value)} /></td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(item.quantity * item.unit_price_vat)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table></div>
                                    <div style={{ textAlign: 'right', marginTop: 16, fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>YENİ TOPLAM BORÇ: {formatCurrency(editForm.debt)}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}><button type="button" className="btn btn-ghost" onClick={() => setShowEditModal(false)}>İptal</button><button type="submit" className="btn btn-primary" style={{ background: '#f59e0b' }} disabled={txSaving}>Değişiklikleri Kaydet</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
