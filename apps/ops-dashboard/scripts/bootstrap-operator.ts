import { OPS_OPERATOR_ROLES, type OpsOperatorRole } from '@sentinel-apex/shared';

import { upsertOperator } from '../src/lib/auth.server.js';

function readArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];
  return value === undefined ? null : value;
}

function requireArg(flag: string): string {
  const value = readArg(flag);
  if (value === null || value.trim() === '') {
    throw new Error(`Missing required argument: ${flag}`);
  }

  return value.trim();
}

function readRole(): OpsOperatorRole {
  const value = readArg('--role') ?? 'admin';
  if (!OPS_OPERATOR_ROLES.includes(value as OpsOperatorRole)) {
    throw new Error(`Invalid role "${value}". Expected one of: ${OPS_OPERATOR_ROLES.join(', ')}`);
  }

  return value as OpsOperatorRole;
}

async function main(): Promise<void> {
  const operator = await upsertOperator({
    operatorId: requireArg('--operator-id'),
    email: requireArg('--email').toLowerCase(),
    displayName: requireArg('--display-name'),
    password: requireArg('--password'),
    role: readRole(),
    active: readArg('--active') === 'false' ? false : true,
  });

  process.stdout.write(`Bootstrapped operator ${operator.operatorId} (${operator.role})\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Bootstrap failed.'}\n`);
  process.exitCode = 1;
});
