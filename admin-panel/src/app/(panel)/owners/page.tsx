import type { Metadata } from 'next';

import { OwnersView } from '@/features/owners/OwnersView';

export const metadata: Metadata = { title: 'الملاك' };

export default function Page() {
  return <OwnersView />;
}
