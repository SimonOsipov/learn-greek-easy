import AppTabs from '@/components/app-tabs';

// Authenticated shell. Auth gating lives on the root Stack (SHELL-03);
// NativeTabs has no .Protected API, so no guard here.
export default function AppLayout() {
  return <AppTabs />;
}
