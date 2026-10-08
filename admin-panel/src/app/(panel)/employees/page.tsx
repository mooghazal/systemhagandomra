import type { Metadata } from 'next';

import { EmployeesView } from '@hagamra/shared/features/employees/EmployeesView';

export const metadata: Metadata = { title: 'الموظفون' };

export default function Page() {
  return <EmployeesView />;
}
