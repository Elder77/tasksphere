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
    const rawResponse = exception instanceof HttpException ? exception.getResponse() : 'Error interno del servidor';

    // helper: translate common English validation phrases to Spanish
    const translate = (s: string) => {
      if (!s || typeof s !== 'string') return s;
      let out = s;
      out = out.replace(/must be longer than or equal to (\d+) characters?/ig, 'Debe tener al menos $1 caracteres');
      out = out.replace(/must be shorter than or equal to (\d+) characters?/ig, 'Debe tener como máximo $1 caracteres');
      out = out.replace(/should not be empty/ig, 'Es obligatorio');
      out = out.replace(/must be an email/ig, 'Debe ser un email válido');
      out = out.replace(/must be a number/ig, 'Debe ser numérico');
      out = out.replace(/must be an integer/ig, 'Debe ser un entero');
      out = out.replace(/must be greater than or equal to (\d+)/ig, 'Debe ser mayor o igual a $1');
      out = out.replace(/Bad Request/ig, 'Solicitud inválida');
      out = out.replace(/Internal Server Error/ig, 'Error interno del servidor');
      out = out.replace(/already exists/ig, 'Ya existe');
      return out;
    };

    // Convert various response shapes into a normalized message object
    let message: any = rawResponse;

    // If the response is an array of ValidationError (class-validator), convert to field->messages
    if (Array.isArray(rawResponse) && rawResponse.length && typeof rawResponse[0] === 'object') {
      const obj: Record<string, string[]> = {};
      for (const it of rawResponse as any[]) {
        const prop = it.property || it.propertyName;
        const constraints = it.constraints || null;
        if (prop && constraints) {
          obj[prop] = Object.values(constraints).map((v: any) => translate(String(v)));
        }
      }
      message = obj;
    } else if (rawResponse && typeof rawResponse === 'object') {
      // If rawResponse.message is an array of strings like ["field must be..."]
      const rr: any = rawResponse as any;
      if (Array.isArray(rr.message) && rr.message.every((x: any) => typeof x === 'string')) {
        // Build field->messages by parsing each string "field ..."
        const obj: Record<string, string[]> = {};
        for (const m of rr.message as string[]) {
          const match = String(m).match(/^([a-zA-Z0-9_]+)\s+(.*)$/);
          if (match) {
            const key = match[1];
            const rest = match[2];
            obj[key] = obj[key] || [];
            obj[key].push(translate(rest));
          } else {
            // fallback: translate whole message and put under 'message'
            obj['message'] = obj['message'] || [];
            obj['message'].push(translate(String(m)));
          }
        }
        message = obj;
      } else if (rr.message && typeof rr.message === 'object' && !Array.isArray(rr.message)) {
        // message is already an object field->messages; translate inner strings
        const obj: Record<string, string[]> = {};
        for (const k of Object.keys(rr.message)) {
          const v = rr.message[k];
          if (Array.isArray(v)) obj[k] = v.map((x: any) => translate(String(x)));
          else obj[k] = [translate(String(v))];
        }
        message = obj;
      } else if (typeof rr === 'object' && rr['error'] && rr['message'] && Array.isArray(rr.message)) {
        // already handled above, but keep as fallback
        message = rr.message.map((m: any) => translate(String(m)));
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
