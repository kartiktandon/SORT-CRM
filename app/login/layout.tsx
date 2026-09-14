import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to SORTCRM — Your workspace awaits',
  description: 'Sign in to your SORTCRM workspace.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
