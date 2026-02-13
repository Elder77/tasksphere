import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Usar secret inyectado por ConfigService
      secretOrKey: config.getJwtSecret(),
    });
  }

  validate(payload: unknown) {
    // Normalizar payload JWT con tipo seguro
    const p = payload as {
      sub?: string;
      usua_email?: string;
      perf_id?: number;
    };
    return {
      usua_cedula: p.sub,
      usua_email: p.usua_email,
      perf_id: p.perf_id,
    };
  }
}
