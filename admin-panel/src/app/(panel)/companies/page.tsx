import type { Metadata } from 'next';

import { CompaniesView } from '@/features/companies/CompaniesView';

export const metadata: Metadata = { title: 'الشركات' };

export default function Page() {
  return <CompaniesView />;
}
