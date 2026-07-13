import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert demo tenant (safe for re-runs)
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'colegio-demo' },
    update: {},
    create: {
      subdomain: 'colegio-demo',
      name: 'Colegio Demo',
      brand: 'tiza',
      settings: JSON.stringify({
        maxStudentsPerClass: 45,
        allowedSubjects: ['Lenguaje', 'Matemáticas', 'Ciencias', 'Historia'],
      }),
    },
  });
  console.log(`   ✅ Tenant '${tenant.subdomain}' (${tenant.id})`);

  // Upsert demo users
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const usersToCreate = [
    { email: 'profesor@demo.cl', name: 'María González', role: 'TEACHER' },
    { email: 'director@demo.cl', name: 'Carlos Rodríguez', role: 'HOLDER' },
  ];

  for (const user of usersToCreate) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        password: hashedPassword,
        role: user.role,
        tenantId: tenant.id,
      },
    });
    console.log(`   ✅ User '${user.email}' (${user.role})`);
  }

  // Assign HOLDER user as owner of the demo tenant
  const holder = await prisma.user.findUnique({ where: { email: 'director@demo.cl' } });
  if (holder) {
    await prisma.tenantMember.upsert({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId: holder.id },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: holder.id,
        role: 'owner',
      },
    });
    console.log('   ✅ TenantMember director@demo.cl → colegio-demo (owner)');
  }

  console.log('✅ Seed complete');
  console.log('   Tenant: colegio-demo');
  console.log('   Teacher: profesor@demo.cl / demo123');
  console.log('   Holder:  director@demo.cl / demo123');
  console.log('   TenantMember: director@demo.cl → colegio-demo (owner)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
