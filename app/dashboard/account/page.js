'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const showCode = (code) => { if (!code) return null; const s = code.replace(/[a-zA-Z]/g, ''); return s || null; };

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

function fmtMoney(n, showSign = false) {
    const val = Number(n || 0);
    const absVal = Math.abs(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (!showSign) return '₺' + absVal;
    if (val > 0) return '+₺' + absVal;
    if (val < 0) return '-₺' + absVal;
    return '₺' + absVal;
}

export default function DealerAccountLedger() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const [selectedYear, setSelectedYear] = useState(currentYear < 2026 ? 2026 : currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [totals, setTotals] = useState({ debt: 0, credit: 0, balance: 0 });

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
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
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const handleExpand = async (tx) => {
        if (expandedRow === tx.id) { setExpandedRow(null); return; }
        setExpandedRow(tx.id);
        if ((tx.transaction_type === 'TOPTAN SATIŞ') && !orderDetails[tx.id]) {
            setLoadingDetails(prev => ({ ...prev, [tx.id]: true }));
            const searchId = tx.order_id || tx.document_no;
            try {
                const res = await fetch(`/api/user/orders/${searchId}/items`);
                if (res.ok) {
                    const data = await res.json();
                    setOrderDetails(prev => ({ ...prev, [tx.id]: data || [] }));
                }
            } catch (e) { console.error(e); } finally { setLoadingDetails(prev => ({ ...prev, [tx.id]: false })); }
        }
    };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hareketler</h1>
                    <p className="page-subtitle">Borç, alacak ve bakiye dökümleri</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-ghost" onClick={() => window.print()}>
                        <DocumentTextIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Ekstre
                    </button>
                    <a href="/dashboard/payment" className="btn btn-primary">💳 Ödeme</a>
                </div>
            </div>

            {/* MOBILE ONLY TOTALS */}
            <div className="mobile-totals-grid">
                <div className="m-stat-card border-danger">
                    <span className="m-label">TOPLAM BORÇ</span>
                    <span className="m-value color-danger">{fmtMoney(totals.debt)}</span>
                </div>
                <div className="m-stat-card border-success">
                    <span className="m-label">TOPLAM ALACAK</span>
                    <span className="m-value color-success">{fmtMoney(totals.credit)}</span>
                </div>
                <div className="m-stat-card border-primary">
                    <span className="m-label">GÜNCEL BAKİYE</span>
                    <span className={`m-value ${(totals.credit - totals.debt) < 0 ? 'color-danger' : 'color-success'}`}>
                        {fmtMoney(totals.credit - totals.debt, true)}
                    </span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>YIL:</span>
                    {years.map(y => (
                        <button key={y} onClick={() => { setSelectedYear(y); setSelectedMonth(null); setExpandedRow(null); }} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: selectedYear === y && !selectedMonth ? 'var(--primary)' : 'var(--bg-surface)', color: selectedYear === y && !selectedMonth ? '#fff' : 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{y}</button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>AY:</span>
                    {months.map(m => (
                        <button key={m.id} onClick={() => { setSelectedMonth(selectedMonth === m.id ? null : m.id); setExpandedRow(null); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: selectedMonth === m.id ? 'var(--primary)' : 'var(--bg-tag)', color: selectedMonth === m.id ? '#fff' : 'var(--text-primary)', fontWeight: selectedMonth === m.id ? 700 : 500, cursor: 'pointer', fontSize: 12 }}>{m.name}</button>
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
                                <tr><td colSpan="8" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}><div style={{ fontSize: 32, marginBottom: 16 }}>📊</div><div style={{ fontSize: 16, fontWeight: 500 }}>Cari hareket bulunmuyor</div></td></tr>
                            ) : transactions.map(tx => {
                                const isExpanded = expandedRow === tx.id;
                                const vadeDate = tx.due_date ? fmt(tx.due_date) : fmt(addDays(tx.created_at, 7));
                                return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent' }}>
                                            <td data-label="Detay" style={{ textAlign: 'center' }}><button onClick={() => handleExpand(tx)} className="btn btn-sm" style={{ background: isExpanded ? 'var(--primary)' : 'var(--bg-tag)', color: isExpanded ? '#fff' : 'var(--text-primary)', border: 'none' }}>{isExpanded ? 'Gizle' : 'Detay'}</button></td>
                                            <td data-label="Tarih" style={{ fontWeight: 500 }}>{fmtTime(tx.created_at)}</td>
                                            <td data-label="Vade Tarih" style={{ color: 'var(--text-secondary)' }}>{vadeDate}</td>
                                            <td data-label="Evrak No" style={{ fontFamily: 'monospace', fontSize: 13 }}>{tx.document_no ? tx.document_no.toUpperCase() : '-'}</td>
                                            <td data-label="İşlem Türü"><span style={{ fontWeight: 600, color: tx.transaction_type === 'KREDİ KARTI' || tx.transaction_type === 'HAVALE/EFT' ? 'var(--success)' : tx.transaction_type === 'TOPTAN SATIŞ' ? 'var(--primary)' : 'var(--text-secondary)' }}>{tx.transaction_type}</span></td>
                                            <td data-label="Borç" style={{ textAlign: 'right', fontWeight: tx.debt > 0 ? 600 : 400, color: tx.debt > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{tx.debt > 0 ? fmtMoney(tx.debt) : '0,00'}</td>
                                            <td data-label="Alacak" style={{ textAlign: 'right', fontWeight: tx.credit > 0 ? 600 : 400, color: tx.credit > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{tx.credit > 0 ? fmtMoney(tx.credit) : '0,00'}</td>
                                            <td data-label="Bakiye" style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{fmtMoney(tx.balance_after)}</td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '0 24px 20px 80px' }}>
                                                    <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginTop: 4 }}>
                                                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>{tx.transaction_type === 'TOPTAN SATIŞ' ? `Sipariş İçeriği` : 'İşlem Detayı'}</h4>
                                                        {tx.transaction_type === 'TOPTAN SATIŞ' ? (
                                                            loadingDetails[tx.id] ? <div>Yükleniyor...</div> : (
                                                                <div className="table-wrapper"><table style={{ background: 'transparent' }}>
                                                                    <thead><tr><th>Kod</th><th>Ürün</th><th style={{ textAlign: 'right' }}>Adet</th><th style={{ textAlign: 'right' }}>Fiyat</th><th style={{ textAlign: 'right' }}>Tutar</th></tr></thead>
                                                                    <tbody>{(orderDetails[tx.id] || []).map(item => (<tr key={item.id}><td data-label="Kod">{showCode(item.product?.code) || '-'}</td><td data-label="Ürün">{item.product?.name}</td><td data-label="Adet" style={{ textAlign: 'right' }}>{item.quantity}</td><td data-label="Fiyat" style={{ textAlign: 'right' }}>{fmtMoney(item.unit_price)}</td><td data-label="Tutar" style={{ textAlign: 'right' }}>{fmtMoney(item.total_price)}</td></tr>))}</tbody>
                                                                </table></div>
                                                            )
                                                        ) : (<div><strong>Açıklama:</strong> {tx.description || '-'}</div>)}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                        {!loading && transactions.length > 0 && (
                            <tfoot className="desktop-only-tfoot" style={{ background: 'var(--bg-surface)', borderTop: '2px solid var(--border)' }}>
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: 700, padding: '16px 20px' }}>DÖNEM TOPLAMI</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)', padding: '16px 20px', fontSize: 16 }}>{fmtMoney(totals.debt)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', padding: '16px 20px', fontSize: 16 }}>{fmtMoney(totals.credit)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: (totals.credit - totals.debt) < 0 ? 'var(--danger)' : 'var(--text-primary)', padding: '16px 20px', fontSize: 18 }}>{fmtMoney(totals.credit - totals.debt, true)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            <style jsx>{`
                .mobile-totals-grid { display: none; }
                @media (max-width: 768px) {
                    .mobile-totals-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 20px; }
                    .m-stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
                    .m-label { font-size: 11px; font-weight: 700; color: var(--text-muted); }
                    .m-value { font-size: 20px; font-weight: 800; }
                    .border-danger { border-left: 4px solid var(--danger); }
                    .border-success { border-left: 4px solid var(--success); }
                    .border-primary { border-left: 4px solid var(--primary); }
                    .color-danger { color: var(--danger); }
                    .color-success { color: var(--success); }
                    .desktop-only-tfoot { display: none !important; }
                }
            `}</style>
        </div>
    );
}

