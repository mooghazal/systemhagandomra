import type { Metadata } from 'next';

import { AuditLogsView } from '@hagamra/shared/features/audit-logs/AuditLogsView';

export const metadata: Metadata = { title: 'سجل العمليات' };

export default function Page() {
  return <AuditLogsView />;
}
