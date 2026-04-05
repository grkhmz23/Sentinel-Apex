#!/usr/bin/env tsx
// =============================================================================
// Bootstrap Operator - One-time setup script
// =============================================================================
// Run this script to create the initial operator account:
//   npx tsx scripts/bootstrap-operator.ts
// =============================================================================

import { createHash, randomBytes, scryptSync } from 'node:crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../packages/db/src/schema/index.js';

const PASSWORD_PREFIX = 'scrypt';
const PASSWORD_COST = 16_384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;

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

async function bootstrap() {
  const databaseUrl = process.env['DATABASE_URL'];
  
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const email = 'gorkhmazb23@gmail.com';
  const password = 'Leon070124!!';
  const operatorId = 'operator-1';
  const displayName = 'Operator';
  
  console.log('Connecting to database...');
  const client = postgres(databaseUrl);
  const db = drizzle(client, { schema });
  
  try {
    // Check if operator already exists
    const existing = await db.query.opsOperators.findFirst({
      where: (ops, { eq }) => eq(ops.email, email),
    });
    
    if (existing) {
      console.log(`Operator ${email} already exists. Updating password...`);
      
      await db.update(schema.opsOperators)
        .set({
          passwordHash: hashPassword(password),
          active: true,
          updatedAt: new Date(),
        })
        .where(schema.opsOperators.id.equals(existing.id));
      
      console.log('✅ Password updated successfully!');
    } else {
      console.log(`Creating operator ${email}...`);
      
      await db.insert(schema.opsOperators).values({
        operatorId,
        email,
        displayName,
        passwordHash: hashPassword(password),
        role: 'operator',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('✅ Operator created successfully!');
    }
    
    console.log('');
    console.log('Login credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log('');
    console.log('You can now sign in at: https://www.sentinelapex.com/sign-in');
    
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

bootstrap();
