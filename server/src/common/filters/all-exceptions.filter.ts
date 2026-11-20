import type { Response } from 'express';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * 统一错误响应结构(与《需求文档》第 6 章约定一致):
 * { code: number, message: string, details?: string[] }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '服务器内部错误';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      const raw = exception.getResponse();
      if (typeof raw === 'string') {
        message = raw;
      } else if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.message)) {
          // class-validator 校验失败:message 为字符串数组
          details = obj.message.map(String);
          message = details.join('; ');
        } else if (obj.message) {
          message = String(obj.message);
        }
      }
    } else if (exception instanceof Error) {
      // 未知异常只记日志,不把内部细节泄露给客户端
      this.logger.error(exception.stack ?? exception.message);
    }

    response.status(status).json({ code: status, message, details });
  }
}
