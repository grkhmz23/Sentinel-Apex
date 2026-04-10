import { RuntimeControlPlane } from '../packages/runtime/src/control-plane.js';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'] ?? 'pglite://memory';
  const controlPlane = await RuntimeControlPlane.connect(databaseUrl);

  try {
    const dossier = await controlPlane.getSubmissionDossier();
    const completeness = await controlPlane.getSubmissionCompleteness();

    process.stdout.write(JSON.stringify({
      readiness: dossier.readiness,
      completeness,
      dossier: {
        submissionId: dossier.submissionId,
        databaseUrl,
        buildWindowStart: dossier.buildWindowStart,
        buildWindowEnd: dossier.buildWindowEnd,
        addressScope: dossier.addressScope,
        walletAddress: dossier.walletAddress,
        vaultAddress: dossier.vaultAddress,
        realExecutionCountInWindow: dossier.realExecutionCountInWindow,
        realizedApyPct: dossier.realizedApyPct,
        cexExecutionUsed: dossier.cexExecutionUsed,
      },
    }, null, 2));
    process.stdout.write('\n');
  } finally {
    await controlPlane.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
