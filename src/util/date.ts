import type { TimeRange } from "../types/time.ts";

export const getMidnightDate = (): string => {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return midnight.toISOString();
};

export const getLastWeeks = (amount: number): TimeRange[] => {
  const lastWeeks = [];

  const now = new Date();
  const currentWeekStartDate = new Date();
  currentWeekStartDate.setDate(now.getDate() - (now.getDay() - 1) - 7);
  currentWeekStartDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < amount; i++) {
    const from = new Date();
    from.setMonth(currentWeekStartDate.getMonth());
    from.setDate(currentWeekStartDate.getDate() - 7 * i);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setMonth(from.getMonth());
    to.setDate(from.getDate() + 4);
    to.setHours(23, 0, 0, 0);
    const week: TimeRange = {
      from,
      to,
    };
    lastWeeks.push(week);
  }
  return lastWeeks;
};

export const getCurrentWeek = (): TimeRange => {
  const from = new Date();
  from.setDate(from.getDate() + (from.getDay() === 0 ? -6 : 1) - from.getDay());
  from.setHours(from.getHours() + 1);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  return {
    from,
    to,
  };
};

export const getTodaysDate = (): TimeRange => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  return {
    from,
    to,
  };
};

export const formatDate = (date: Date): string => {
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
};

export const formatDateRange = (
  dateStart: Date,
  dateEnd: Date,
  noNewline?: boolean,
): string => {
  return `Woche von${noNewline ? " " : "\n"}${formatDate(dateStart)}${
    noNewline ? " " : "\n"
  }bis${noNewline ? " " : "\n"}${formatDate(dateEnd)}`;
};
