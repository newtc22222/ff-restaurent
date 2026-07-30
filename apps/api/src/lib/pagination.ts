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

export const cursorPageResult = <T extends { id: string }>(
  rows: T[],
  limit: number,
  backward: boolean,
  cursor?: string,
) => {
  const orderedRows = backward ? [...rows].reverse() : rows;
  const hasExtra = orderedRows.length > limit;
  const items = backward
    ? hasExtra
      ? orderedRows.slice(1)
      : orderedRows
    : orderedRows.slice(0, limit);
  return {
    items,
    pageInfo: {
      startCursor: items.at(0)?.id ?? null,
      endCursor: items.at(-1)?.id ?? null,
      hasPreviousPage: backward ? hasExtra : Boolean(cursor),
      hasNextPage: backward ? Boolean(cursor) : hasExtra,
    },
  };
};
