export const pageResult = <T extends { id: string }>(
  rows: T[],
  limit: number,
) => {
  const hasNextPage = rows.length > limit;
  const items = rows.slice(0, limit);
  return {
    items,
    pageInfo: {
      endCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      hasNextPage,
    },
  };
};
