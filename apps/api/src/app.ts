import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { ChefRole, EntryStatus, PaymentStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateBillSplit } from '@ff-restaurent/shared';
import { prisma } from './prisma.js';
import { isHeadChef, isSousChefOrAbove, sanitizeUser } from './roles.js';
import {
  billSchema,
  chefRoleSchema,
  loginSchema,
  profileUpdateSchema,
  registerSchema,
  restaurantSchema,
} from './schemas.js';

type JwtPayload = { sub: string };

const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user)
      return reply.code(401).send({ message: 'User no longer exists' });
    request.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      chefRole: user.chefRole,
    };
  } catch {
    return reply.code(401).send({ message: 'Authentication required' });
  }
};

const requireSousChef = (request: FastifyRequest, reply: FastifyReply) => {
  if (!isSousChefOrAbove(request.currentUser)) {
    return reply.code(403).send({ message: 'SOUS_CHEF or HEAD_CHEF required' });
  }
};

const requireHeadChef = (request: FastifyRequest, reply: FastifyReply) => {
  if (!isHeadChef(request.currentUser)) {
    return reply.code(403).send({ message: 'HEAD_CHEF required' });
  }
};

const billInclude = {
  restaurant: true,
  createdBy: true,
  participants: {
    include: { member: true },
    orderBy: { member: { name: 'asc' as const } },
  },
};

const canManageBill = (
  bill: { createdById: string },
  request: FastifyRequest,
) =>
  isHeadChef(request.currentUser) ||
  bill.createdById === request.currentUser.id;

const computeBillCreate = (body: unknown, createdById: string) => {
  const parsed = billSchema.parse(body);
  const split = calculateBillSplit(parsed);
  return {
    bill: {
      restaurantId: parsed.restaurantId,
      baseCost: parsed.baseCost,
      vat: parsed.vat,
      shippingFee: parsed.shippingFee,
      discounts: (parsed.discounts ?? []) as Prisma.InputJsonValue,
      vouchers: (parsed.vouchers ?? []) as Prisma.InputJsonValue,
      totalCost: split.totalCost,
      createdById,
    },
    participants: split.participants,
  };
};

const startDateForRange = (range: string | undefined) => {
  const date = new Date();
  if (range === 'weekly') date.setDate(date.getDate() - 7);
  else if (range === 'yearly') date.setFullYear(date.getFullYear() - 1);
  else date.setMonth(date.getMonth() - 1);
  return date;
};

