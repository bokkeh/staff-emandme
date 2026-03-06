import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, differenceInMinutes, startOfWeek, endOfWeek } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursDecimal(minutes: number): string {
  return (minutes / 60).toFixed(2) + "h";
}

export function calcDurationMinutes(start: Date, end: Date): number {
  return Math.max(0, differenceInMinutes(end, start));
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatTime(date: Date | string): string {
  return format(new Date(date), "h:mm a");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function getWeekRange(date: Date = new Date()) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getUpcomingBirthdays(
  employees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    birthMonth: number | null;
    birthDay: number | null;
    profilePhotoUrl: string | null;
  }>,
  days = 30
) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  return employees
    .filter((e) => e.birthMonth && e.birthDay)
    .map((e) => {
      const bMonth = e.birthMonth!;
      const bDay = e.birthDay!;

      let bdayThisYear = new Date(today.getFullYear(), bMonth - 1, bDay);
      if (bMonth < todayMonth || (bMonth === todayMonth && bDay < todayDay)) {
        bdayThisYear = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
      }

      const daysUntil = Math.round(
        (bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        ...e,
        daysUntil,
        isToday: bMonth === todayMonth && bDay === todayDay,
        birthMonth: bMonth,
        birthDay: bDay,
      };
    })
    .filter((e) => e.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function displayName(employee: {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
}): string {
  return employee.preferredName
    ? `${employee.preferredName} ${employee.lastName}`
    : `${employee.firstName} ${employee.lastName}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
