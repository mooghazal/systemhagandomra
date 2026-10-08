import type { Metadata } from 'next';

import { BusesView } from '@hagamra/shared/features/buses/BusesView';

export const metadata: Metadata = { title: 'الحافلات' };

export default function Page() {
  return <BusesView />;
}
