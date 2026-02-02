import prisma from '../src/config/database';
import fs from 'fs';
import path from 'path';

async function backup() {
  console.log('Starting database backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups');

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    // Fetch all data
    const [users, persons, relationships, familyConfig, auditLogs] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // Exclude password hash for security
        }
      }),
      prisma.person.findMany(),
      prisma.relationship.findMany(),
      prisma.familyConfig.findMany(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1000 // Last 1000 audit logs
      }),
    ]);

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        users,
        persons,
        relationships,
        familyConfig,
        auditLogs,
      },
      stats: {
        usersCount: users.length,
        personsCount: persons.length,
        relationshipsCount: relationships.length,
        familyConfigCount: familyConfig.length,
        auditLogsCount: auditLogs.length,
      }
    };

    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`\nBackup completed successfully!`);
    console.log(`File: ${filepath}`);
    console.log(`\nStats:`);
    console.log(`  Users: ${users.length}`);
    console.log(`  Persons: ${persons.length}`);
    console.log(`  Relationships: ${relationships.length}`);
    console.log(`  Family Configs: ${familyConfig.length}`);
    console.log(`  Audit Logs: ${auditLogs.length}`);

  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
