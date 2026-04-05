#!/usr/bin/env node
// Bootstrap operator - plain JS version

const { createHash, randomBytes, scryptSync } = require('crypto');

const PASSWORD_PREFIX = 'scrypt';
const PASSWORD_COST = 16384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;

function hashPassword(password) {
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
  
  console.log('Generating password hash...');
  const passwordHash = hashPassword(password);
  
  console.log('Generated hash:', passwordHash);
  console.log('');
  console.log('Run this SQL in Neon:');
  console.log('');
  console.log(`INSERT INTO ops_operators (id, operator_id, email, display_name, password_hash, role, active, created_at, updated_at)`);
  console.log(`VALUES (`);
  console.log(`    gen_random_uuid(),`);
  console.log(`    '${operatorId}',`);
  console.log(`    '${email}',`);
  console.log(`    '${displayName}',`);
  console.log(`    '${passwordHash}',`);
  console.log(`    'operator',`);
  console.log(`    true,`);
  console.log(`    NOW(),`);
  console.log(`    NOW()`);
  console.log(`)`);
  console.log(`ON CONFLICT (email) DO UPDATE SET`);
  console.log(`    password_hash = EXCLUDED.password_hash,`);
  console.log(`    active = true,`);
  console.log(`    updated_at = NOW();`);
  console.log('');
  console.log('Login credentials:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
}

bootstrap();
