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

const validBillsReturnPath = (returnTo: unknown): returnTo is string =>
  typeof returnTo === 'string' &&
  (returnTo === '/bills' || returnTo.startsWith('/bills?'));

export const billsReturnPath = (
  state: unknown,
  queryReturnTo?: string | null,
) => {
  const stateReturnTo =
    state && typeof state === 'object'
      ? (state as Partial<BillsDetailNavigationState>)[BILLS_RETURN_STATE_KEY]
      : undefined;
  if (validBillsReturnPath(stateReturnTo)) return stateReturnTo;
  return validBillsReturnPath(queryReturnTo) ? queryReturnTo : '/bills';
};

export const billEditPath = (billId: string, state: unknown) =>
  `/bills/${billId}/edit?returnTo=${encodeURIComponent(billsReturnPath(state))}`;

export const billDetailPath = (billId: string, returnTo: unknown) =>
  `/bills/${billId}?returnTo=${encodeURIComponent(
    validBillsReturnPath(returnTo) ? returnTo : '/bills',
  )}`;
