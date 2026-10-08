import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names and lets a later utility beat an earlier one of the same
 * kind, so a component's default (`px-4`) can be overridden by a caller's
 * `px-2` instead of both landing in the class list and CSS order deciding.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
