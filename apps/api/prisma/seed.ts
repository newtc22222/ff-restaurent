import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { ChefRole, PrismaClient, SystemRole } from '@prisma/client';
import { AdjustmentType, calculateBillSplit } from '@ff-restaurent/shared';

const prisma = new PrismaClient();

export const disconnectSeedPrisma = () => prisma.$disconnect();

const createBill = async (input: {
  restaurantId: string;
  createdById: string;
  baseCost: number;
  vat: number;
  shippingFee: number;
  discounts?: { type: AdjustmentType; value: number; label?: string }[];
  vouchers?: { code: string; value: number }[];
  participantIds: string[];
}) => {
  const split = calculateBillSplit({
    baseCost: input.baseCost,
    vat: input.vat,
    shippingFee: input.shippingFee,
    discounts: input.discounts,
    vouchers: input.vouchers,
    participants: input.participantIds.map((memberId) => ({ memberId })),
  });

  return prisma.bill.create({
    data: {
      restaurantId: input.restaurantId,
      createdById: input.createdById,
      baseCost: input.baseCost,
      vat: input.vat,
      shippingFee: input.shippingFee,
      discounts: input.discounts ?? [],
      vouchers: input.vouchers ?? [],
      totalCost: split.totalCost,
      participants: {
        create: split.participants.map((participant, index) => ({
          memberId: participant.memberId,
          originCost: participant.originCost,
          allocatedVat: participant.allocatedVat,
          allocatedShipping: participant.allocatedShipping,
          discountApplied: participant.discountApplied,
          finalPrice: participant.finalPrice,
          paymentStatus: index === 0 ? 'PAID' : 'WAITING',
          paidAt: index === 0 ? new Date() : null,
        })),
      },
    },
  });
};

export async function seed({ reset = true }: { reset?: boolean } = {}) {
  if (reset) {
    await prisma.passwordResetRequest.deleteMany();
    await prisma.userFavorite.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.billAuditLog.deleteMany();
    await prisma.rootAdminTransferAudit.deleteMany();
    await prisma.roleAuditLog.deleteMany();
    await prisma.billParticipant.deleteMany();
    await prisma.bill.deleteMany();
    await prisma.restaurantEntry.deleteMany();
    await prisma.user.deleteMany();
  }

  const passwordHash = await bcrypt.hash('password123', 12);
  const [customer, sousChef, headChef] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Casey Customer',
        username: 'customer',
        phone: '+84901000001',
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Sam Sous Chef',
        username: 'sous',
        phone: '+84901000002',
        passwordHash,
        chefRole: ChefRole.SOUS_CHEF,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Hana Head Chef',
        username: 'head',
        phone: '+84901000003',
        passwordHash,
        chefRole: ChefRole.HEAD_CHEF,
        systemRole: SystemRole.ROOT_ADMIN,
      },
    }),
  ]);

  const [pho, sushi, bakery] = await Promise.all([
    prisma.restaurantEntry.create({
      data: {
        name: 'Phở Thứ Sáu',
        address: '12 Đường Phở',
        cuisineType: 'Phở',
        type: 'Nhà hàng',
        isFavorite: true,
        isRecommended: true,
        createdById: sousChef.id,
      },
    }),
    prisma.restaurantEntry.create({
      data: {
        name: 'Sushi Nhanh',
        address: '88 Đường Giao Hàng',
        cuisineType: 'Nhật Bản',
        type: 'Quán ăn',
        isRecommended: true,
        createdById: headChef.id,
      },
    }),
    prisma.restaurantEntry.create({
      data: {
        name: 'Bánh & Bill',
        address: '4 Đường Buổi Sáng',
        cuisineType: 'Tiệm bánh',
        type: 'Tiệm bánh',
        createdById: sousChef.id,
      },
    }),
  ]);

  await createBill({
    restaurantId: pho.id,
    createdById: sousChef.id,
    baseCost: 360000,
    vat: 30000,
    shippingFee: 20000,
    discounts: [
      {
        type: AdjustmentType.PERCENTAGE,
        value: 10,
        label: 'Khuyến mãi bữa trưa',
      },
    ],
    vouchers: [{ code: 'FRIDAY', value: 15000 }],
    participantIds: [customer.id, sousChef.id, headChef.id],
  });

  await createBill({
    restaurantId: sushi.id,
    createdById: headChef.id,
    baseCost: 520000,
    vat: 50000,
    shippingFee: 0,
    vouchers: [{ code: 'ROLLS', value: 30000 }],
    participantIds: [customer.id, headChef.id],
  });

  await createBill({
    restaurantId: bakery.id,
    createdById: sousChef.id,
    baseCost: 180000,
    vat: 9000,
    shippingFee: 10000,
    participantIds: [customer.id, sousChef.id],
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
