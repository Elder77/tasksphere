import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // Captura cualquier excepción (no solo HttpException)
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Si la excepción es HttpException, extrae su información
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Normalize and translate messages to Spanish when possible
    const rawResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Error interno del servidor';

    // helper: translate common English validation phrases to Spanish
    const translate = (s: string) => {
      if (!s || typeof s !== 'string') return s;
      let out = s;
      out = out.replace(
        /must be longer than or equal to (\d+) characters?/gi,
        'Debe tener al menos $1 caracteres',
      );
      out = out.replace(
        /must be shorter than or equal to (\d+) characters?/gi,
        'Debe tener como máximo $1 caracteres',
      );
      out = out.replace(/should not be empty/gi, 'Es obligatorio');
      out = out.replace(/must be an email/gi, 'Debe ser un email válido');
      out = out.replace(/must be a number/gi, 'Debe ser numérico');
      out = out.replace(/must be an integer/gi, 'Debe ser un entero');
      out = out.replace(
        /must be greater than or equal to (\d+)/gi,
        'Debe ser mayor o igual a $1',
      );
      out = out.replace(/Bad Request/gi, 'Solicitud inválida');
      out = out.replace(
        /Internal Server Error/gi,
        'Error interno del servidor',
      );
      out = out.replace(/already exists/gi, 'Ya existe');
      return out;
    };

    // Convert various response shapes into a normalized message object
    let message: unknown = rawResponse;

    // If the response is an array of ValidationError (class-validator), convert to field->messages
    if (
      Array.isArray(rawResponse) &&
      rawResponse.length &&
      typeof rawResponse[0] === 'object'
    ) {
      const obj: Record<string, string[]> = {};
      for (const it of rawResponse) {
        const itObj = it as Record<string, unknown>;
        const prop =
          typeof itObj.property === 'string'
            ? itObj.property
            : typeof itObj.propertyName === 'string'
              ? itObj.propertyName
              : undefined;
        const constraints = itObj.constraints as
          | Record<string, unknown>
          | undefined;
        if (prop && constraints && typeof constraints === 'object') {
          obj[prop] = Object.values(constraints).map((v) =>
            translate(String(v)),
          );
        }
      }
      message = obj;
    } else if (rawResponse && typeof rawResponse === 'object') {
      const rr = rawResponse as Record<string, unknown>;
      const maybeMessage = rr.message;

      if (
        Array.isArray(maybeMessage) &&
        maybeMessage.every((x) => typeof x === 'string')
      ) {
        const obj: Record<string, string[]> = {};
        for (const m of maybeMessage) {
          const match = String(m).match(/^([a-zA-Z0-9_]+)\s+(.*)$/);
          if (match) {
            const key = match[1];
            const rest = match[2];
            obj[key] = obj[key] || [];
            obj[key].push(translate(rest));
          } else {
            obj['message'] = obj['message'] || [];
            obj['message'].push(translate(String(m)));
          }
        }
        message = obj;
      } else if (
        maybeMessage &&
        typeof maybeMessage === 'object' &&
        !Array.isArray(maybeMessage)
      ) {
        const obj: Record<string, string[]> = {};
        for (const k of Object.keys(maybeMessage as Record<string, unknown>)) {
          const v = (maybeMessage as Record<string, unknown>)[k];
          if (Array.isArray(v)) obj[k] = v.map((x) => translate(String(x)));
          else obj[k] = [translate(String(v))];
        }
        message = obj;
      } else if (
        typeof rr === 'object' &&
        rr['error'] &&
        Array.isArray(maybeMessage)
      ) {
        message = (maybeMessage as unknown[]).map((m) => translate(String(m)));
      }
    } else if (typeof rawResponse === 'string') {
      message = translate(rawResponse);
    }

    // Devuelve una respuesta uniforme (con mensajes en español cuando sea posible)
    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      statusCode: status,
      message,
    });
  }
}
