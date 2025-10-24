import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';


async function bootstrap() {
   const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Filtro global de errores
  app.useGlobalFilters(new AllExceptionsFilter());
    // 🔹 Servir archivos estáticos desde la carpeta /uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // Swagger (opcional): intenta cargar @nestjs/swagger si está instalado
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SwaggerModule, DocumentBuilder } = require('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Tasksphere API')
      .setDescription('Documentación de la API de Tasksphere')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    // debug log to confirm setup
    // eslint-disable-next-line no-console
    console.log('[main] Swagger UI montado en /docs');
  } catch (e) {
    // paquete no instalado o fallo al configurar Swagger; se omite Swagger
    // eslint-disable-next-line no-console
    console.error('[main] Swagger setup failed:', e && e.message ? e.message : e);
  }
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
