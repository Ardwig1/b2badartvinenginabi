'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function PaymentResultPage() {
    const searchParams = useSearchParams();
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    const orderId = searchParams.get('orderId');

    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    const isSuccess = status === 'success';

    return (
        <div className="page-wrapper">
            <div className="card" style={{ maxWidth: 500, margin: '40px auto', padding: 40, textAlign: 'center' }}>
                {isSuccess ? (
                    <>
                        <CheckCircleIcon style={{ width: 80, height: 80, color: '#10b981', margin: '0 auto 20px' }} />
                        <h2 style={{ fontSize: 24, marginBottom: 10, color: 'var(--text-primary)' }}>Ödeme Başarılı!</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                            İşleminiz başarıyla gerçekleştirildi. Bizi tercih ettiğiniz için teşekkür ederiz.
                        </p>
                        {orderId && (
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, marginBottom: 20 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Sipariş/İşlem No: </span>
                                <strong>{orderId}</strong>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <XCircleIcon style={{ width: 80, height: 80, color: '#ef4444', margin: '0 auto 20px' }} />
                        <h2 style={{ fontSize: 24, marginBottom: 10, color: 'var(--text-primary)' }}>Ödeme Başarısız</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                            İşleminiz sırasında bir hata oluştu: 
                            <br/>
                            <strong style={{ color: '#ef4444', marginTop: 10, display: 'block' }}>
                                {message ? decodeURIComponent(message).replace(/_/g, ' ') : 'Bilinmeyen Hata'}
                            </strong>
                        </p>
                    </>
                )}

                <div style={{ marginTop: 30, display: 'flex', gap: 15, justifyContent: 'center' }}>
                    <Link href="/dashboard/payment" className="btn btn-outline">
                        Tekrar Dene
                    </Link>
                    <Link href="/dashboard" className="btn btn-primary">
                        Panele Dön
                    </Link>
                </div>
            </div>
        </div>
    );
}
