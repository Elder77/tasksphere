import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { resolve } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Filtro global de errores
  app.useGlobalFilters(new AllExceptionsFilter());
  // 🔹 Servir archivos estáticos desde la carpeta /uploads
  app.useStaticAssets(resolve(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger (opcional): intenta cargar @nestjs/swagger si está instalado
  try {
    const swagger = await import('@nestjs/swagger');
    const { SwaggerModule, DocumentBuilder } = swagger;
    const config = new DocumentBuilder()
      .setTitle('Tasksphere API')
      .setDescription('Documentación de la API de Tasksphere')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log('[main] Swagger UI montado en /docs');
  } catch (err) {
    console.error('[main] Swagger setup failed:', String(err));
  }
  // Habilitar CORS para que el frontend (Next.js) pueda llamar al backend desde el navegador
  // En producción ajusta origin a los orígenes permitidos (ej: ['https://mi-frontend.com'])
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.PORT);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  // Log the effective URL to help testing from LAN
  const displayHost = host === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : host;

  console.log(`[main] Listening on http://${displayHost}:${port}`);
}
void bootstrap();
