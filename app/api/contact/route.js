import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Yetkisiz işlem. Lütfen giriş yapın.' }, { status: 401 });
        }

        const { subject, message } = await request.json();

        if (!subject || !message) {
            return NextResponse.json({ error: 'Konu ve mesaj alanları zorunludur.' }, { status: 400 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, company:companies(name)')
            .eq('id', user.id)
            .single();

        const companyName = profile?.company?.name || 'Bilinmeyen Firma';
        const senderName = profile?.full_name || user.email;

        // Check if SMTP config exists
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('SMTP credentials missing in .env.local');
            return NextResponse.json({ error: 'Sistem e-posta ayarları eksik. Lütfen site yöneticisine başvurun.' }, { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE !== 'false', // default true for 465
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: 'muratkaan@omigroups.com',
            replyTo: profile?.email || user.email,
            subject: `[B2B Öneri/Şikayet] ${companyName} - ${subject}`,
            text: `Firma: ${companyName}\nGönderen: ${senderName} (${profile?.email || user.email})\n\nKonu: ${subject}\n\nMesaj:\n${message}`,
            html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Yeni Öneri / Şikayet Bildirimi</h2>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                    <p style="margin: 4px 0;"><strong>Firma:</strong> ${companyName}</p>
                    <p style="margin: 4px 0;"><strong>Gönderen:</strong> ${senderName}</p>
                    <p style="margin: 4px 0;"><strong>E-posta:</strong> <a href="mailto:${profile?.email || user.email}">${profile?.email || user.email}</a></p>
                    <p style="margin: 4px 0;"><strong>Konu:</strong> ${subject}</p>
                </div>
                <h3 style="margin-top: 24px;">Mesaj İçeriği:</h3>
                <div style="background: #ffffff; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${message}</div>
                <p style="font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                    Bu e-posta B2B Yedek Parça Platformu sisteminden otomatik olarak gönderilmiştir.
                </p>
            </div>
            `
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'Mesajınız başarıyla iletildi.' });

    } catch (error) {
        console.error('Email send error:', error);
        return NextResponse.json({ error: 'E-posta gönderilemedi: ' + error.message }, { status: 500 });
    }
}
