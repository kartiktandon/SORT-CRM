import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to SORTCRM — Your workspace awaits',
  description: 'Your team’s little corner of the internet. Explore the SORTCRM demo workspace.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
