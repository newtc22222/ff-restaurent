import type { Prisma, PrismaClient } from '@prisma/client';
import { normalizeCatalogKey } from './catalog-normalization.js';

export const POPULAR_VIETNAM_CUISINE_SOURCE = 'https://vietnam.travel/node/195';

const popularCuisineDefinitions = [
  {
    name: 'Phở',
    type: 'Món nước',
    description: 'Phở truyền thống với bánh phở và nước dùng thơm gia vị.',
  },
  {
    name: 'Bánh mì',
    type: 'Bánh mì',
    description: 'Bánh mì Việt Nam với nhân mặn, rau thơm và đồ chua.',
  },
  {
    name: 'Cơm tấm',
    type: 'Món cơm',
    description: 'Cơm tấm thường dùng cùng sườn nướng, trứng và nước mắm.',
  },
  {
    name: 'Bún bò Huế',
    type: 'Món nước',
    description: 'Món bún Huế với nước dùng đậm vị sả và ớt.',
  },
  {
    name: 'Cao lầu',
    type: 'Món mì',
    description: 'Món mì đặc trưng Hội An với thịt, rau thơm và tóp giòn.',
  },
  {
    name: 'Cơm gà',
    type: 'Món cơm',
    description: 'Cơm gà với cơm vàng, thịt gà và rau thơm.',
  },
  {
    name: 'Mì Quảng',
    type: 'Món mì',
    description: 'Mì Quảng dùng ít nước, ăn cùng rau, đậu phộng và bánh tráng.',
  },
  {
    name: 'Bánh xèo',
    type: 'Bánh mặn',
    description: 'Bánh xèo giòn với nhân thịt, tôm và giá.',
  },
  {
    name: 'Bún chả',
    type: 'Món bún',
    description: 'Bún chả Hà Nội với thịt nướng, rau sống và nước chấm.',
  },
  {
    name: 'Xôi',
    type: 'Món xôi',
    description: 'Xôi Việt Nam gồm nhiều biến thể mặn và ngọt.',
  },
  {
    name: 'Bánh bèo',
    type: 'Bánh Việt',
    description: 'Bánh bèo hấp ăn cùng tôm, hành và nước chấm.',
  },
  {
    name: 'Bún riêu',
    type: 'Món nước',
    description: 'Bún riêu với nước dùng cà chua, riêu cua và đậu hũ.',
  },
  {
    name: 'Gỏi cuốn',
    type: 'Món cuốn',
    description: 'Gỏi cuốn tươi với rau, bún và nhân thịt hoặc tôm.',
  },
  {
    name: 'Bánh căn',
    type: 'Bánh mặn',
    description: 'Bánh căn nướng khuôn nhỏ, thường ăn cùng nước chấm.',
  },
  {
    name: 'Hủ tiếu Nam Vang',
    type: 'Món nước',
    description: 'Hủ tiếu Nam Vang có thể dùng dạng nước hoặc khô.',
  },
  {
    name: 'Chả cá',
    type: 'Hải sản',
    description: 'Chả cá áp chảo dùng cùng rau thơm và bún.',
  },
  {
    name: 'Nộm hoa chuối',
    type: 'Gỏi và nộm',
    description: 'Nộm hoa chuối trộn rau thơm, đậu phộng và nước chua ngọt.',
  },
  {
    name: 'Bánh cuốn',
    type: 'Món cuốn',
    description: 'Bánh cuốn hấp mỏng với nhân thịt và nấm mèo.',
  },
  {
    name: 'Bún chả cá',
    type: 'Món nước',
    description: 'Bún chả cá với chả cá, rau thơm và nước dùng thanh.',
  },
  {
    name: 'Bò lá lốt',
    type: 'Món nướng',
    description: 'Thịt bò cuốn lá lốt và nướng trên than.',
  },
  {
    name: 'Chè',
    type: 'Tráng miệng',
    description: 'Món tráng miệng ngọt với nhiều loại đậu, trái cây và thạch.',
  },
] as const;

export const popularVietnamCuisines: Prisma.CuisineCreateManyInput[] =
  popularCuisineDefinitions.map((cuisine) => ({
    ...cuisine,
    nameKey: normalizeCatalogKey(cuisine.name),
  }));

export type PopularCuisineSeedClient = {
  cuisine: Pick<PrismaClient['cuisine'], 'createMany'>;
};

export const seedPopularVietnamCuisines = async (
  client: PopularCuisineSeedClient,
) => {
  const result = await client.cuisine.createMany({
    data: popularVietnamCuisines,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    skipped: popularVietnamCuisines.length - result.count,
    total: popularVietnamCuisines.length,
  };
};
