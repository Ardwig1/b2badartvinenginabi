'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeftIcon, BuildingOfficeIcon, ShoppingCartIcon, MagnifyingGlassIcon, DocumentTextIcon, BanknotesIcon } from '@heroicons/react/24/outline';

const statusMap = { pending: 'Bekliyor', approved: 'Onaylı', rejected: 'Reddedildi' };
const statusBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' };

function ActivityIcon({ type }) {
    if (type === 'search') return <div style={{ background: '#e0f2fe', color: '#0284c7', padding: 6, borderRadius: '50%' }}><MagnifyingGlassIcon style={{ width: 14, height: 14 }} /></div>;
    if (type?.startsWith('cart_')) return <div style={{ background: '#fef3c7', color: '#d97706', padding: 6, borderRadius: '50%' }}><ShoppingCartIcon style={{ width: 14, height: 14 }} /></div>;
    return <div style={{ background: '#f3f4f6', color: '#4b5563', padding: 6, borderRadius: '50%' }}><DocumentTextIcon style={{ width: 14, height: 14 }} /></div>;
}

function ActivityText({ act }) {
    if (act.action_type === 'search') return <span>Aradı: <strong>{act.details?.text || act.details?.term || 'Bilinmiyor'}</strong> {act.details?.brand ? `(Marka: ${act.details.brand})` : ''}</span>;
    if (act.action_type === 'cart_add') return <span>Sepete Eklendi: <strong>{act.details?.name || 'Ürün'}</strong> ({act.details?.qty} adet)</span>;
    if (act.action_type === 'cart_update') return <span>Sepet Güncellendi: <strong>{act.details?.name || 'Ürün'}</strong> ({act.details?.prevQty} → {act.details?.newQty} adet)</span>;
    if (act.action_type === 'cart_remove') return <span>Sepetten Silindi: <strong>{act.details?.name || 'Ürün'}</strong></span>;
    return <span>{act.action_type}</span>;
}

export default function AdminCompanyDetail() {
    const params = useParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState(null);
    const [activities, setActivities] = useState([]);
    const [orders, setOrders] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [activeTab, setActiveTab] = useState('activity');
    const [errorMsg, setErrorMsg] = useState('');
    const supabase = createClient();

    const fetchDetails = useCallback(async () => {
        if (!params.id) return;
        setLoading(true);

        const [compRes, actRes, ordRes, invRes] = await Promise.all([
            supabase.from('companies').select('*, profiles(email)').eq('id', params.id).single(),
            supabase.from('user_activities').select('*').eq('company_id', params.id).order('created_at', { ascending: false }).limit(200),
            supabase.from('orders').select('*').eq('company_id', params.id).order('created_at', { ascending: false }),
            supabase.from('invoices').select('*').eq('company_id', params.id).order('created_at', { ascending: false })
        ]);

        if (compRes.error) {
            console.error('Company Fetch Error:', compRes.error);
            setErrorMsg(compRes.error.message || JSON.stringify(compRes.error));
        }
        if (compRes.data) setCompany(compRes.data);
        if (actRes.data) setActivities(actRes.data);
        if (ordRes.data) setOrders(ordRes.data);
        if (invRes.data) setInvoices(invRes.data);

        setLoading(false);
    }, [params.id, supabase]);

    useEffect(() => { fetchDetails(); }, [fetchDetails]);

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
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: 'var(--border)' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Yetkili & İletişim</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{company.contact_person || 'Belirtilmedi'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{company.phone || '-'}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{company.profiles?.[0]?.email || '-'}</div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '20px 24px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Adres</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                            {company.address ? `${company.address}${company.district ? `, ${company.district}` : ''}${company.city ? ` / ${company.city}` : ''}` : 'Adres bilgisi yok'}
                        </div>
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
                <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Sipariş Geçmişi ({orders.length})</button>
                <button className={`tab ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>Cari Hesap / Ekstre ({invoices.length})</button>
            </div>

            {/* TAB CONTENT */}
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

            {activeTab === 'invoices' && (
                <div className="card" style={{ padding: 0 }}>
                    {(!invoices || invoices.length === 0) ? (
                        <div className="empty-state" style={{ padding: 40 }}>Cari işlem veya fatura bulunamadı.</div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Evrak / Takip No</th>
                                        <th>Tarih</th>
                                        <th>Vade Tarihi</th>
                                        <th>Tutar</th>
                                        <th>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id}>
                                            <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                                            <td>{formatDate(inv.created_at)}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(inv.total_amount)}</td>
                                            <td>
                                                <span className={`badge ${inv.status === 'paid' ? 'badge-approved' : 'badge-pending'}`}>
                                                    {inv.status === 'paid' ? 'Ödendi / Kapandı' : 'Açık / Ödenmedi'}
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

        </div>
    );
}
