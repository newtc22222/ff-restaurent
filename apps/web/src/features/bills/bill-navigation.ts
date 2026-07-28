export const BILLS_RETURN_STATE_KEY = 'billsReturnTo';

export type BillsDetailNavigationState = {
  [BILLS_RETURN_STATE_KEY]: string;
};

export const billsListPath = (pathname: string, search: string) =>
  `${pathname}${search}`;

export const billsDetailNavigationState = (
  pathname: string,
  search: string,
): BillsDetailNavigationState => ({
  [BILLS_RETURN_STATE_KEY]: billsListPath(pathname, search),
});

export const billsReturnPath = (state: unknown) => {
  if (!state || typeof state !== 'object') return '/bills';
  const returnTo = (state as Partial<BillsDetailNavigationState>)[
    BILLS_RETURN_STATE_KEY
  ];
  return typeof returnTo === 'string' &&
    (returnTo === '/bills' || returnTo.startsWith('/bills?'))
    ? returnTo
    : '/bills';
};
