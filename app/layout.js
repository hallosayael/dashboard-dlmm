import './globals.css';
import { Inter } from 'next/font/google';

// Inter (variable) — dipakai KHUSUS untuk kalender & kartu PnL bulanan lewat
// CSS var --font-inter (lihat globals.css). Sisa situs tetap monospace.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'DLMM Closed PnL',
  description: 'Lihat hasil trading DLMM (posisi closed) dari sebuah wallet Solana — PnL dalam SOL.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0c10',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
