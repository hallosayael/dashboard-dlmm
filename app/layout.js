import './globals.css';

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
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
