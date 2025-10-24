## Sistema de Tickets — Especificación funcional (Backend)

Documento técnico en español que cubre los requisitos del sistema de tickets pensado solo para backend, partiendo de la base del proyecto existente.

### Objetivo

Construir el backend para un sistema de tickets/tareas que incluya:
- Gestión de Tickets (crear, asignar, cerrar, reabrir, historial)
- Identificadores predefinidos (campos asociados a los tickets)
- Chat en tiempo real por ticket (WebSockets)
- Adjuntos/archivos de soporte (validación y almacenamiento)
- Roles y permisos (Usuario estándar y Superadmin)

Se reutiliza la autenticación y los usuarios existentes del sistema.

---

## Módulos principales (Backend)

- Tickets: endpoints REST para CRUD y acciones (asignar, cerrar, reabrir). Guarda datos base en `tickets`.
- Identificadores: CRUD para `identifiers` que se usan como campo obligatorio al crear tickets.
- Archivos: manejo de uploads/descargas; metadatos en BD (`ticket_files`).
- Historial: registros en `ticket_history` por cada evento (creación, asignación, edición, cierre, reapertura, archivos).
- Chat (WebSocket): gateway que persiste mensajes en `ticket_chat`.

---

## Modelos de datos (resumen)

- User (existente): se usa `id`, `name`, `email`, `role`.
- Identifier: campos que definen el identificador (tipo, regex, longitudes...)
- Module: lista de módulos/áreas a las que pertenece el ticket.
- Ticket: entidad principal con relación a Identifier, Module, usuario creador y posible usuario asignado.
- TicketFile: archivos asociados a un ticket o a una línea de historial.
- TicketHistory: eventos históricos ligados al ticket.
- TicketChat: mensajes de chat en tiempo real.

Ver el esquema Prisma actualizado para la definición exacta de campos y relaciones.

---

## Reglas de negocio / Casos de uso

Roles:
- Usuario estándar:
  - Crea tickets.
  - Puede ver tickets que haya creado (y los asignados si permisos lo permiten en el futuro).
  - Editar observación y módulo de un ticket propio.
  - Reabrir tickets que estén cerrados (añadiendo motivo y archivos).

- Superadmin:
  - Ver todos los tickets.
  - Asignar tickets a otros superadmins.
  - Cerrar tickets (requiere observación y puede subir archivos).
  - Participa en chat del ticket asignado.

Flujo principal:
1. Login: se utiliza la autenticación existente (JWT). El backend asume al usuario autenticado.
2. Crear ticket: POST /tickets -> valida campos y archivos; crea registro y entradas de historial.
3. Asignar ticket: POST /tickets/:id/assign -> solo superadmin.
4. Cerrar ticket: POST /tickets/:id/close -> superadmin, guarda observación y archivos.
5. Reabrir ticket: POST /tickets/:id/reopen -> usuario que creó el ticket.
6. Chat: establezca conexión WebSocket una vez el ticket está asignado.

---

## API propuesta (endpoints clave)

Autenticación: requerir cabecera Authorization: Bearer <token>

Tickets
- GET /tickets
  - Parámetros: search, state, module, page, perPage, sort
  - Permisos: superadmin ve todo; usuario ve sus propios.

- GET /tickets/:id
  - Muestra ticket completo con historial y archivos.

- POST /tickets
  - Cuerpo JSON: { identifierId, title, description, moduleId }
  - Archivos: multipart/form-data (max 3 archivos, 5MB cada uno)
  - Validaciones: todos obligatorios excepto archivos.

- PUT /tickets/:id
  - Edita sólo: description, moduleId, añadir archivos.
  - No permite cambiar identifierId.

- POST /tickets/:id/assign
  - Body: { assignedToId }
  - Permisos: Superadmin

- POST /tickets/:id/close
  - Body: { note }
  - Archivos opcionales: multipart (máx. 3 x 5MB)
  - Acción solo Superadmin y debe haberse asignado antes.

