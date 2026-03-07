'use client';
import { useState, useEffect } from 'react';
import { CogIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

export default function GlobalMarginSettings({ onMarginUpdate }) {
    const [margin, setMargin] = useState('');
    const [usdRate, setUsdRate] = useState('');
    const [isUsdActive, setIsUsdActive] = useState(false);

    const [savingMargin, setSavingMargin] = useState(false);
    const [successMargin, setSuccessMargin] = useState(false);

    const [savingUsd, setSavingUsd] = useState(false);
    const [successUsd, setSuccessUsd] = useState(false);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [marginRes, usdRes] = await Promise.all([
                    fetch('/api/admin/margin'),
                    fetch('/api/admin/usd-settings')
                ]);
                const marginData = await marginRes.json();
                const usdData = await usdRes.json();

                if (marginData?.margin !== undefined) setMargin(marginData.margin);
                if (usdData?.usd_rate !== undefined) setUsdRate(usdData.usd_rate);
                if (usdData?.is_active !== undefined) setIsUsdActive(usdData.is_active);
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSaveMargin = async () => {
        setSavingMargin(true);
        await fetch('/api/admin/margin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ margin: margin === '' ? 0 : margin })
        });
        setSavingMargin(false);
        setSuccessMargin(true);
        if (onMarginUpdate) onMarginUpdate(Number(margin === '' ? 0 : margin));
        setTimeout(() => setSuccessMargin(false), 2500);
    };

    const handleSaveUsd = async () => {
        setSavingUsd(true);
        await fetch('/api/admin/usd-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usd_rate: usdRate === '' ? 0 : usdRate, is_active: isUsdActive })
        });
        setSavingUsd(false);
        setSuccessUsd(true);
        setTimeout(() => setSuccessUsd(false), 2500);
    };

    const toggleUsdActive = () => {
        setIsUsdActive(prev => !prev);
    };

    if (loading) return null;

    return (
        <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Kâr Oranı */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, margin: 0, padding: 16 }}>
                <div style={{ background: 'var(--primary)', color: 'white', padding: 10, borderRadius: 10 }}>
                    <CogIcon style={{ width: 24, height: 24 }} />
                </div>
                <div>
                    <h2 className="card-title" style={{ fontSize: 16, marginBottom: 2 }}>Genel Kâr Oranı</h2>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tüm ürünlere uygulanır</div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 12, fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                    <input
                        type="number"
                        className="form-input"
                        value={margin}
                        onChange={e => setMargin(e.target.value)}
                        style={{ width: 90, fontSize: 16, fontWeight: 700, paddingLeft: 30, paddingRight: 10, textAlign: 'center' }}
                    />
                </div>
                <button className={`btn ${successMargin ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={handleSaveMargin} disabled={savingMargin}>
                    {savingMargin ? '...' : successMargin ? '✓ Kaydedildi' : 'Kaydet'}
                </button>
            </div>

            {/* Dolar Kuru Sabitleme */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, margin: 0, padding: 16 }}>
                <div style={{ background: 'var(--warning)', color: 'white', padding: 10, borderRadius: 10 }}>
                    <CurrencyDollarIcon style={{ width: 24, height: 24 }} />
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h2 className="card-title" style={{ fontSize: 16, margin: 0 }}>Dolar Kuru Sabitleme:</h2>
                        <span onClick={toggleUsdActive} style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15, color: isUsdActive ? 'var(--success)' : 'var(--danger)', userSelect: 'none' }}>
                            {isUsdActive ? 'Açık' : 'Kapalı'}
                        </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Mevcut Kur: </span>
                        Dolar = {usdRate || 0} TL
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', right: 12, fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>TL</span>
                    <input
                        type="number"
                        className="form-input"
                        value={usdRate}
                        onChange={e => setUsdRate(e.target.value)}
                        style={{ width: 100, fontSize: 16, fontWeight: 700, paddingRight: 36, paddingLeft: 10, textAlign: 'center' }}
                    />
                </div>
                <button className={`btn ${successUsd ? 'btn-success' : 'btn-primary'} btn-sm`} onClick={handleSaveUsd} disabled={savingUsd}>
                    {savingUsd ? '...' : successUsd ? '✓ Kaydedildi' : 'Kaydet'}
                </button>
            </div>
        </div>
    );
}
