import { PrismaClient, UserRole, TenantPlan, TenantStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('VilarDS2026!', 12);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vilar-ds' },
    update: {},
    create: {
      slug: 'vilar-ds',
      name: 'SARL Vilar DS',
      siren: '495126344',
      plan: TenantPlan.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      email: 'contact@vilar-ds.fr',
      address: '1 rue de la Construction',
      city: 'Semoy',
      postalCode: '45400',
      country: 'FR',
      defaultCurrency: 'EUR',
      defaultTaxRate: 20.0,
    },
  });

  const admin = await prisma.user.upsert({
    where: { googleId: 'seed-admin' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@vilar-ds.fr',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Vilar DS',
      role: UserRole.TENANT_ADMIN,
      emailVerified: true,
      googleId: 'seed-admin',
    },
  });

  await prisma.contact.upsert({
    where: { id: 'seed-contact-1' },
    update: {},
    create: {
      id: 'seed-contact-1',
      tenantId: tenant.id,
      createdById: admin.id,
      isCompany: true,
      companyName: 'Bâtiment Dupont SA',
      email: 'contact@dupont-batiment.fr',
      phone: '02 38 XX XX XX',
      status: 'CUSTOMER',
      city: 'Orléans',
      postalCode: '45000',
      totalRevenue: 45000,
      totalInvoices: 3,
    },
  });

  console.log('Seed complete. Admin: admin@vilar-ds.fr / VilarDS2026!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
