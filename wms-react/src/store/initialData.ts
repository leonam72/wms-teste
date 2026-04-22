import { Product } from '../types';

export const initialProducts: Record<string, Record<string, Product[]>> = {
  dep1: {
    'A1.G1': [
      { code: 'P001', name: 'Parafuso M6x20', kg: 1.20, entry: '2025-01-10', expiries: [], qty: 100, unit: 'un' },
      { code: 'P002', name: 'Parafuso M8x30', kg: 1.80, entry: '2025-01-10', expiries: [], qty: 50, unit: 'un' },
    ],
    'A1.G2': [
      { code: 'P003', name: 'Porca M6', kg: 0.50, entry: '2025-01-12', expiries: [], qty: 200, unit: 'un' },
      { code: 'P004', name: 'Porca M8', kg: 0.70, entry: '2025-01-12', expiries: [], qty: 150, unit: 'un' },
    ],
    'A2.G1': [
      { code: 'Q004', name: 'Fita Isolante', kg: 0.08, entry: '2025-01-05', expiries: ['2025-02-28'], qty: 10, unit: 'un' },
      { code: 'Q004', name: 'Fita Isolante', kg: 0.08, entry: '2025-02-20', expiries: ['2025-04-10', '2025-09-30'], qty: 20, unit: 'un' },
    ],
    'A6.G1': [
      { code: 'P009', name: 'Caixa Parafuso Sortido', kg: 28.0, entry: '2025-01-10', expiries: [], qty: 1, unit: 'cx' },
      { code: 'P010', name: 'Caixa Porca Sortida', kg: 22.0, entry: '2025-01-10', expiries: [], qty: 1, unit: 'cx' },
      { code: 'P011', name: 'Caixa Arruela Sortida', kg: 18.0, entry: '2025-01-10', expiries: [], qty: 1, unit: 'cx' },
    ],
    'B2.G1': [
      { code: 'E011', name: 'Lâmpada LED 9W', kg: 0.08, entry: '2025-01-01', expiries: ['2025-02-15'], qty: 30, unit: 'un' },
      { code: 'E011', name: 'Lâmpada LED 9W', kg: 0.08, entry: '2025-02-01', expiries: ['2025-04-05', '2025-10-05'], qty: 45, unit: 'un' },
    ]
  }
};
