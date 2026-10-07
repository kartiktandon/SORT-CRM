import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to SORT CRM — Your workspace awaits',
  description: 'Sign in to your SORT CRM workspace.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
