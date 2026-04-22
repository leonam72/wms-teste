import type { Product } from '../types';

/**
 * Converts the inventory structure to a CSV string.
 */
export const exportInventoryToCSV = (productsAll: Record<string, Product[]>): string => {
  const header = 'SKU;NOME;QTD;UN;KG;LOCAL;VENCIMENTO\n';
  const rows: string[] = [];

  Object.entries(productsAll).forEach(([location, products]) => {
    products.forEach(p => {
      const row = [
        p.code,
        p.name,
        p.qty,
        p.unit,
        p.kg,
        location,
        p.expiries.join(',')
      ].join(';');
      rows.push(row);
    });
  });

  return header + rows.join('\n');
};

/**
 * Parses a CSV string and returns a map of products by location.
 * Expected format: SKU;NOME;QTD;UN;KG;LOCAL;VENCIMENTO
 */
export const parseInventoryCSV = (csv: string): Record<string, Product[]> => {
  const lines = csv.split('\n');
  const result: Record<string, Product[]> = {};

  // Pula o cabeçalho
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [code, name, qty, unit, kg, local, expiriesStr] = line.split(';');
    
    if (!local) continue;

    const product: Product = {
      code,
      name,
      qty: parseFloat(qty) || 0,
      unit: unit as any,
      kg: parseFloat(kg) || 0,
      entry: new Date().toISOString().split('T')[0],
      expiries: expiriesStr ? expiriesStr.split(',') : []
    };

    if (!result[local]) result[local] = [];
    result[local].push(product);
  }

  return result;
};
