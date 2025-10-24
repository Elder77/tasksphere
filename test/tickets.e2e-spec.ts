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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    // register a fresh test user and login to get JWT
    const username = `testuser_${Date.now()}`;
    const password = 'testpwd123';
    await request(app.getHttpServer()).post('/auth/register').send({ username, password });
    const res = await request(app.getHttpServer()).post('/auth/login').send({ username, password });
    expect(res.status).toBe(201);
    jwt = res.body?.access_token;
    expect(jwt).toBeTruthy();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('creates a ticket and stores files metadata', async () => {
    // ensure an identifier exists
    const identifier = await prisma.identifier.findFirst();
    expect(identifier).toBeTruthy();

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const pdf = Buffer.from('%PDF-1.4');

    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set('Authorization', `Bearer ${jwt}`)
      .field('identifierId', identifier.id)
      .field('title', 'Prueba e2e')
      .field('description', 'Descripción prueba')
      .field('module', 'Soporte')
      .attach('attachments', png, 'test.png')
      .attach('attachments', pdf, 'test.pdf');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');

    const ticketId = res.body.id;
    const files = await prisma.ticketFile.findMany({ where: { ticketId } });
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  it('can persist a chat message in DB', async () => {
    // create ticket directly
    const t = await prisma.ticket.create({ data: { title: 'Chat ticket', description: 'x', identifierId: 1, module: 'M', userId: 2 } });
    // WebSocket flow: connect with JWT, join room, send message and verify persisted
    const socketUrl = 'http://localhost:3000/ws/tickets';
    const client: Socket = ioClient(socketUrl, { auth: { token: jwt }, transports: ['websocket'] });

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
    });

    // join
    const joinRes = await new Promise<any>((resolve) => client.emit('join_ticket', { ticketId: t.id }, (r: any) => resolve(r)));
    expect(joinRes).toBeTruthy();

    // send
    const sendRes = await new Promise<any>((resolve) => client.emit('message', { ticketId: t.id, message: 'hola ws' }, (r: any) => resolve(r)));
    expect(sendRes?.status).toBe('ok');

    // give server a moment to persist
    await new Promise((r) => setTimeout(r, 200));

    const messages = await prisma.chatMessage.findMany({ where: { ticketId: t.id } });
    expect(messages.length).toBeGreaterThan(0);

    client.disconnect();
  });
});
