'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DealerInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [totalUnpaid, setTotalUnpaid] = useState(0);
    const [balance, setBalance] = useState(0);
    const [creditLimit, setCreditLimit] = useState(0);
    const supabase = createClient();

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles')
            .select('company_id')
            .eq('id', user.id).single();
        const { data } = await supabase.from('invoices')
            .select('*, items:invoice_items(*, product:products(name))')
            .eq('company_id', profile.company_id)
            .order('created_at', { ascending: false });
        setInvoices(data || []);
        const unpaid = (data || []).filter(i => i.status !== 'paid').reduce((acc, i) => acc + Number(i.total_amount), 0);
        setTotalUnpaid(unpaid);
        setLoading(false);
    }, []);

    useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

    const fmtMoney = (n) => n > 0 ? '₺' + Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-';

    const statusBadge = { unpaid: 'badge-unpaid', paid: 'badge-paid', partial: 'badge-partial' };
    const statusLabel = { unpaid: 'Ödenmedi', paid: 'Ödendi', partial: 'Kısmi Ödeme' };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Faturalarım</h1>
                    <p className="page-subtitle">Sisteme yüklenen tüm fatura veya dekontlarınız</p>
                </div>
            </div>

            <div className="table-wrapper">
                {loading ? (
                    <div className="loading-center"><div className="loading-spinner" /></div>
                ) : invoices.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🧾</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>Cari kayıt bulunamadı</div>
                    </div>
                ) : (
                    <table>
                        <thead><tr><th>Tarih</th><th>Açıklama</th><th>OEM No</th><th style={{ textAlign: 'right' }}>Tutar</th><th style={{ textAlign: 'right' }}>İşlem</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => {
                                let noteData = { desc: '', url: '' };
                                try { noteData = JSON.parse(inv.note || '{}'); } catch (e) { noteData = { desc: inv.note, url: '' }; }
                                return (
                                    <tr key={inv.id}>
                                        <td style={{ fontWeight: 600 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                        <td>{noteData.desc || '-'}</td>
                                        <td>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inv.oem_nos || '-'}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 600, color: inv.total_amount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmtMoney(inv.total_amount)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {noteData.url ? (
                                                <a href={`/api/file?url=${encodeURIComponent(noteData.url)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#2563eb', fontWeight: 600 }}>📄 PDF İndir</a>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Dosya Yok</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
