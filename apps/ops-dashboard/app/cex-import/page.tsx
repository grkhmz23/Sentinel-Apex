import { CexImportForm } from './cex-import-form';
import { AppShell } from '../../src/components/app-shell';
import { requireDashboardSession } from '../../src/lib/auth.server';

export const dynamic = 'force-dynamic';

export default async function CexImportPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/cex-import');

  return (
    <AppShell session={session}>
      <CexImportForm _session={session} />
    </AppShell>
  );
}
