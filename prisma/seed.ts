import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const identifiers = [
    { name: 'Placa', description: 'Número de placa', dataType: 'string' },
    { name: 'Predio', description: 'Código de predio', dataType: 'string' },
  ];

  for (const id of identifiers) {
    const exists = await prisma.ticket_identificador.findFirst({ where: { tiid_nombre: id.name } });
    if (!exists) {
      await prisma.ticket_identificador.create({ data: {
        tiid_nombre: id.name,
        tiid_descripcion: id.description,
        tiid_tipo_dato: id.dataType,
        fecha_sistema: new Date(),
      }});
    }
  }

  console.log('Seed completed');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
