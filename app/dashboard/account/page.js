'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const START_YEAR = 2026;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const months = [
    { id: 1, name: 'OCAK' }, { id: 2, name: 'ŞUBAT' }, { id: 3, name: 'MART' },
    { id: 4, name: 'NİSAN' }, { id: 5, name: 'MAYIS' }, { id: 6, name: 'HAZİRAN' },
    { id: 7, name: 'TEMMUZ' }, { id: 8, name: 'AĞUSTOS' }, { id: 9, name: 'EYLÜL' },
    { id: 10, name: 'EKİM' }, { id: 11, name: 'KASIM' }, { id: 12, name: 'ARALIK' }
];

function addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d;
}

function fmt(date) {
    return new Date(date).toLocaleDateString('tr-TR');
}

function fmtTime(date) {
    return new Date(date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n) {
    return '₺' + Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
}

export default function DealerAccountLedger() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const [dbError, setDbError] = useState(false);
    const [selectedYear, setSelectedYear] = useState(currentYear < 2026 ? 2026 : currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [totals, setTotals] = useState({ debt: 0, credit: 0, balance: 0 });
    const supabase = createClient();

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        
        try {
            // Fetch balance and other info from our smart user info API
            const infoRes = await fetch('/api/user/info');
            if (infoRes.ok) {
                const infoData = await infoRes.json();
                setTotals(prev => ({ ...prev, balance: infoData.currentBalance || 0 }));
            }

            let startDate, endDate;
            if (selectedMonth) {
                startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
                const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
                endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}T23:59:59`;
            } else {
                startDate = `${selectedYear}-01-01`;
                endDate = `${selectedYear}-12-31T23:59:59`;
            }

            const res = await fetch(`/api/user/account/transactions?startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data || []);
                const tDebt = (data || []).reduce((acc, r) => acc + Number(r.debt || 0), 0);
                const tCredit = (data || []).reduce((acc, r) => acc + Number(r.credit || 0), 0);
                setTotals(prev => ({ ...prev, debt: tDebt, credit: tCredit }));
            }
        } catch (err) {
            console.error('Fetch transactions error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
const handleExpand = async (tx) => {
    if (expandedRow === tx.id) { setExpandedRow(null); return; }
    setExpandedRow(tx.id);

    // If it's an order and we haven't fetched details yet
    if ((tx.transaction_type === 'TOPTAN SATIŞ') && !orderDetails[tx.id]) {
        setLoadingDetails(prev => ({ ...prev, [tx.id]: true }));

        // Prefer order_id if available, fallback to document_no
        const searchId = tx.order_id || tx.document_no;

        const { data } = await supabase.from('order_items')
            .select('*, product:products(name, code, oem_no)')
            .eq('order_id', searchId);
        setOrderDetails(prev => ({ ...prev, [tx.id]: data || [] }));
        setLoadingDetails(prev => ({ ...prev, [tx.id]: false }));
    }
};

    if (dbError) {
        return (
            <div className="page-wrapper">
                <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 40 }}>
                    <h2 style={{ color: 'var(--danger)', marginBottom: 16 }}>⚠️ Sistem Kurulumu Eksik</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Cari Hesap tabloları bulunamadı. Lütfen yöneticinizle iletişime geçin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hareketler</h1>
                    <p className="page-subtitle">Borç, alacak ve bakiye dökümleri</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={() => window.print()} title="Yazdır/PDF Olarak Kaydet">
                        <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Ekstre İndir
                    </button>
                    <a href="/dashboard/payment" className="btn btn-primary">💳 Ödeme Yap</a>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>YIL:</span>
                    {years.map(y => (
                        <button
                            key={y}
                            onClick={() => { setSelectedYear(y); setSelectedMonth(null); setExpandedRow(null); }}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: selectedYear === y && !selectedMonth ? 'var(--primary)' : 'var(--bg-surface)',
                                color: selectedYear === y && !selectedMonth ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'all 0.15s'
                            }}
                        >
                            {y}
                        </button>
                    ))}
                </div>
                
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>AY:</span>
                    {months.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { 
                                setSelectedMonth(selectedMonth === m.id ? null : m.id); 
                                setExpandedRow(null); 
                            }}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: selectedMonth === m.id ? 'var(--primary)' : 'var(--bg-tag)',
                                color: selectedMonth === m.id ? '#fff' : 'var(--text-primary)',
                                fontWeight: selectedMonth === m.id ? 700 : 500,
                                cursor: 'pointer',
                                fontSize: 12,
                                transition: 'all 0.15s'
                            }}
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrapper" style={{ border: 'none', margin: 0 }}>
                    <table style={{ margin: 0 }}>
                        <thead style={{ background: 'var(--bg-surface)' }}>
                            <tr>
                                <th style={{ width: 80, textAlign: 'center' }}>Detay</th>
                                <th>Tarih</th>
                                <th>Vade Tarih</th>
                                <th>Evrak No</th>
                                <th>İşlem Türü</th>
                                <th style={{ textAlign: 'right' }}>Borç</th>
                                <th style={{ textAlign: 'right' }}>Alacak</th>
                                <th style={{ textAlign: 'right' }}>Bakiye</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="8"><div className="loading-center" style={{ padding: 40 }}><div className="loading-spinner" /></div></td></tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
                                        <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedYear} yılında cari hareket bulunmuyor</div>
                                    </td>
                                </tr>
                            ) : transactions.map(tx => {
                                const isExpanded = expandedRow === tx.id;
                                const isOrder = tx.transaction_type === 'TOPTAN SATIŞ';
                                const vadeDate = tx.due_date ? fmt(tx.due_date) : fmt(addDays(tx.created_at, 7));
                                return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent', transition: 'background 0.2s', borderBottom: isExpanded ? 'none' : undefined }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleExpand(tx)}
                                                    className="btn btn-sm"
                                                    style={{ background: isExpanded ? 'var(--primary)' : 'var(--bg-tag)', color: isExpanded ? '#fff' : 'var(--text-primary)', border: 'none', padding: '4px 12px' }}
                                                >
                                                    {isExpanded ? 'Gizle' : 'Detay'}
                                                </button>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{fmtTime(tx.created_at)}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{vadeDate}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{tx.document_no ? tx.document_no.slice(0, 8).toUpperCase() : '-'}</td>
                                            <td>
                                                <span style={{
                                                    fontWeight: 600,
                                                    color: tx.transaction_type === 'KREDİ KARTI' || tx.transaction_type === 'HAVALE/EFT' ? 'var(--success)' :
                                                        tx.transaction_type === 'TOPTAN SATIŞ' ? 'var(--primary)' : 'var(--text-secondary)'
                                                }}>
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: tx.debt > 0 ? 600 : 400, color: tx.debt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                {tx.debt > 0 ? fmtMoney(tx.debt) : '0,00'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: tx.credit > 0 ? 600 : 400, color: tx.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                                {tx.credit > 0 ? fmtMoney(tx.credit) : '0,00'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                                {fmtMoney(tx.balance_after)}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr style={{ background: 'rgba(37,99,235,0.015)' }}>
                                                <td colSpan="8" style={{ padding: '0 24px 20px 80px', borderTop: 'none' }}>
                                                    <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 4 }}>
                                                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700, letterSpacing: '0.5px' }}>
                                                            {isOrder ? `Sipariş İçeriği — ${tx.document_no?.slice(0, 8).toUpperCase()}` : 'İşlem Detayı'}
                                                        </h4>
                                                        {isOrder ? (
                                                            loadingDetails[tx.id] ? (
                                                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yükleniyor...</div>
                                                            ) : (orderDetails[tx.id] || []).length === 0 ? (
                                                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>İçerik bulunamadı.</div>
                                                            ) : (
                                                                <table style={{ margin: 0, fontSize: 13, background: 'transparent' }}>
                                                                    <thead style={{ background: 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Ürün Kodu</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Ürün Adı</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>OEM No</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Miktar</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Birim Fiyat</th>
                                                                            <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tutar</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {orderDetails[tx.id].map(item => (
                                                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                                                <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>{item.product?.code || '-'}</td>
                                                                                <td style={{ padding: '8px 4px', fontWeight: 500 }}>{item.product?.name}</td>
                                                                                <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 12 }}>{item.product?.oem_no || '-'}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.quantity}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>{fmtMoney(item.unit_price)}</td>
                                                                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(item.total_price)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        ) : (
                                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                                <strong>Açıklama:</strong> {tx.description || '-'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        {!loading && transactions.length > 0 && (
                            <tfoot style={{ background: 'var(--bg-surface)', borderTop: '2px solid var(--border)' }}>
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: 700, padding: '16px 20px' }}>DÖNEM TOPLAMI</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', padding: '16px 20px', fontSize: 16 }}>
                                        {fmtMoney(totals.debt)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', padding: '16px 20px', fontSize: 16 }}>
                                        {fmtMoney(totals.credit)}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: totals.balance < 0 ? 'var(--danger)' : 'var(--text-primary)', padding: '16px 20px', fontSize: 18 }}>
                                        {fmtMoney(totals.balance)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
