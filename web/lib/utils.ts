import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** One decimal, trailing .0 dropped (2.0 → "2", 2.1 → "2.1"). Shared by the
 *  catalog + stat view-models so a graph size and a build-cost round the same way. */
export function round1(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}
