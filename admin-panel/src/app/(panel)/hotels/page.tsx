import type { Metadata } from 'next';

import { HotelsView } from '@hagamra/shared/features/hotels/HotelsView';

export const metadata: Metadata = { title: 'الفنادق' };

export default function Page() {
  return <HotelsView />;
}
