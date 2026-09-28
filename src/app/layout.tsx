import { Urbanist } from 'next/font/google';

export const metadata = { title: 'HIT Campus Assistant: Back Office' };

const urbanist = Urbanist({ subsets: ['latin'], variable: '--font-urbanist' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={urbanist.variable}>
      <body style={{ fontFamily: 'var(--font-urbanist), system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