const addToBucket = (
  bucket: Record<string, number>,
  key: string,
  amount: number,
) => {
  bucket[key] = (bucket[key] ?? 0) + amount;
};

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'FF RESTaurent API', version: '0.1.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  app.get('/health', async () => ({ ok: true }));

  // ── Auth ──────────────────────────────────────────────────

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: body.identifier }, { phone: body.identifier }],
      },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }
    return {
      token: app.jwt.sign({ sub: user.id }),
      user: sanitizeUser(user),
    };
  });

  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: body.username },
          ...(body.phone ? [{ phone: body.phone }] : []),
        ],
      },
    });
    if (existing) {
      return reply
        .code(409)
        .send({ message: 'Username or phone already taken' });
    }
    const user = await prisma.user.create({
      data: {
        name: body.name,
        username: body.username,
        phone: body.phone ?? null,
        passwordHash: await bcrypt.hash(body.password, 12),
      },
    });
    return reply.code(201).send({
      token: app.jwt.sign({ sub: user.id }),
      user: sanitizeUser(user),
    });
  });

  // ── Profile ───────────────────────────────────────────────

  app.get('/me', { preHandler: requireAuth }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.currentUser.id },
    });
    return sanitizeUser(user);
  });

  app.put(
    '/me/profile',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = profileUpdateSchema.parse(request.body);
      if (body.username) {
        const existing = await prisma.user.findFirst({
          where: {
            username: body.username,
            NOT: { id: request.currentUser.id },
          },
        });
        if (existing)
          return reply.code(409).send({ message: 'Username already taken' });
      }
      const updated = await prisma.user.update({
        where: { id: request.currentUser.id },
        data: body,
      });
      return sanitizeUser(updated);
    },
  );

  // ── Members ───────────────────────────────────────────────

  app.get('/members', { preHandler: requireAuth }, async () => {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(sanitizeUser);
  });

  app.get('/users', { preHandler: requireAuth }, async (request, reply) => {
    requireHeadChef(request, reply);
    if (reply.sent) return;
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(sanitizeUser);
  });

  app.patch(
    '/users/:id/chef-role',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireHeadChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const body = chefRoleSchema.parse(request.body);
      const existing = await prisma.user.findUniqueOrThrow({ where: { id } });
      const updated = await prisma.user.update({
        where: { id },
        data: { chefRole: body.chefRole as ChefRole | null },
      });
      await prisma.roleAuditLog.create({
        data: {
          userId: id,
          changedById: request.currentUser.id,
          fromRole: existing.chefRole,
          toRole: updated.chefRole,
        },
      });
      return sanitizeUser(updated);
    },
  );

  // ── Restaurants ───────────────────────────────────────────

  app.get('/restaurants', { preHandler: requireAuth }, async (request) => {
    const query = request.query as {
      includeArchived?: string;
      search?: string;
      sortBy?: string;
      filterCuisine?: string;
      filterFavorite?: string;
      filterRecommended?: string;
    };
    const includeArchived =
      query.includeArchived === 'true' && isHeadChef(request.currentUser);
    const where: Prisma.RestaurantEntryWhereInput = {
      status: includeArchived ? undefined : EntryStatus.ACTIVE,
      name: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
      cuisineType: query.filterCuisine
        ? { contains: query.filterCuisine, mode: 'insensitive' }
        : undefined,
      isRecommended: query.filterRecommended === 'true' ? true : undefined,
    };
    if (query.filterFavorite === 'true') {
      where.favorites = { some: { userId: request.currentUser.id } };
    }
    const orderBy: Prisma.RestaurantEntryOrderByWithRelationInput[] =
      query.sortBy === 'name'
        ? [{ name: 'asc' }]
        : [{ isFavorite: 'desc' }, { isRecommended: 'desc' }, { name: 'asc' }];

    const restaurants = await prisma.restaurantEntry.findMany({
      where,
      orderBy,
      include: {
        favorites: {
          where: { userId: request.currentUser.id },
          select: { userId: true },
        },
      },
    });
    return restaurants.map((r) => ({
      ...r,
      isFavoritedByMe: r.favorites.length > 0,
      favorites: undefined,
    }));
  });

  app.post(
    '/restaurants',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireSousChef(request, reply);
      if (reply.sent) return;
      const body = restaurantSchema.parse(request.body);
      return reply.code(201).send(
        await prisma.restaurantEntry.create({
          data: {
            ...body,
            links: body.links ?? [],
            createdById: request.currentUser.id,
          },
        }),
      );
    },
  );

  app.put(
    '/restaurants/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireSousChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const body = restaurantSchema.partial().parse(request.body);
      return prisma.restaurantEntry.update({
        where: { id },
        data: { ...body, links: body.links ?? undefined },
      });
    },
  );

  app.patch(
    '/restaurants/:id/archive',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireHeadChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      return prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ARCHIVED },
      });
    },
  );

  app.patch(
    '/restaurants/:id/restore',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireHeadChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      return prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ACTIVE },
      });
    },
  );

  app.post(
    '/restaurants/:id/favorite',
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.userFavorite.findUnique({
        where: {
          userId_restaurantId: {
            userId: request.currentUser.id,
            restaurantId: id,
          },
        },
      });
      if (existing) {
        await prisma.userFavorite.delete({
          where: {
            userId_restaurantId: {
              userId: request.currentUser.id,
              restaurantId: id,
            },
          },
        });
        return { favorited: false };
      }
      await prisma.userFavorite.create({
        data: { userId: request.currentUser.id, restaurantId: id },
      });
      return { favorited: true };
    },
  );

  app.patch(
    '/restaurants/:id/recommend',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireSousChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const entry = await prisma.restaurantEntry.findUniqueOrThrow({
        where: { id },
      });
      return prisma.restaurantEntry.update({
        where: { id },
        data: { isRecommended: !entry.isRecommended },
      });
    },
  );

  // ── Bills ─────────────────────────────────────────────────

  app.get('/bills', { preHandler: requireAuth }, async (request) => {
    const query = request.query as { includeArchived?: string };
    const includeArchived =
      query.includeArchived === 'true' && isHeadChef(request.currentUser);
    const statusFilter = includeArchived ? undefined : EntryStatus.ACTIVE;
    const where = isHeadChef(request.currentUser)
      ? { status: statusFilter }
      : isSousChefOrAbove(request.currentUser)
        ? {
            status: statusFilter,
            OR: [
              { createdById: request.currentUser.id },
              { participants: { some: { memberId: request.currentUser.id } } },
            ],
          }
        : {
            status: statusFilter,
            participants: { some: { memberId: request.currentUser.id } },
          };
    return prisma.bill.findMany({
      where,
      include: billInclude,
      orderBy: { createdAt: 'desc' },
    });
  });

  app.get('/bills/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: billInclude,
    });
    if (!bill) return reply.code(404).send({ message: 'Bill not found' });
    const allowed =
      isHeadChef(request.currentUser) ||
      bill.createdById === request.currentUser.id ||
      bill.participants.some(
        (participant) => participant.memberId === request.currentUser.id,
      );
    if (!allowed)
      return reply.code(403).send({ message: 'Not allowed to view this bill' });
    return bill;
  });

  app.post('/bills', { preHandler: requireAuth }, async (request, reply) => {
    requireSousChef(request, reply);
    if (reply.sent) return;
    const computed = computeBillCreate(request.body, request.currentUser.id);
    const participantIds = computed.participants.map(
      (participant) => participant.memberId,
    );
    const users = await prisma.user.count({
      where: { id: { in: participantIds } },
    });
    if (users !== participantIds.length)
      return reply
        .code(400)
        .send({ message: 'One or more participants do not exist' });
    const bill = await prisma.bill.create({
      data: {
        ...computed.bill,
        participants: {
          create: computed.participants.map((participant) => ({
            memberId: participant.memberId,
            originCost: participant.originCost,
            allocatedVat: participant.allocatedVat,
            allocatedShipping: participant.allocatedShipping,
            discountApplied: participant.discountApplied,
            finalPrice: participant.finalPrice,
          })),
        },
      },
      include: billInclude,
    });
    return reply.code(201).send(bill);
  });

  app.put('/bills/:id', { preHandler: requireAuth }, async (request, reply) => {
    requireSousChef(request, reply);
    if (reply.sent) return;
    const { id } = request.params as { id: string };
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ message: 'Bill not found' });
    if (!canManageBill(existing, request))
      return reply
        .code(403)
        .send({ message: 'Only the owner or HEAD_CHEF can edit this bill' });
    const computed = computeBillCreate(request.body, existing.createdById);
    const bill = await prisma.$transaction(async (tx) => {
      await tx.billParticipant.deleteMany({ where: { billId: id } });
      const updated = await tx.bill.update({
        where: { id },
        data: {
          ...computed.bill,
          createdById: existing.createdById,
          participants: {
            create: computed.participants.map((participant) => ({
              memberId: participant.memberId,
              originCost: participant.originCost,
              allocatedVat: participant.allocatedVat,
              allocatedShipping: participant.allocatedShipping,
              discountApplied: participant.discountApplied,
              finalPrice: participant.finalPrice,
            })),
          },
        },
        include: billInclude,
      });
      await tx.billAuditLog.create({
        data: {
          billId: id,
          userId: request.currentUser.id,
          action: 'UPDATED',
          before: existing as unknown as Prisma.InputJsonValue,
          after: computed.bill as unknown as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
    return bill;
  });

  app.patch(
    '/bills/:id/archive',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireHeadChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canManageBill(bill, request))
        return reply.code(403).send({
          message: 'Only the owner or HEAD_CHEF can archive this bill',
        });
      return prisma.bill.update({
        where: { id },
        data: { status: EntryStatus.ARCHIVED },
        include: billInclude,
      });
    },
  );

  app.patch(
    '/bills/:id/restore',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireHeadChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      return prisma.bill.update({
        where: { id },
        data: { status: EntryStatus.ACTIVE },
        include: billInclude,
      });
    },
  );

  app.patch(
    '/bills/:id/participants/:memberId/pay',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id, memberId } = request.params as {
        id: string;
        memberId: string;
      };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      const allowed =
        request.currentUser.id === memberId || canManageBill(bill, request);
      if (!allowed)
        return reply
          .code(403)
          .send({ message: 'Not allowed to update this payment' });
      return prisma.billParticipant.update({
        where: { billId_memberId: { billId: id, memberId } },
        data: { paymentStatus: PaymentStatus.PAID, paidAt: new Date() },
        include: { member: true, bill: true },
      });
    },
  );

  app.post(
    '/bills/:id/reminders',
    { preHandler: requireAuth },
    async (request, reply) => {
      requireSousChef(request, reply);
      if (reply.sent) return;
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: billInclude,
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canManageBill(bill, request))
        return reply.code(403).send({
          message: 'Only the owner or HEAD_CHEF can remind participants',
        });
      const waiting = bill.participants.filter(
        (participant) => participant.paymentStatus === PaymentStatus.WAITING,
      );
      await prisma.notification.createMany({
        data: waiting.map((participant) => ({
          userId: participant.memberId,
          billId: bill.id,
          message: `Payment reminder for ${bill.restaurant.name}: ${participant.finalPrice} VND waiting.`,
        })),
      });
      return { sent: waiting.length };
    },
  );

  // ── Notifications ─────────────────────────────────────────

  app.get('/notifications', { preHandler: requireAuth }, async (request) => {
    return prisma.notification.findMany({
      where: { userId: request.currentUser.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  app.patch(
    '/notifications/:id/read',
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params as { id: string };
      return prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    },
  );

  // ── Stats ─────────────────────────────────────────────────

  app.get('/stats/me', { preHandler: requireAuth }, async (request) => {
    const query = request.query as { range?: string };
    const participants = await prisma.billParticipant.findMany({
      where: {
        memberId: request.currentUser.id,
        bill: {
          createdAt: { gte: startDateForRange(query.range) },
          status: EntryStatus.ACTIVE,
        },
      },
      include: { bill: { include: { restaurant: true } } },
    });

    const byPaymentStatus: Record<string, number> = {};
    const byCuisineType: Record<string, number> = {};
    const byEntry: Record<string, number> = {};
    const byPeriod: Record<string, number> = {};
    const frequencyByRestaurant: Record<string, number> = {};
    const frequencyByCuisine: Record<string, number> = {};

    for (const participant of participants) {
      addToBucket(
        byPaymentStatus,
        participant.paymentStatus,
        participant.finalPrice,
      );
      addToBucket(
        byCuisineType,
        participant.bill.restaurant.cuisineType,
        participant.finalPrice,
      );
      addToBucket(
        byEntry,
        `${participant.bill.restaurant.type}: ${participant.bill.restaurant.name}`,
        participant.finalPrice,
      );
      addToBucket(
        byPeriod,
        participant.bill.createdAt.toISOString().slice(0, 7),
        participant.finalPrice,
      );
      frequencyByRestaurant[participant.bill.restaurant.name] =
        (frequencyByRestaurant[participant.bill.restaurant.name] ?? 0) + 1;
      frequencyByCuisine[participant.bill.restaurant.cuisineType] =
        (frequencyByCuisine[participant.bill.restaurant.cuisineType] ?? 0) + 1;
    }

    return {
      total: participants.reduce(
        (sum, participant) => sum + participant.finalPrice,
        0,
      ),
      byPaymentStatus,
      byCuisineType,
      byEntry,
      byPeriod,
      frequencyByRestaurant,
      frequencyByCuisine,
    };
  });

  return app;
};
