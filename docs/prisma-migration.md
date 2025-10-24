# Migraciones Prisma y seed (Windows PowerShell)

Instrucciones para generar migraciones y semillas de datos para el módulo de tickets.

1) Generar cliente Prisma y migración

En PowerShell (desde la raíz del proyecto):

```
# Asegúrate de tener DATABASE_URL en .env
npx prisma generate
npx prisma migrate dev --name add_tickets_module
```

2) Ejecutar seed (opcional) — crear identificadores iniciales

Si quieres poblar identificadores de ejemplo, usa el script `prisma/seed.ts` incluido.

Instala dependencias si es necesario:

```
# instalar ts-node y @types/node si no están instalados
npm install -D ts-node typescript @types/node
# ejecutar seed
npx ts-node prisma/seed.ts
```

Alternativamente compila y ejecuta con Node si prefieres JavaScript.

3) Notas

- En producción usa `prisma migrate deploy` y un seed que sea idempotente.
- Revisa `prisma/schema.prisma` para los modelos añadidos: Identifier, TicketFile, TicketHistory.
