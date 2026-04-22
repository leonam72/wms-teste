/**
 * Escapes HTML characters to prevent XSS.
 */
export const sanitize = (str: string): string => {
  return String(str).replace(/[<>]/g, '');
};

/**
 * Formats a date string to Brazilian locale.
 */
export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

/**
 * Formats a date string to Brazilian locale with time.
 */
export const formatDateTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + 
         ' ' + 
         d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Generates a unique key for a drawer (e.g., A1.G2).
 */
export const getDrawerKey = (shelfId: string, floor: number, drawer: number): string => {
  return `${shelfId}${floor}.G${drawer}`;
};
