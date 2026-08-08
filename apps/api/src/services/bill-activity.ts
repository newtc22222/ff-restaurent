import { Prisma } from '@prisma/client';

/**
 * Bill activity timeline construction.
 *
 * This module is deliberately free of Prisma calls: it takes an already-loaded
 * bill and turns its audit log into the client-facing timeline. That keeps the
 * diffing rules unit-testable without a database.
 */

export const billActivityActorSelect = {
  id: true,
  username: true,
  name: true,
} satisfies Prisma.UserSelect;

export type BillActivityActor = Prisma.UserGetPayload<{
  select: typeof billActivityActorSelect;
}>;

export type BillActivityDetails = {
  changes?: string[];
  memberId?: string;
  memberName?: string;
  fromStatus?: string;
  toStatus?: string;
  memberNames?: string[];
  amountCents?: number;
  sent?: number;
  skipped?: number;
};

export type BillActivitySource = {
  id: string;
  createdAt: Date;
  createdBy: BillActivityActor;
  participants: Array<{ memberId: string; member: BillActivityActor }>;
  auditLogs: Array<{
    id: string;
    action: string;
    before: Prisma.JsonValue | null;
    after: Prisma.JsonValue | null;
    createdAt: Date;
    user: BillActivityActor;
  }>;
};

const isJsonObject = (
  value: Prisma.JsonValue | null,
): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const valueChanged = (before: unknown, after: unknown) =>
  JSON.stringify(before) !== JSON.stringify(after);

/**
 * Collapses a raw before/after audit payload into the coarse change
 * categories the client renders, so a single edit touching several columns
 * reads as one meaningful change rather than a field-by-field dump.
 */
const updatedFields = (
  before: Prisma.JsonValue | null,
  after: Prisma.JsonValue | null,
) => {
  if (!isJsonObject(before) || !isJsonObject(after)) return [];
  const changes = new Set<string>();
  if (valueChanged(before.occurredOn, after.occurredOn)) changes.add('date');
  if (valueChanged(before.restaurantId, after.restaurantId))
    changes.add('restaurant');
  if (
    ['baseCost', 'vat', 'shippingFee', 'totalCost'].some((field) =>
      valueChanged(before[field], after[field]),
    )
  )
    changes.add('costs');
  if (
    valueChanged(before.discounts, after.discounts) ||
    valueChanged(before.vouchers, after.vouchers) ||
    valueChanged(before.adjustmentAllocation, after.adjustmentAllocation)
  )
    changes.add('adjustments');
  if (
    valueChanged(before.paymentUrl, after.paymentUrl) ||
    valueChanged(before.paymentQrImageId, after.paymentQrImageId)
  )
    changes.add('paymentLink');
  if (valueChanged(before.participants, after.participants))
    changes.add('participants');
  return [...changes];
};

const activityDetails = (
  log: BillActivitySource['auditLogs'][number],
  participantNames: Map<string, string>,
): BillActivityDetails | undefined => {
  if (log.action === 'UPDATED') {
    return { changes: updatedFields(log.before, log.after) };
  }
  if (log.action === 'PAYMENT_STATUS_CHANGED' && isJsonObject(log.after)) {
    const before = isJsonObject(log.before) ? log.before : {};
    const memberId =
      typeof log.after.memberId === 'string' ? log.after.memberId : undefined;
    return {
      memberId,
      memberName: memberId ? participantNames.get(memberId) : undefined,
      fromStatus:
        typeof before.paymentStatus === 'string'
          ? before.paymentStatus
          : undefined,
      toStatus:
        typeof log.after.paymentStatus === 'string'
          ? log.after.paymentStatus
          : undefined,
    };
  }
  if (log.action === 'REMINDERS_SENT' && isJsonObject(log.after)) {
    return {
      sent: typeof log.after.sent === 'number' ? log.after.sent : 0,
      skipped: typeof log.after.skipped === 'number' ? log.after.skipped : 0,
    };
  }
  if (log.action === 'SPONSORSHIP_CREATED' && isJsonObject(log.after)) {
    const memberIds = Array.isArray(log.after.memberIds)
      ? log.after.memberIds.filter(
          (memberId): memberId is string => typeof memberId === 'string',
        )
      : [];
    return {
      memberNames: memberIds.map(
        (memberId) => participantNames.get(memberId) ?? memberId,
      ),
      amountCents:
        typeof log.after.amountCents === 'number'
          ? log.after.amountCents
          : undefined,
    };
  }
  return undefined;
};

const visibleActivityActions = new Set([
  'UPDATED',
  'PAYMENT_STATUS_CHANGED',
  'SPONSORSHIP_CREATED',
  'REMINDERS_SENT',
  'ARCHIVED',
  'RESTORED',
]);

/**
 * Builds the newest-first activity feed for a bill. The synthetic CREATED
 * event is appended rather than stored, because bill creation is implied by
 * the row itself and has no audit log entry.
 */
export const buildBillActivityTimeline = (bill: BillActivitySource) => {
  const participantNames = new Map(
    bill.participants.map((participant) => [
      participant.memberId,
      participant.member.name,
    ]),
  );
  const events = bill.auditLogs
    .filter((log) => visibleActivityActions.has(log.action))
    .map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.user,
      details: activityDetails(log, participantNames),
      createdAt: log.createdAt,
    }));
  events.push({
    id: `created-${bill.id}`,
    action: 'CREATED',
    actor: bill.createdBy,
    details: undefined,
    createdAt: bill.createdAt,
  });
  return events.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
};
