import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://short-marketing-crm.stable-cod-4752.chatgpt.site'),
  title: 'Short CRM — Agency command center',
  description: 'A focused CRM for marketing teams to manage leads, clients, projects and revenue.',
  openGraph: {
    title: 'Short CRM — Agency command center',
    description: 'Leads. Clients. Projects. One clear workspace.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Short CRM — Agency command center',
    description: 'Leads. Clients. Projects. One clear workspace.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
