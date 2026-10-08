import type { Metadata } from 'next';

import { ProfileView } from '@hagamra/shared/features/profile/ProfileView';

export const metadata: Metadata = { title: 'الملف الشخصي' };

export default function Page() {
  return <ProfileView />;
}
