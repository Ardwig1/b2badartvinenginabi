import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html }) {
    console.log('📧 Attempting to send email via:', process.env.SMTP_HOST, 'User:', process.env.SMTP_USER);
    
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        requireTLS: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"B2B Bildirim" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        console.log('✅ Email sent successfully! MessageId:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ SMTP Error Details:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        return { success: false, error: error.message };
    }
}
