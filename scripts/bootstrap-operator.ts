#!/usr/bin/env tsx
// =============================================================================
// Bootstrap Operator - One-time setup script
// =============================================================================
// This script is disabled unless BOOTSTRAP_OPERATOR_ENABLED=true.
// Required env:
//   DATABASE_URL
//   BOOTSTRAP_OPERATOR_ENABLED=true
//   BOOTSTRAP_OPERATOR_EMAIL
//   BOOTSTRAP_OPERATOR_PASSWORD
// =============================================================================

import { createHash, randomBytes, scryptSync } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../packages/db/src/schema/index.js';

const PASSWORD_PREFIX = 'scrypt';
const PASSWORD_COST = 16_384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;
const ENABLED_VALUE = 'true';

function hashPassword(password: string): string {
  const salt = randomBytes(32);
  const saltHex = salt.toString('hex');

  const derived = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: PASSWORD_COST,
    r: PASSWORD_BLOCK_SIZE,
    p: PASSWORD_PARALLELIZATION,
  });

  return `${PASSWORD_PREFIX}$${PASSWORD_COST}$${PASSWORD_BLOCK_SIZE}$${PASSWORD_PARALLELIZATION}$${saltHex}$${derived.toString('hex')}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`${name} environment variable is required.`);
  }
  return value;
}

function assertBootstrapEnabled(): void {
  if (process.env['BOOTSTRAP_OPERATOR_ENABLED'] !== ENABLED_VALUE) {
    throw new Error('Operator bootstrap is disabled. Set BOOTSTRAP_OPERATOR_ENABLED=true to run it intentionally.');
  }
}

function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized.includes('@') || normalized.startsWith('@') || normalized.endsWith('@')) {
    throw new Error('BOOTSTRAP_OPERATOR_EMAIL must be a valid email address.');
  }
  return normalized;
}

function assertSafePassword(password: string): void {
  if (password.length < 12) {
    throw new Error('BOOTSTRAP_OPERATOR_PASSWORD must be at least 12 characters.');
  }
}

function operatorIdForEmail(email: string): string {
  const digest = createHash('sha256').update(email).digest('hex').slice(0, 12);
  return `operator-${digest}`;
}

function displayNameForEmail(email: string): string {
  return email.split('@')[0] ?? 'operator';
}

async function bootstrap(): Promise<void> {
  assertBootstrapEnabled();

  const databaseUrl = requiredEnv('DATABASE_URL');
  const email = normalizeEmail(requiredEnv('BOOTSTRAP_OPERATOR_EMAIL'));
  const password = requiredEnv('BOOTSTRAP_OPERATOR_PASSWORD');
  assertSafePassword(password);

  const operatorId = operatorIdForEmail(email);
  const displayName = displayNameForEmail(email);

  console.log('Connecting to database...');
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });

  try {
    const existing = await db.query.opsOperators.findFirst({
      where: (ops, { eq: equals }) => equals(ops.email, email),
    });

    const passwordHash = hashPassword(password);

    if (existing) {
      await db
        .update(schema.opsOperators)
        .set({
          passwordHash,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.opsOperators.id, existing.id));

      console.log(`Operator ${email} updated. Password was not printed.`);
    } else {
      await db.insert(schema.opsOperators).values({
        operatorId,
        email,
        displayName,
        passwordHash,
        role: 'operator',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`Operator ${email} created. Password was not printed.`);
    }

    console.log('Rotate any operator previously created by older bootstrap scripts with hardcoded credentials.');
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

bootstrap().catch((error: unknown) => {
  console.error('ERROR:', error);
  process.exit(1);
});
