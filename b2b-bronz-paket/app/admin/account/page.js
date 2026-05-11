'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DocumentTextIcon, BanknotesIcon, BellAlertIcon, BellSlashIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

const START_YEAR = 2026;
const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - START_YEAR + 1 }, (_, i) => START_YEAR + i);

const months = [
    { id: 1, name: 'OCAK' }, { id: 2, name: 'ŞUBAT' }, { id: 3, name: 'MART' },
    { id: 4, name: 'NİSAN' }, { id: 5, name: 'MAYIS' }, { id: 6, name: 'HAZİRAN' },
    { id: 7, name: 'TEMMUZ' }, { id: 8, name: 'AĞUSTOS' }, { id: 9, name: 'EYLÜL' },
    { id: 10, name: 'EKİM' }, { id: 11, name: 'KASIM' }, { id: 12, name: 'ARALIK' }
];

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

export default function AdminAccountLedger() {
    const supabase = createClient();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    const [orderDetails, setOrderDetails] = useState({});
    const [loadingDetails, setLoadingDetails] = useState({});
    const [dbError, setDbError] = useState(false);
    const [selectedYear, setSelectedYear] = useState(currentYear < 2026 ? 2026 : currentYear);
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [totals, setTotals] = useState({ debt: 0, credit: 0 });
    
    const [showTxModal, setShowTxModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [txForm, setTxForm] = useState({ companyId: '', type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
    const [txSaving, setTxSaving] = useState(false);
    const [companies, setCompanies] = useState([]);

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
        
        setEditForm({
            ...tx,
            created_at: localISOTime, 
            order_items: items
        });
        setShowEditModal(true);
        if (companies.length === 0) {
            const { data } = await supabase.from('companies').select('id, name').order('name');
            if (data) setCompanies(data);
        }
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

            const res = await fetch('/api/admin/transactions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Güncelleme başarısız');
            setShowEditModal(false);
            fetchTransactions();
        } catch(err) {
            alert('Hata: ' + err.message);
        }
        setTxSaving(false);
    };

    const handleDeleteTx = async (tx) => {
        if (!confirm('Bu cari işlemi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm bakiyeler yeniden hesaplanır.')) return;
        try {
            const res = await fetch(`/api/admin/transactions?id=${tx.id}&companyId=${tx.company_id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Silme işlemi başarısız');
            fetchTransactions();
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };

    const updateEditItem = (idx, field, val) => {
        const newItems = [...editForm.order_items];
        newItems[idx][field] = val;
        const newDebtVat = newItems.reduce((acc, item) => acc + (parseInt(item.quantity || 0) * parseFloat(item.unit_price_vat || 0)), 0);
        setEditForm(prev => ({ 
            ...prev, 
            order_items: newItems,
            debt: prev.transaction_type === 'TOPTAN SATIŞ' ? newDebtVat : prev.debt 
        }));
    };
    
    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        let startDate, endDate;
        if (selectedMonth) {
            startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}T23:59:59`;
        } else {
            startDate = `${selectedYear}-01-01`;
            endDate = `${selectedYear}-12-31T23:59:59`;
        }

        const { data, error } = await supabase.from('account_transactions')
            .select('*, company:companies(name)')
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Transactions fetch error:', error);
            if (error.code === '42P01') setDbError(true);
        } else {
            setTransactions(data || []);
            const tDebt = (data || []).reduce((acc, r) => acc + Number(r.debt || 0), 0);
            const tCredit = (data || []).reduce((acc, r) => acc + Number(r.credit || 0), 0);
            setTotals({ debt: tDebt, credit: tCredit });
        }
        setLoading(false);
    }, [selectedYear, selectedMonth, supabase]);

    useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

    const openTxModal = async () => {
        setShowTxModal(true);
        if (companies.length === 0) {
            const { data } = await supabase.from('companies').select('id, name').order('name');
            if (data) setCompanies(data);
        }
    };

    const handleAddTx = async (e) => {
        e.preventDefault();
        setTxSaving(true);
        try {
            const res = await fetch('/api/admin/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: txForm.companyId,
                    type: txForm.type,
                    amount: txForm.amount,
                    description: txForm.description === 'Diğer' ? txForm.customDescription : txForm.description,
                    documentNo: txForm.documentNo
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'İşlem başarısız');
            setShowTxModal(false);
            setTxForm({ companyId: '', type: 'debt', amount: '', description: presetDescriptions[0], customDescription: '', documentNo: '' });
            fetchTransactions(); 
        } catch(err) {
            alert('Hata: ' + err.message);
        }
        setTxSaving(false);
    };

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

    // --- NOTIFICATION SYSTEM ---
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    useEffect(() => {
        const saved = localStorage.getItem('admin_payment_notifications');
        if (saved === 'true') setIsNotificationsEnabled(true);
        setLastCheck(new Date().toISOString());
    }, []);

    const playNotificationSound = useCallback(() => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const playTone = (freq, startTime, duration) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0, startTime);
                gain.gain.linearRampToValueAtTime(0.5, startTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(startTime); osc.stop(startTime + duration);
            };
            const now = audioCtx.currentTime;
            playTone(600, now, 0.15); playTone(800, now + 0.15, 0.3);
        } catch(e) {}
    }, []);

    const toggleNotifications = async () => {
        const newValue = !isNotificationsEnabled;
        if (newValue && typeof Notification !== "undefined") {
            let perm = Notification.permission;
            if (perm !== "granted" && perm !== "denied") perm = await Notification.requestPermission();
            if (perm === "granted") {
                playNotificationSound();
                new Notification('Ödeme Bildirimleri Aktif!');
            }
        }
        setIsNotificationsEnabled(newValue);
        localStorage.setItem('admin_payment_notifications', newValue ? 'true' : 'false');
    };

    useEffect(() => {
        if (!isNotificationsEnabled || !lastCheck) return;
        const interval = setInterval(async () => {
            const { data, error } = await supabase.from('account_transactions').select('id, credit, company:companies(name)').gt('created_at', lastCheck).gt('credit', 0).order('created_at', { ascending: false });
            if (!error && data && data.length > 0) {
                setLastCheck(new Date().toISOString());
                playNotificationSound();
                fetchTransactions();
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [isNotificationsEnabled, lastCheck, supabase, fetchTransactions, playNotificationSound]);

    if (dbError) {
        return (
            <div className="page-wrapper"><div className="card" style={{ padding: 40, textAlign: 'center' }}><h2>⚠️ Sistem Kurulumu Eksik</h2></div></div>
        );
    }

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Genel Cari Hareketler (Admin)</h1>
                    <p className="page-subtitle">Platformdaki tüm bayilerin borç, alacak ve toplam kâr dökümleri</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className={`btn ${isNotificationsEnabled ? 'btn-primary' : 'btn-ghost'}`} onClick={toggleNotifications}>Zil {isNotificationsEnabled ? 'Açık' : 'Kapalı'}</button>
                    <button className="btn btn-primary" onClick={openTxModal}><BanknotesIcon style={{ width: 18, height: 18 }} /> Bakiye İşlemi</button>
                    <button className="btn btn-ghost" onClick={() => window.print()}><DocumentTextIcon style={{ width: 18, height: 18, marginRight: 6 }} /> Yazdır</button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginRight: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Yıl:</span>
                    {years.map(y => (
                        <button
                            key={y}
                            onClick={() => { setSelectedYear(y); setSelectedMonth(null); setExpandedRow(null); }}
                            style={{
                                padding: '8px 20px',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                background: selectedYear === y && !selectedMonth ? 'var(--primary)' : 'transparent',
                                color: selectedYear === y && !selectedMonth ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: selectedYear === y && !selectedMonth ? '0 4px 10px rgba(37, 99, 235, 0.2)' : 'none'
                            }}
                        >
                            {y}
                        </button>
                    ))}
                </div>
                
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', marginRight: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ay:</span>
                    {months.map(m => (
                        <button
                            key={m.id}
                            onClick={() => { 
                                setSelectedMonth(selectedMonth === m.id ? null : m.id); 
                                setExpandedRow(null); 
                            }}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border)',
                                background: selectedMonth === m.id ? 'var(--primary)' : 'var(--bg-tag)',
                                color: selectedMonth === m.id ? '#fff' : 'var(--text-primary)',
                                fontWeight: selectedMonth === m.id ? 700 : 500,
                                cursor: 'pointer',
                                fontSize: 12,
                                transition: 'all 0.2s',
                                opacity: selectedMonth && selectedMonth !== m.id ? 0.6 : 1
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
                                <th>Firma Adı</th>
                                <th>Evrak No</th>
                                <th>İşlem Türü</th>
                                <th style={{ textAlign: 'right' }}>Borç</th>
                                <th style={{ textAlign: 'right' }}>Alacak</th>
                                <th style={{ textAlign: 'right' }}>Anlık Bakiye</th>
                                <th style={{ width: 50, textAlign: 'center' }}>Sil</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="10" style={{ textAlign: 'center', padding: 40 }}>Yükleniyor...</td></tr>
                            ) : transactions.map(tx => {
                                const isExpanded = expandedRow === tx.id;
                                const isOrder = tx.transaction_type === 'TOPTAN SATIŞ';
                                const vadeDate = tx.due_date ? fmt(tx.due_date) : fmt(addDays(tx.created_at, 7));
                                return (
                                    <Fragment key={tx.id}>
                                        <tr style={{ background: isExpanded ? 'rgba(37,99,235,0.03)' : 'transparent', transition: 'background 0.2s' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    <button onClick={() => handleExpand(tx)} className="btn btn-sm btn-ghost">{isExpanded ? 'Gizle' : 'Detay'}</button>
                                                    <button onClick={() => openEditModal(tx)} className="btn btn-sm" style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '4px 8px' }}><PencilSquareIcon style={{ width: 14, height: 14 }} /></button>
                                                </div>
                                            </td>
                                            <td>{fmtTime(tx.created_at)}</td>
                                            <td>{vadeDate}</td>
                                            <td style={{ fontWeight: 600 }}>{tx.company?.name}</td>
                                            <td>{tx.document_no?.toUpperCase()}</td>
                                            <td>{tx.transaction_type}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{tx.debt > 0 ? fmtMoney(tx.debt) : '-'}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--success)' }}>{tx.credit > 0 ? fmtMoney(tx.credit) : '-'}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: (tx.balance_after || 0) < 0 ? '#ef4444' : '#22c55e' }}>{fmtMoney(tx.balance_after, true)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button onClick={() => handleDeleteTx(tx)} className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', borderColor: 'transparent' }}><TrashIcon style={{ width: 16, height: 16 }} /></button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="10" style={{ padding: '8px 24px 20px 80px', background: 'transparent' }}>
                                                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 20, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
                                                        <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12, fontWeight: 800, letterSpacing: '1px' }}>
                                                            {isOrder ? `İşlem İçeriği — ${tx.document_no?.slice(0, 8).toUpperCase()}` : 'İşlem Detayı'}
                                                        </h4>
                                                        {isOrder ? (
                                                            loadingDetails[tx.id] ? (
                                                                <div style={{ fontSize: 13, color: '#cbd5e1' }}>Yükleniyor...</div>
                                                            ) : (orderDetails[tx.id] || []).length === 0 ? (
                                                                <div style={{ fontSize: 13, color: '#cbd5e1' }}>İçerik bulunamadı.</div>
                                                            ) : (
                                                                <table style={{ margin: 0, fontSize: 13, background: 'transparent' }}>
                                                                    <thead style={{ background: 'transparent' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700 }}>Ürün Kodu</th>
                                                                            <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700 }}>Ürün Adı</th>
                                                                            <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700, textAlign: 'right' }}>Miktar</th>
                                                                            <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700, textAlign: 'right' }}>Birim Fiyat</th>
                                                                            <th style={{ padding: '8px 4px', color: '#94a3b8', fontWeight: 700, textAlign: 'right' }}>Tutar</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {orderDetails[tx.id].map(item => (
                                                                            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                <td style={{ padding: '10px 4px', fontFamily: 'monospace', color: '#cbd5e1' }}>{item.product?.code || '-'}</td>
                                                                                <td style={{ padding: '10px 4px', fontWeight: 600, color: '#f8fafc' }}>{item.product?.name}</td>
                                                                                <td style={{ padding: '10px 4px', textAlign: 'right', color: '#cbd5e1', fontWeight: 700 }}>{item.quantity}</td>
                                                                                <td style={{ padding: '10px 4px', textAlign: 'right', color: '#cbd5e1' }}>{fmtMoney(item.unit_price * 1.20)}</td>
                                                                                <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>{fmtMoney(item.total_price * 1.20)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )
                                                        ) : (
                                                            <div style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 500, lineHeight: 1.6 }}>
                                                                <strong style={{ color: '#94a3b8', marginRight: 8 }}>Açıklama:</strong> {tx.description || '-'}
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
                        <tfoot>
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 700 }}>DÖNEM TOPLAMI</td>
                                <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>{fmtMoney(totals.debt)}</td>
                                <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 700 }}>{fmtMoney(totals.credit)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 800, color: (totals.credit - totals.debt) < 0 ? 'var(--danger)' : 'var(--text-primary)', fontSize: 16, whiteSpace: 'nowrap' }}>{fmtMoney(totals.credit - totals.debt, true)}</td>                            </tr>
                        </tfoot>                    </table>
                </div>
            </div>

            {/* MODALS */}
            {showTxModal && (
                <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
                    <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Bakiye İşlemi Ekle</h3><button onClick={() => setShowTxModal(false)}>✕</button></div>
                        <form onSubmit={handleAddTx}>
                            <select className="form-select" value={txForm.companyId} onChange={e => setTxForm({...txForm, companyId: e.target.value})} required>
                                <option value="">Firma Seçin</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select className="form-select" value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} required><option value="debt">Borçlandır</option><option value="credit">Alacaklandır</option></select>
                            <input className="form-input" type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} placeholder="Tutar" required />
                            <select className="form-select" value={txForm.description} onChange={e => setTxForm({...txForm, description: e.target.value})} required>{presetDescriptions.map(d => <option key={d} value={d}>{d}</option>)}</select>
                            {txForm.description === 'Diğer' && <input className="form-input" type="text" value={txForm.customDescription} onChange={e => setTxForm({...txForm, customDescription: e.target.value})} placeholder="Açıklama" required />}
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
                                                <td style={{ textAlign: 'right' }}>{fmtMoney(item.quantity * item.unit_price_vat)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table></div>
                                    <div style={{ textAlign: 'right', marginTop: 16, fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>YENİ TOPLAM BORÇ: {fmtMoney(editForm.debt)}</div>
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
