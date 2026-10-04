import type { RecordData } from './crm-data';

export type ScheduleNotification = {
  id: number;
  clientName: string;
  company: string;
};

const IST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function istDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    IST_DATE_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTodayScheduleNotifications(
  leads: RecordData[],
  now = new Date(),
): ScheduleNotification[] {
  const today = istDateKey(now);

  return leads
    .filter((lead) => String(lead.follow_up_date ?? '').slice(0, 10) === today)
    .map((lead) => ({
      id: lead.id,
      clientName: String(lead.name ?? '').trim() || 'Unnamed client',
      company: String(lead.company ?? '').trim(),
    }));
}