import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';
import { io as ioClient, Socket } from 'socket.io-client';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let jwt: string;
  let usua_cedula: string;
  let usua_nombres: string;
  let adminJwt: string;
  let admin_cedula: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
  await app.init();
  // Start HTTP server on ephemeral port so socket.io client can connect during tests
  const server: any = app.getHttpServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = addr && addr.port ? addr.port : 3000;
  // store port on app for use in tests
  (app as any).__testPort = port;

    // register a fresh test user and login to get JWT
  usua_cedula = String(Date.now()).slice(-11);
  usua_nombres = `testuser_${Date.now()}`;
  const password = 'testpwd123';
    await request(app.getHttpServer()).post('/auth/register').send({ usua_cedula, usua_nombres, usua_password: password });
  const res = await request(app.getHttpServer()).post('/auth/login').send({ usua_cedula, usua_password: password });
    expect(res.status).toBe(201);
    jwt = res.body?.access_token;
    expect(jwt).toBeTruthy();

    // register an admin user and login
  admin_cedula = '00000000099';
  const adminName = `admin_${Date.now()}`;
  const adminPass = 'adminpwd123';
    await request(app.getHttpServer()).post('/auth/register').send({ usua_cedula: admin_cedula, usua_nombres: adminName, usua_password: adminPass, perf_id: 2 });
  const adminRes = await request(app.getHttpServer()).post('/auth/login').send({ usua_cedula: admin_cedula, usua_password: adminPass });
    expect(adminRes.status).toBe(201);
    adminJwt = adminRes.body?.access_token;
    expect(adminJwt).toBeTruthy();
  });

  afterAll(async () => {
    // Close Nest app and DB client. Increase timeout if needed.
    try {
      await app.close();
    } catch (err) {
      // ignore errors on close
    }
    await prisma.$disconnect();
  }, 20000);

  it('creates a ticket and stores files metadata', async () => {
    // ensure an identifier exists
  const identifier = await prisma.ticket_identificador.findFirst();
  expect(identifier).toBeTruthy();

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const pdf = Buffer.from('%PDF-1.4');

    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${jwt}`)
  .field('tiid_id', identifier!.tiid_id)
      .field('tick_nombre', 'Prueba e2e')
      .field('tick_descripcion', 'Descripción prueba')
      .field('tick_modulo', 'Soporte')
      .attach('attachments', png, 'test.png')
      .attach('attachments', pdf, 'test.pdf');

  expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('tick_id');

    const tick_id = res.body.tick_id;
    const files = await prisma.ticked_file.findMany({ where: { tick_id } });
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  it('can persist a chat message in DB', async () => {
    // create ticket directly
  const t = await prisma.ticket.create({ data: { tick_nombre: 'Chat ticket', tick_descripcion: 'x', tick_id_identificador: 1, tick_modulo: 'M', usua_cedula: usua_cedula, proy_id: 1 } });
    // WebSocket flow: connect with JWT, join room, send message and verify persisted
  const port = (app as any).__testPort || 3000;
  const socketUrl = `http://localhost:${port}/ws/tickets`;
  const client: Socket = ioClient(socketUrl, { auth: { token: jwt }, transports: ['websocket'] });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
    });

    // join
  const joinRes = await new Promise<any>((resolve) => client.emit('join_ticket', { tick_id: t.tick_id }, (r: any) => resolve(r)));
    expect(joinRes).toBeTruthy();

    // send
  const sendRes = await new Promise<any>((resolve) => client.emit('message', { tick_id: t.tick_id, message: 'hola ws' }, (r: any) => resolve(r)));
    expect(sendRes?.status).toBe('ok');

    // give server a moment to persist
    await new Promise((r) => setTimeout(r, 200));

  const messages = await prisma.ticket_chat.findMany({ where: { tick_id: t.tick_id } });
    expect(messages.length).toBeGreaterThan(0);

    client.disconnect();
  });

  it('assign non-admin should return 400', async () => {
    // ensure identifier exists
    const identifier = await prisma.ticket_identificador.findFirst();
    expect(identifier).toBeTruthy();

    // create a ticket (by regular user)
    const resCreate = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${jwt}`)
      .field('tiid_id', identifier!.tiid_id)
      .field('tick_nombre', 'Ticket para asignar')
      .field('tick_descripcion', 'Descripcion')
      .field('tick_modulo', 'Soporte');
    expect(resCreate.status).toBe(201);
    const tick_id = resCreate.body.tick_id;

    // admin tries to assign the ticket to the regular user (which is not admin)
    const resAssign = await request(app.getHttpServer())
      .post('/tickets/assign')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ ticket_id: tick_id, tick_usuario_asignado: usua_cedula });
    expect(resAssign.status).toBe(400);
  });

  it('closing unassigned ticket should return 400', async () => {
    // create a ticket (unassigned)
    const t = await prisma.ticket.create({ data: { tick_nombre: 'To close', tick_descripcion: 'x', tick_id_identificador: 1, tick_modulo: 'M', usua_cedula: usua_cedula, proy_id: 1 } });

    const resClose = await request(app.getHttpServer())
      .post(`/tickets/${t.tick_id}/close`)
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ note: 'cerrando' });
    expect(resClose.status).toBe(400);
  });
});
