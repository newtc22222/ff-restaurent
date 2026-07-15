import type { FastifyInstance, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { publicUserSelect } from '../roles.js';
import { participantGroupSchema } from '../schemas.js';

const groupInclude = {
  members: {
    orderBy: { user: { name: 'asc' as const } },
    include: { user: { select: publicUserSelect } },
  },
} satisfies Prisma.ParticipantGroupInclude;

const ensureMembersExist = async (memberIds: string[], reply: FastifyReply) => {
  const count = await prisma.user.count({ where: { id: { in: memberIds } } });
  if (count === memberIds.length) return true;
  reply.code(400).send({
    code: 'INVALID_PARTICIPANTS',
    message: 'One or more group members do not exist',
  });
  return false;
};

const ownerGroup = (id: string, ownerId: string) =>
  prisma.participantGroup.findFirst({ where: { id, ownerId } });

export const registerParticipantGroupRoutes = (app: FastifyInstance) => {
  app.get(
    '/participant-groups',
    { preHandler: requireAuthenticatedUser },
    async (request) =>
      prisma.participantGroup.findMany({
        where: { ownerId: request.currentUser.id },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: groupInclude,
      }),
  );

  app.post(
    '/participant-groups',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const body = participantGroupSchema.parse(request.body);
      if (!(await ensureMembersExist(body.memberIds, reply))) return;
      try {
        const group = await prisma.participantGroup.create({
          data: {
            name: body.name,
            ownerId: request.currentUser.id,
            members: {
              create: body.memberIds.map((userId) => ({ userId })),
            },
          },
          include: groupInclude,
        });
        return reply.code(201).send(group);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return reply.code(409).send({
            code: 'PARTICIPANT_GROUP_NAME_TAKEN',
            message: 'A participant group already uses this name',
          });
        }
        throw error;
      }
    },
  );

  app.put(
    '/participant-groups/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = participantGroupSchema.parse(request.body);
      if (!(await ownerGroup(id, request.currentUser.id))) {
        return reply.code(404).send({
          code: 'PARTICIPANT_GROUP_NOT_FOUND',
          message: 'Participant group was not found',
        });
      }
      if (!(await ensureMembersExist(body.memberIds, reply))) return;
      return prisma.$transaction(async (tx) => {
        await tx.participantGroupMember.deleteMany({ where: { groupId: id } });
        return tx.participantGroup.update({
          where: { id },
          data: {
            name: body.name,
            members: {
              create: body.memberIds.map((userId) => ({ userId })),
            },
          },
          include: groupInclude,
        });
      });
    },
  );

  app.delete(
    '/participant-groups/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await prisma.participantGroup.deleteMany({
        where: { id, ownerId: request.currentUser.id },
      });
      if (deleted.count === 0) {
        return reply.code(404).send({
          code: 'PARTICIPANT_GROUP_NOT_FOUND',
          message: 'Participant group was not found',
        });
      }
      return reply.code(204).send();
    },
  );
};
