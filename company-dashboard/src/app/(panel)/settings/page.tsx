import type { Metadata } from 'next';

import { SettingsView } from '@hagamra/shared/features/settings/SettingsView';

export const metadata: Metadata = { title: 'الإعدادات' };

export default function Page() {
  return <SettingsView />;
}
