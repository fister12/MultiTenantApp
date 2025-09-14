import { PrismaClient } from '../src/generated/prisma';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create tenants
  console.log('Creating tenants...');
  
  const acmeTenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      slug: 'acme',
      name: 'Acme Corp',
      plan: 'FREE',
    },
  });

  const globexTenant = await prisma.tenant.upsert({
    where: { slug: 'globex' },
    update: {},
    create: {
      slug: 'globex',
      name: 'Globex Inc',
      plan: 'FREE',
    },
  });

  console.log(`✅ Created tenants: ${acmeTenant.name}, ${globexTenant.name}`);

  // Hash the password for all test accounts
  const hashedPassword = await hashPassword('password');

  // Create test users
  console.log('Creating test users...');

  const acmeAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.test' },
    update: {},
    create: {
      email: 'admin@acme.test',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: acmeTenant.id,
    },
  });

  const acmeUser = await prisma.user.upsert({
    where: { email: 'user@acme.test' },
    update: {},
    create: {
      email: 'user@acme.test',
      password: hashedPassword,
      role: 'MEMBER',
      tenantId: acmeTenant.id,
    },
  });

  const globexAdmin = await prisma.user.upsert({
    where: { email: 'admin@globex.test' },
    update: {},
    create: {
      email: 'admin@globex.test',
      password: hashedPassword,
      role: 'ADMIN',
      tenantId: globexTenant.id,
    },
  });

  const globexUser = await prisma.user.upsert({
    where: { email: 'user@globex.test' },
    update: {},
    create: {
      email: 'user@globex.test',
      password: hashedPassword,
      role: 'MEMBER',
      tenantId: globexTenant.id,
    },
  });

  console.log('✅ Created test users:');
  console.log(`  - ${acmeAdmin.email} (${acmeAdmin.role}) - Tenant: ${acmeTenant.slug}`);
  console.log(`  - ${acmeUser.email} (${acmeUser.role}) - Tenant: ${acmeTenant.slug}`);
  console.log(`  - ${globexAdmin.email} (${globexAdmin.role}) - Tenant: ${globexTenant.slug}`);
  console.log(`  - ${globexUser.email} (${globexUser.role}) - Tenant: ${globexTenant.slug}`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });