import './globals.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata = {
  title: 'B2B Yedek Parça Platformu',
  description: 'Bayi yönetim sistemi ve B2B satış platformu',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body className={outfit.variable}>
        {children}
      </body>
    </html>
  );
}
