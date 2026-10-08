import type { Metadata } from 'next';

import { DashboardView } from '@hagamra/shared/features/dashboard/DashboardView';

export const metadata: Metadata = { title: 'الرئيسية' };

export default function DashboardPage() {
  return <DashboardView />;
}
