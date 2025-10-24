import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Usa variable de entorno JWT_SECRET en producción. Se mantiene un fallback para desarrollo.
      secretOrKey: process.env.JWT_SECRET || 'mi_secreto_super_seguro',
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email,role: payload.role };
  }
}
