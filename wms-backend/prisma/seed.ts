import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:./dev.db"
    }
  }
});

async function main() {
  console.log('🌱 Iniciando Mega Seed...');

  // 1. Limpar banco
  await prisma.movementHistory.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.floorPlanObject.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.product.deleteMany();
  await prisma.depot.deleteMany();
  await prisma.user.deleteMany();

  // 2. Criar Usuário Admin
  await prisma.user.create({
    data: {
      id: 'system-admin',
      name: 'Leonam Ramos',
      email: 'admin@wms.com',
      passwordHash: 'argon2_hashed_pass',
      role: 'admin'
    }
  });

  // 3. Criar Depósito
  await prisma.depot.create({
    data: {
      id: 'dep1',
      name: 'Centro de Distribuição Norte',
      address: 'Rodovia Logística, KM 10'
    }
  });

  // 4. Criar Catálogo de Produtos (SKUs)
  const products = [
    { code: 'P001', name: 'Parafuso M6x20', kg: 0.012, unit: 'un', category: 'Fixadores' },
    { code: 'P002', name: 'Parafuso M8x30', kg: 0.018, unit: 'un', category: 'Fixadores' },
    { code: 'E011', name: 'Lâmpada LED 9W', kg: 0.08, unit: 'un', category: 'Elétrica' },
    { code: 'Q004', name: 'Fita Isolante 20m', kg: 0.05, unit: 'un', category: 'Elétrica' },
    { code: 'M001', name: 'Trena 5m Emborrachada', kg: 0.25, unit: 'un', category: 'Ferramentas' },
    { code: 'C050', name: 'Cabo Flexível 2.5mm Pt', kg: 3.5, unit: 'cx', category: 'Fios e Cabos' },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  // 5. Criar Prateleiras Físicas
  const shelves = [
    { id: 'sh-a', code: 'A', floors: 6, drawers: 4, maxKg: 500, depotId: 'dep1' },
    { id: 'sh-b', code: 'B', floors: 6, drawers: 4, maxKg: 500, depotId: 'dep1' },
    { id: 'sh-c', code: 'C', floors: 5, drawers: 3, maxKg: 800, depotId: 'dep1' },
  ];

  for (const s of shelves) {
    await prisma.shelf.create({ data: s as any });
  }

  // 6. Popular Inventário
  const inventory = [
    { depotId: 'dep1', shelfId: 'sh-a', floor: 1, drawer: 1, productCode: 'P001', qty: 500, expiryDate: null },
    { depotId: 'dep1', shelfId: 'sh-a', floor: 1, drawer: 2, productCode: 'P002', qty: 250, expiryDate: null },
    { depotId: 'dep1', shelfId: 'sh-b', floor: 2, drawer: 1, productCode: 'E011', qty: 45, expiryDate: new Date('2025-12-31') },
    { depotId: 'dep1', shelfId: 'sh-b', floor: 2, drawer: 1, productCode: 'Q004', qty: 20, expiryDate: new Date('2024-05-10') }, 
  ];

  for (const item of inventory) {
    await prisma.inventory.create({ data: item });
  }

  // 7. Objetos da Planta Baixa
  const fpObjects = [
    { depotId: 'dep1', type: 'shelf', x: 50, y: 100, width: 220, height: 70, label: 'PRATELEIRA A' },
    { depotId: 'dep1', type: 'shelf', x: 50, y: 200, width: 220, height: 70, label: 'PRATELEIRA B' },
    { depotId: 'dep1', type: 'shelf', x: 300, y: 100, width: 70, height: 220, label: 'PRATELEIRA C' },
    { depotId: 'dep1', type: 'area', x: 500, y: 50, width: 150, height: 150, label: 'DOCA RECEBIMENTO', color: '#eef6ee' },
  ];

  for (const fp of fpObjects) {
    await prisma.floorPlanObject.create({ data: fp });
  }

  // 8. Histórico
  await prisma.movementHistory.create({
    data: {
      userId: 'system-admin',
      actionType: 'entry',
      productCode: 'C050',
      toLoc: 'DOCA RECEBIMENTO',
      qty: 10,
      timestamp: new Date(),
      notes: 'Entrada inicial do sistema'
    }
  });

  console.log('✅ Mega Seed concluído!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
