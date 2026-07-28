export const HO_CHI_MINH_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Converts a PostgreSQL `date` value to its stable wire representation. */
export const formatIsoDateOnly = (date: Date) =>
  date.toISOString().slice(0, 10);

/** Parses an ISO date without applying the host machine's local timezone. */
export const parseIsoDateOnly = (value: string) => {
  if (!ISO_DATE_ONLY_PATTERN.test(value)) {
    throw new RangeError('Expected a date in YYYY-MM-DD format');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatIsoDateOnly(date) !== value) {
    throw new RangeError('Expected a valid calendar date');
  }
  return date;
};

/** Returns the calendar date at `date` in an explicit IANA timezone. */
export const formatDateOnlyInTimeZone = (
  date: Date,
  timeZone = HO_CHI_MINH_TIME_ZONE,
) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
};

export const todayInHoChiMinh = (now = new Date()) =>
  formatDateOnlyInTimeZone(now);
