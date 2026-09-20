import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to NOVERA CRM — Your workspace awaits',
  description: 'Sign in to your NOVERA CRM workspace.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
