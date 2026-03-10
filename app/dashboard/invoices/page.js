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
            .select('company_id, company:companies(current_balance, credit_limit)')
            .eq('id', user.id).single();

        setBalance(profile?.company?.current_balance || 0);
        setCreditLimit(profile?.company?.credit_limit || 0);
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

    const statusBadge = { unpaid: 'badge-unpaid', paid: 'badge-paid', partial: 'badge-partial' };
    const statusLabel = { unpaid: 'Ödenmedi', paid: 'Ödendi', partial: 'Kısmi Ödeme' };

    return (
        <div className="page-wrapper">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cari Hesap</h1>
                    <p className="page-subtitle">Cari hesap hareketleriniz ve fatura/ekstre dökümleriniz</p>
                </div>
            </div>

            {/* Cari Özet */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Güncel Bakiye</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: balance < 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'Outfit, sans-serif' }}>
                        ₺{Math.abs(balance).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {balance < 0 ? '(Borç)' : '(Alacak)'}
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }} onClick={() => alert('Sanal POS entegrasyonu (Faz 4)')}>💳 Bakiye Yükle / Ödeme Yap</button>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Kredi Limiti (Risk)</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        ₺{Number(creditLimit).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 'auto' }}>Tanımlı risk limitiniz</div>
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
                        <thead><tr><th>Tarih</th><th>Açıklama</th><th style={{ textAlign: 'right' }}>İşlem</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => {
                                let noteData = { desc: '', url: '' };
                                try { noteData = JSON.parse(inv.note || '{}'); } catch (e) { noteData = { desc: inv.note, url: '' }; }
                                return (
                                    <tr key={inv.id}>
                                        <td style={{ fontWeight: 600 }}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}</td>
                                        <td>{noteData.desc || '-'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {noteData.url ? (
                                                <a href={noteData.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ color: '#2563eb', fontWeight: 600 }}>📄 PDF İndir</a>
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
