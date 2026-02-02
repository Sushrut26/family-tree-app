import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user (credentials from environment or defaults for dev only)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@family.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('✓ Admin user already exists');
  } else {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    console.log(`✓ Created admin user: ${admin.email}`);
    console.log('  ⚠️  Change password immediately after first login');
  }

  // Create family password (from environment or default for dev only)
  const familyPassword = process.env.FAMILY_PASSWORD || 'ChangeFamilyPwd123!';
  const existingConfig = await prisma.familyConfig.findFirst();

  if (existingConfig) {
    console.log('✓ Family password already configured');
  } else {
    const familyPasswordHash = await bcrypt.hash(familyPassword, 12);
    await prisma.familyConfig.create({
      data: {
        passwordHash: familyPasswordHash,
      },
    });
    console.log('✓ Created family password');
    console.log('  ⚠️  Update via admin panel after deployment');
  }

  console.log('\n🎉 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
