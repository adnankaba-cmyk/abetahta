import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind CSS class birleştirici — clsx + twMerge */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
