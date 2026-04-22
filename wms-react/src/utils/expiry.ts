/**
 * Utilities for handling product expiry dates and statuses.
 */

export type ExpiryStatus = 'ok' | 'warn' | 'expired' | 'none';

/**
 * Returns the status based on the number of days until expiry.
 */
export const getExpiryStatus = (expiryDateStr: string): ExpiryStatus => {
  if (!expiryDateStr) return 'none';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);
  
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'warn';
  return 'ok';
};

/**
 * Gets the most critical status from a list of expiry dates.
 */
export const getProductExpiryStatus = (expiries: string[]): ExpiryStatus => {
  if (!expiries || expiries.length === 0) return 'none';
  
  let currentStatus: ExpiryStatus = 'ok';
  
  for (const date of expiries) {
    const status = getExpiryStatus(date);
    if (status === 'expired') return 'expired'; // Priority 1
    if (status === 'warn') currentStatus = 'warn'; // Priority 2
  }
  
  return currentStatus;
};

/**
 * Calculates days remaining until a date.
 */
export const daysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Finds the nearest expiry date in a list.
 */
export const getNearestExpiry = (expiries: string[]): string | null => {
  if (!expiries || expiries.length === 0) return null;
  return [...expiries].sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
};
