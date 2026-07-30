import { parseVietnamMobilePhone } from '@ff-restaurent/shared';

export type PhoneRecord = { id: string; phone: string };

const maskPhone = (phone: string) => {
  const value = phone.trim();
  if (value.length <= 5) return '***';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
};

export const planUserPhoneBackfill = (records: PhoneRecord[]) => {
  const invalid: Array<{ id: string; maskedPhone: string }> = [];
  const normalized = new Map<string, PhoneRecord[]>();

  for (const record of records) {
    const parsed = parseVietnamMobilePhone(record.phone);
    if (!parsed.success || !parsed.phone) {
      invalid.push({ id: record.id, maskedPhone: maskPhone(record.phone) });
      continue;
    }
    normalized.set(parsed.phone, [
      ...(normalized.get(parsed.phone) ?? []),
      record,
    ]);
  }

  const collisions = [...normalized.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([phone, matches]) => ({
      maskedPhone: maskPhone(phone),
      userIds: matches.map((match) => match.id).sort(),
    }));

  const collidedIds = new Set(
    collisions.flatMap((collision) => collision.userIds),
  );
  const updates = [...normalized.entries()].flatMap(([phone, matches]) =>
    matches
      .filter((match) => !collidedIds.has(match.id) && match.phone !== phone)
      .map((match) => ({ id: match.id, phone })),
  );

  return { invalid, collisions, updates };
};
