import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  get(key: string, fallback?: string): string {
    const val = process.env[key];
    if (val === undefined || val === null) {
      if (fallback !== undefined) return fallback;
      this.logger.warn(`${key} no está establecido en variables de entorno`);
      return '';
    }
    return val;
  }

  getJwtSecret(): string {
    const val = this.get('JWT_SECRET');
    if (!val) {
      this.logger.warn(
        'JWT_SECRET no definido; usarás el valor por defecto en desarrollo',
      );
      return 'mi_secreto_super_seguro';
    }
    return val;
  }
}