- POST /tickets/:id/reopen
  - Body: { reason }
  - Archivos opcionales
  - Solo el creador puede reabrir (business rule configurable)

Identificadores
- GET /identifiers
- POST /identifiers
- PUT /identifiers/:id
- DELETE /identifiers/:id

Archivos
- POST /tickets/:id/files
  - Upload endpoint para añadir archivos a ticket o a una acción de historial.
- GET /tickets/:id/files/:fileId
  - Descarga con autorización.

Chat (WebSocket)
- Namespace/route: /ws/tickets
- Eventos:
  - join_ticket { ticketId }
  - message { ticketId, message, optional file }
  - message_saved (acknowledge)
- Permisos: solo creador y superadmin asignado pueden unirse al canal de un ticket.

---

## Validaciones y límites

- Campos obligatorios: identifier, title, description, module.
- Archivos: máximo 3 por acción (crear/editar/close/reopen), 5MB por archivo.
- Validar tipo MIME en backend (lista blanca basada en requerimiento: images/pdf/zip/text).
- Validar cantidad y tamaño también en frontend (Defensa en profundidad).

Errores comunes (HTTP):
- 400 Bad Request: validación fallida
- 401 Unauthorized: token ausente o inválido
- 403 Forbidden: falta de permisos
- 404 Not Found: ticket/identificador no existe
- 413 Payload Too Large: archivo excede el límite

---

## Almacenamiento de archivos

Opción 1 (sencilla): Guardar archivos en filesystem del servidor, ruta relativa en `ticket_files.path`.
Opción 2: Almacenes externos (S3, Azure) — preferible para producción.

Metadatos en DB: original filename, path/url, mime, size, usuario que subió, referencia a ticket y/o historial.

---

## Historial

Cada cambio importante genera una entrada en `ticket_history` con:
- ticketId, acción (CREATED, ASSIGNED, EDITED, CLOSED, REOPENED), usuario, observación, archivos.

El endpoint GET /tickets/:id devuelve timeline ordenado por fecha.

---

## Chat en tiempo real

- Gateway WebSocket que exige autenticación (ej. JWT en query o en handshake).
- Mensajes persistidos en `ticket_chat` con referencia al ticket y usuario.
- Reglas:
  - Solo permite unirse si ticket está asignado y el usuario es creador o asignado.
  - No se permite eliminar mensajes.
  - Archivos en chat: máximo 5MB por archivo; cada mensaje puede tener un archivo opcional.

---

## Consideraciones de seguridad

- Validar autorización en cada endpoint (RBAC): basarse en `user.role` o claims del JWT.
- Sanitizar texto para evitar XSS en frontend (aunque backend guarda datos puros).
- Escapar y validar rutas de archivos en servidor.

---

## Migraciones y datos iniciales

- Crear migración Prisma que añada tablas y enums.
- Inicializar con identificadores mínimos (ej.: "Placa", "Predio").

---

## Contrato mínimo de APIs (ejemplos)

POST /tickets (multipart/form-data)
- fields: identifierId (number), title (string), description (string), moduleId (number)
- files: attachments[]

Response 201
{
  "id": 123,
  "identifierId": 1,
  "title": "Falló sensor",
  "status": "OPEN",
  "createdAt": "..."
}

---

## Notas y supuestos

- Reutilizamos el sistema de usuarios existente y su autenticación (JWT).
- El frontend solo necesita listar usuarios para asignación; no se crean usuarios nuevos desde este módulo.
- Para simplificar las primeras iteraciones, el almacenamiento de archivos local es aceptable.

---

## Próximos pasos técnicos

1. Actualizar `prisma/schema.prisma` (hecho en este commit) y generar migración.
2. Implementar módulo NestJS `tickets` con controladores, servicios, DTOs y validaciones.
3. Implementar gateway WebSocket para chat.
4. Añadir pruebas mínimas de integración para creación de ticket y envío de mensaje.

---

Fin del documento.
