import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.code(409).send({
          code: 'UNIQUE_CONFLICT',
          message: 'A record with these values already exists',
        });
      }
      if (error.code === 'P2003') {
        return reply.code(409).send({
          code: 'RELATION_CONFLICT',
          message: 'A related record prevents this operation',
        });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'Requested record was not found',
        });
      }
    }

    const httpError = error as Error & {
      statusCode?: number;
      code?: string;
    };
    if (
      typeof httpError.statusCode === 'number' &&
      httpError.statusCode >= 400 &&
      httpError.statusCode < 500
    ) {
      return reply.code(httpError.statusCode).send({
        code: httpError.code ?? 'BAD_REQUEST',
        message: httpError.message,
      });
    }

    request.log.error(
      { err: error, event: 'request_failure' },
      'Unhandled request failure',
    );
    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });
};
