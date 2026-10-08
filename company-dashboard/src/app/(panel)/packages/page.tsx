import type { Metadata } from 'next';

import { PackagesView } from '@hagamra/shared/features/packages/PackagesView';

export const metadata: Metadata = { title: 'الباقات' };

export default function Page() {
  return <PackagesView />;
}
