import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind CSS class birleştirici — clsx + twMerge */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Debounce — son çağrıdan N ms sonra tetikler */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Async sleep */
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Null-safe deep clone (structuredClone wrapper) */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Tarih formatla — Türkçe locale */
const trDateFmt = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(date: Date | string | number): string {
  return trDateFmt.format(typeof date === 'string' || typeof date === 'number' ? new Date(date) : date);
}

/** Dizi gruplama — Object.groupBy wrapper (ES2024) */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return Object.groupBy(items, keyFn) as Record<string, T[]>;
}
