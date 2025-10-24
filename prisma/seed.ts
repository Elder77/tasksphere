import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const identifiers = [
    { name: 'Placa', description: 'Número de placa', dataType: 'string' },
    { name: 'Predio', description: 'Código de predio', dataType: 'string' },
  ];

  for (const id of identifiers) {
    await prisma.identifier.upsert({
      where: { name: id.name },
      update: {},
      create: id,
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
