import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminEmail = 'admin@family.com';
  const adminPassword = 'admin123'; // Change this after first login!

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('✓ Admin user already exists');
  } else {
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
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
    console.log(`  Password: ${adminPassword} (please change after first login)`);
  }

  // Create family password
  const familyPassword = 'family2024'; // This is the shared family password
  const existingConfig = await prisma.familyConfig.findFirst();

  if (existingConfig) {
    console.log('✓ Family password already configured');
  } else {
    const familyPasswordHash = await bcrypt.hash(familyPassword, 10);
    await prisma.familyConfig.create({
      data: {
        passwordHash: familyPasswordHash,
      },
    });
    console.log(`✓ Created family password: ${familyPassword}`);
    console.log('  (Share this with family members)');
  }

  console.log('\n🎉 Database seed completed!');
  console.log('\nLogin credentials:');
  console.log('  Email: admin@family.com');
  console.log('  Password: admin123');
  console.log('  Family Password: family2024');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
