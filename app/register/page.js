'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/auth.module.css';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        companyName: '', taxNumber: '', contactPerson: '',
        phone: '', address: '', email: '', password: '', confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const update = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

    const handleRegister = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Şifreler eşleşmiyor.');
            return;
        }
        if (formData.password.length < 6) {
            setError('Şifre en az 6 karakter olmalı.');
            return;
        }
        setLoading(true);
        setError('');

        const supabase = createClient();

        // 1. Create auth user
        const { data: authData, error: signUpErr } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: { data: { full_name: formData.contactPerson } }
        });

        if (signUpErr) {
            setError(signUpErr.message);
            setLoading(false);
            return;
        }

        // 2. Create company record
        const { data: company, error: companyErr } = await supabase
            .from('companies')
            .insert({
                name: formData.companyName,
                tax_number: formData.taxNumber,
                contact_person: formData.contactPerson,
                phone: formData.phone,
                address: formData.address,
                email: formData.email,
                status: 'pending'
            })
            .select()
            .single();

        if (companyErr) {
            setError('Firma kaydı oluşturulamadı: ' + companyErr.message);
            setLoading(false);
            return;
        }

        // 3. Link profile → company
        await supabase
            .from('profiles')
            .update({ company_id: company.id, full_name: formData.contactPerson })
            .eq('id', authData.user.id);

        await supabase.auth.signOut();
        setSuccess(true);
        setLoading(false);
    };

    if (success) {
        return (
            <div className={styles.authBg}>
                <div className={styles.authCard} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
                    <h2 className={styles.authTitle}>Başvurunuz Alındı!</h2>
                    <p className={styles.authDesc} style={{ marginBottom: 24 }}>
                        Firma kaydınız yönetici onayına gönderildi. Onaylandığında e-posta ile bilgilendirileceksiniz.
                    </p>
                    <a href="/login" className="btn btn-primary btn-lg" style={{ display: 'inline-flex', justifyContent: 'center' }}>
                        Giriş Sayfasına Dön
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authBg}>
            <div className={styles.authCard} style={{ maxWidth: 560 }}>
                <div className={styles.authLogo}>
                    <span className={styles.logoIcon}>⚙️</span>
                    <h1 className={styles.logoText}>B2B Parça</h1>
                </div>
                <h2 className={styles.authTitle}>Firma Kaydı</h2>
                <p className={styles.authDesc}>Bilgilerinizi doldurun, yöneticimiz başvurunuzu onaylayacak</p>

                <form onSubmit={handleRegister} className={styles.authForm}>
                    {error && <div className={styles.errorBox}>{error}</div>}

                    <div className={styles.formGrid}>
                        <div className={`form-group ${styles.fullWidth}`}>
                            <label className="form-label">Firma Adı *</label>
                            <input className="form-input" type="text" placeholder="ABC Otomotiv Ltd. Şti." value={formData.companyName} onChange={update('companyName')} required id="reg-company-name" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Vergi Numarası *</label>
                            <input className="form-input" type="text" placeholder="1234567890" value={formData.taxNumber} onChange={update('taxNumber')} required id="reg-tax-number" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Yetkili Kişi *</label>
                            <input className="form-input" type="text" placeholder="Ad Soyad" value={formData.contactPerson} onChange={update('contactPerson')} required id="reg-contact" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Telefon</label>
                            <input className="form-input" type="tel" placeholder="0532 000 00 00" value={formData.phone} onChange={update('phone')} id="reg-phone" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">E-posta *</label>
                            <input className="form-input" type="email" placeholder="firma@email.com" value={formData.email} onChange={update('email')} required id="reg-email" />
                        </div>

                        <div className={`form-group ${styles.fullWidth}`}>
                            <label className="form-label">Adres</label>
                            <input className="form-input" type="text" placeholder="Firma adresi" value={formData.address} onChange={update('address')} id="reg-address" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Şifre *</label>
                            <input className="form-input" type="password" placeholder="En az 6 karakter" value={formData.password} onChange={update('password')} required id="reg-password" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Şifre Tekrar *</label>
                            <input className="form-input" type="password" placeholder="Şifreyi tekrarlayın" value={formData.confirmPassword} onChange={update('confirmPassword')} required id="reg-password-confirm" />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading} id="reg-submit" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                        {loading ? 'Kaydediliyor...' : 'Başvuruyu Gönder'}
                    </button>
                </form>

                <p className={styles.authLink}>
                    Zaten hesabınız var mı?{' '}
                    <a href="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Giriş Yap</a>
                </p>
            </div>
        </div>
    );
}
