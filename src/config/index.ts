import { Logger } from '@nestjs/common';

const logger = new Logger('config');

export function getJwtSecret(): string {
  const val = process.env.JWT_SECRET;
  if (!val) {
    logger.warn(
      'JWT_SECRET no está configurado. Usando valor por defecto. Considera establecer JWT_SECRET en las variables de entorno.',
    );
    return 'mi_secreto_super_seguro';
  }
  return val;
}
