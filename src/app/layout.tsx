import type { Metadata, Viewport } from 'next';
import { Figtree, Shadows_Into_Light } from 'next/font/google';
import './globals.css';

const sans = Figtree({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const script = Shadows_Into_Light({ subsets: ['latin'], weight: '400', variable: '--font-script', display: 'swap' });

export const metadata: Metadata = {
  title: 'Dropcheck: token distributions that don’t strand tokens',
  description: 'Pre-check a Portaldot Assets token distribution, fix every problem, and send it in one signed batch.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
