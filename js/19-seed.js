// ╔══════════════════════════════════════════════════════════════════╗
// ║  19-seed.js              Dados de exemplo (seed)                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ——— SEED DATA ———
// ─────────────────────────────────────────────────────────────────────────────
// REGRAS DEMONSTRADAS:
//  ✅ mesmo produto em múltiplas gavetas e prateleiras
//  ✅ múltiplas validades por entrada (expiries[])
//  ✅ validade vencida (expired) em várias prateleiras
//  ✅ validade próxima ≤30 dias (expiring) com e sem outras datas futuras
//  ✅ mesmo SKU com validades diferentes na mesma gaveta
//  ✅ gaveta com capacidade quase no limite (barra vermelha)
//  ✅ gaveta com 3+ produtos ("+N mais")
//  ✅ produtos sem validade convivendo com produtos com validade
// ─────────────────────────────────────────────────────────────────────────────

// ══ PRATELEIRA A — ferramentas manuais / fixação ══════════════════════════
// A1 — parafusos e porcas (mesmo SKU em múltiplas gavetas)
products['A1.G1'] = [
  { code: 'P001', name: 'Parafuso M6x20',   kg: 1.20, entry: '2025-01-10', expiries: [] },
  { code: 'P002', name: 'Parafuso M8x30',   kg: 1.80, entry: '2025-01-10', expiries: [] },
  { code: 'P001', name: 'Parafuso M6x20',   kg: 0.80, entry: '2025-02-15', expiries: [] }, // mesmo P001, lote 2
];
products['A1.G2'] = [
  { code: 'P003', name: 'Porca M6',          kg: 0.50, entry: '2025-01-12', expiries: [] },
  { code: 'P004', name: 'Porca M8',          kg: 0.70, entry: '2025-01-12', expiries: [] },
  { code: 'P003', name: 'Porca M6',          kg: 0.30, entry: '2025-03-01', expiries: [] }, // mesmo P003, reposição
];
products['A1.G3'] = [
  { code: 'P005', name: 'Arruela Plana 6mm', kg: 0.10, entry: '2025-01-15', expiries: [] },
  { code: 'P006', name: 'Arruela Pressão 8', kg: 0.15, entry: '2025-01-15', expiries: [] },
  { code: 'P001', name: 'Parafuso M6x20',   kg: 0.60, entry: '2025-03-05', expiries: [] }, // P001 também aqui!
];
products['A1.G4'] = [
  { code: 'P007', name: 'Rebite 4x10mm',    kg: 0.20, entry: '2025-02-01', expiries: [] },
  { code: 'P008', name: 'Rebite 5x12mm',    kg: 0.25, entry: '2025-02-01', expiries: [] },
];

// A2 — adesivos e fitas (validades vencidas e próximas — mesmos SKUs em gavetas diferentes)
products['A2.G1'] = [
  // Q004 Fita Isolante: lote vencido + lote futuro na MESMA gaveta
  { code: 'Q004', name: 'Fita Isolante',    kg: 0.08, entry: '2025-01-05', expiries: ['2025-02-28'] },          // VENCIDA
  { code: 'Q004', name: 'Fita Isolante',    kg: 0.08, entry: '2025-02-20', expiries: ['2025-04-10', '2025-09-30'] }, // próxima + futura
];
products['A2.G2'] = [
  { code: 'Q005', name: 'Fita Dupla Face',  kg: 0.06, entry: '2025-02-01', expiries: ['2025-03-20'] },           // VENCIDA
  { code: 'Q005', name: 'Fita Dupla Face',  kg: 0.06, entry: '2025-03-10', expiries: ['2025-07-15', '2025-12-31'] }, // mesmo SKU datas futuras
];
products['A2.G3'] = [
  { code: 'Q004', name: 'Fita Isolante',    kg: 0.16, entry: '2025-03-15', expiries: ['2025-09-15', '2026-03-15'] }, // Q004 também aqui — datas futuras
  { code: 'Q006', name: 'Cola Instantânea', kg: 0.04, entry: '2025-02-10', expiries: ['2025-04-08'] },            // expiring
];
products['A2.G4'] = [
  { code: 'Q007', name: 'Cola Epóxi Bicomposta', kg: 0.12, entry: '2025-01-20', expiries: ['2025-03-01', '2026-01-20'] }, // 1ª VENCIDA, 2ª futura
];

// A3 — ferramentas (alta ocupação — barra laranja/vermelha)
products['A3.G1'] = [
  { code: 'T001', name: 'Chave Allen 3mm',  kg: 0.12, entry: '2025-01-20', expiries: [] },
  { code: 'T002', name: 'Chave Allen 5mm',  kg: 0.18, entry: '2025-01-20', expiries: [] },
  { code: 'T003', name: 'Chave Allen 6mm',  kg: 0.22, entry: '2025-01-22', expiries: [] },
  { code: 'T004', name: 'Chave Allen 8mm',  kg: 0.28, entry: '2025-01-22', expiries: [] },
];
products['A3.G2'] = [
  { code: 'T005', name: 'Chave Fenda P',    kg: 0.14, entry: '2025-02-05', expiries: [] },
  { code: 'T006', name: 'Chave Fenda G',    kg: 0.28, entry: '2025-02-05', expiries: [] },
  { code: 'T007', name: 'Chave Phillips P', kg: 0.14, entry: '2025-02-05', expiries: [] },
  { code: 'T008', name: 'Chave Phillips G', kg: 0.28, entry: '2025-02-05', expiries: [] },
];
products['A3.G3'] = [
  { code: 'T009', name: 'Alicate Universal',kg: 0.35, entry: '2025-02-10', expiries: [] },
  { code: 'T010', name: 'Alicate de Bico',  kg: 0.28, entry: '2025-02-10', expiries: [] },
];
products['A3.G4'] = [
  { code: 'T011', name: 'Martelo 300g',     kg: 0.30, entry: '2025-02-12', expiries: [] },
  { code: 'T012', name: 'Martelo Borracha', kg: 0.42, entry: '2025-02-12', expiries: [] },
  { code: 'T013', name: 'Serra Manual',     kg: 0.55, entry: '2025-02-14', expiries: [] },
];

// A4 — EPI e medição
products['A4.G1'] = [
  { code: 'S001', name: 'Luva de Segurança', kg: 0.22, entry: '2025-02-20', expiries: ['2026-02-20'] },
  { code: 'S002', name: 'Óculos de Proteção',kg: 0.08, entry: '2025-02-20', expiries: ['2026-02-20'] },
  { code: 'S001', name: 'Luva de Segurança', kg: 0.22, entry: '2025-03-10', expiries: ['2025-04-12'] }, // mesmo S001, lote quase vencendo
];
products['A4.G2'] = [
  { code: 'S003', name: 'Capacete EPI',      kg: 0.42, entry: '2025-01-15', expiries: ['2027-01-15'] },
  { code: 'S004', name: 'Protetor Auricular',kg: 0.05, entry: '2025-01-15', expiries: ['2025-04-01', '2026-04-01'] }, // expiring + futura
];
products['A5.G1'] = [
  { code: 'M001', name: 'Trena 5m',          kg: 0.18, entry: '2025-03-10', expiries: [] },
  { code: 'M002', name: 'Nível de Bolha',    kg: 0.22, entry: '2025-03-10', expiries: [] },
  { code: 'M003', name: 'Esquadro 30cm',     kg: 0.15, entry: '2025-03-10', expiries: [] },
];
products['A5.G2'] = [
  { code: 'M001', name: 'Trena 5m',          kg: 0.18, entry: '2025-03-15', expiries: [] }, // M001 também aqui (overflow)
  { code: 'M004', name: 'Paquímetro 150mm',  kg: 0.20, entry: '2025-02-08', expiries: [] },
];

// A6 — itens pesados (gaveta perto do limite de 80kg)
products['A6.G1'] = [
  { code: 'P009', name: 'Caixa Parafuso Sortido', kg: 28.0, entry: '2025-01-10', expiries: [] },
  { code: 'P010', name: 'Caixa Porca Sortida',    kg: 22.0, entry: '2025-01-10', expiries: [] },
  { code: 'P011', name: 'Caixa Arruela Sortida',  kg: 18.0, entry: '2025-01-10', expiries: [] }, // 68kg total → barra laranja
];
products['A6.G2'] = [
  { code: 'P012', name: 'Caixa Rebite Sortido',   kg: 35.0, entry: '2025-01-12', expiries: [] },
  { code: 'P013', name: 'Kit Fixação Pesada',      kg: 42.0, entry: '2025-01-12', expiries: [] }, // 77kg → barra vermelha
];

// ══ PRATELEIRA B — materiais elétricos ═══════════════════════════════════════
products['B1.G1'] = [
  { code: 'E001', name: 'Cabo PP 2x1.5mm',   kg: 2.50, entry: '2025-01-08', expiries: [] },
  { code: 'E002', name: 'Cabo PP 2x2.5mm',   kg: 3.80, entry: '2025-01-08', expiries: [] },
  { code: 'E001', name: 'Cabo PP 2x1.5mm',   kg: 1.80, entry: '2025-02-20', expiries: [] }, // E001 lote2
];
products['B1.G2'] = [
  { code: 'E003', name: 'Disjuntor 10A',     kg: 0.18, entry: '2025-01-10', expiries: [] },
  { code: 'E004', name: 'Disjuntor 20A',     kg: 0.21, entry: '2025-01-10', expiries: [] },
  { code: 'E005', name: 'Disjuntor 32A',     kg: 0.25, entry: '2025-01-10', expiries: [] },
  { code: 'E003', name: 'Disjuntor 10A',     kg: 0.18, entry: '2025-03-01', expiries: [] }, // E003 reposição
];
products['B1.G3'] = [
  { code: 'E006', name: 'Tomada 2P+T',       kg: 0.09, entry: '2025-02-01', expiries: [] },
  { code: 'E007', name: 'Interruptor Simples',kg: 0.07, entry: '2025-02-01', expiries: [] },
];
products['B2.G1'] = [
  // Lâmpada LED: lote vencido, lote expiring, lote ok — mesma gaveta
  { code: 'E011', name: 'Lâmpada LED 9W',    kg: 0.08, entry: '2025-01-01', expiries: ['2025-02-15'] },                       // VENCIDA
  { code: 'E011', name: 'Lâmpada LED 9W',    kg: 0.08, entry: '2025-02-01', expiries: ['2025-04-05', '2025-10-05'] },         // expiring + futura
  { code: 'E011', name: 'Lâmpada LED 9W',    kg: 0.08, entry: '2025-03-10', expiries: ['2026-03-10'] },                       // futura
];
products['B2.G2'] = [
  { code: 'E011', name: 'Lâmpada LED 9W',    kg: 0.08, entry: '2025-03-12', expiries: ['2026-09-12'] },   // E011 overflow em B2.G2
  { code: 'E012', name: 'Lâmpada LED 15W',   kg: 0.10, entry: '2025-03-01', expiries: ['2026-03-01'] },
];
products['B2.G3'] = [
  { code: 'E008', name: 'Eletroduto 3/4"',   kg: 1.20, entry: '2025-01-20', expiries: [] },
  { code: 'E009', name: 'Eletroduto 1"',     kg: 1.80, entry: '2025-01-20', expiries: [] },
];
products['B3.G1'] = [
  { code: 'E013', name: 'Sensor de Presença',kg: 0.12, entry: '2025-02-05', expiries: ['2027-02-05'] },
  { code: 'E014', name: 'Sensor Magnético',  kg: 0.08, entry: '2025-02-05', expiries: ['2027-02-05'] },
];
products['B3.G2'] = [
  { code: 'E015', name: 'Multímetro Digital',kg: 0.45, entry: '2025-01-15', expiries: [] },
  { code: 'E016', name: 'Alicate Amperímetro',kg:0.62, entry: '2025-01-15', expiries: [] },
];
products['B3.G3'] = [
  { code: 'E017', name: 'Tomada Industrial', kg: 0.28, entry: '2025-02-18', expiries: [] },
  { code: 'E003', name: 'Disjuntor 10A',     kg: 0.18, entry: '2025-03-05', expiries: [] }, // E003 também aqui!
];
products['B4.G1'] = [
  { code: 'E018', name: 'Régua DIN 35mm',    kg: 0.55, entry: '2025-03-05', expiries: [] },
  { code: 'E019', name: 'Contator 9A',       kg: 0.38, entry: '2025-03-05', expiries: [] },
  { code: 'E020', name: 'Relé Térmico',      kg: 0.32, entry: '2025-03-05', expiries: [] },
];
products['B4.G2'] = [
  { code: 'E021', name: 'Fio Paralelo 1mm',  kg: 1.60, entry: '2025-02-20', expiries: [] },
  { code: 'E001', name: 'Cabo PP 2x1.5mm',   kg: 2.00, entry: '2025-03-10', expiries: [] }, // E001 em 3ª localização!
];
products['B5.G1'] = [
  { code: 'E022', name: 'Borne Conexão 2.5mm',kg:0.04, entry: '2025-02-01', expiries: [] },
  { code: 'E023', name: 'Borne Conexão 6mm', kg: 0.06, entry: '2025-02-01', expiries: [] },
  { code: 'E024', name: 'Tampa Borne',        kg: 0.01, entry: '2025-02-01', expiries: [] },
];
products['B5.G3'] = [
  { code: 'E025', name: 'Caixa de Passagem PVC',kg:0.32,entry:'2025-02-14', expiries: [] },
  { code: 'E026', name: 'Tampa Caixa Passagem', kg:0.15,entry:'2025-02-14', expiries: [] },
];
products['B6.G1'] = [
  // Q012 Spray Dielétrico: vencido aqui, ok na D
  { code: 'Q012', name: 'Spray Dielétrico',  kg: 0.28, entry: '2025-01-10', expiries: ['2025-02-28'] }, // VENCIDO
];
products['B6.G2'] = [
  { code: 'E027', name: 'Cabo HDMI 2m',      kg: 0.18, entry: '2025-03-01', expiries: [] },
  { code: 'E028', name: 'Cabo USB-C 1m',     kg: 0.08, entry: '2025-03-01', expiries: [] },
];

// ══ PRATELEIRA C — hidráulica e encanamento ══════════════════════════════════
products['C1.G1'] = [
  { code: 'H001', name: 'Cano PVC 1/2"',     kg: 0.90, entry: '2025-01-05', expiries: [] },
  { code: 'H002', name: 'Cano PVC 3/4"',     kg: 1.20, entry: '2025-01-05', expiries: [] },
];
products['C1.G2'] = [
  { code: 'H003', name: 'Joelho 90° 1/2"',   kg: 0.04, entry: '2025-01-05', expiries: [] },
  { code: 'H004', name: 'Tê 1/2"',           kg: 0.06, entry: '2025-01-05', expiries: [] },
  { code: 'H005', name: 'Luva PVC 1/2"',     kg: 0.03, entry: '2025-01-05', expiries: [] },
  { code: 'H003', name: 'Joelho 90° 1/2"',   kg: 0.04, entry: '2025-03-01', expiries: [] }, // H003 reposição
];
products['C1.G3'] = [
  { code: 'H006', name: 'Registro Esfera 1/2"',kg:0.28, entry:'2025-01-20', expiries: [] },
  { code: 'H007', name: 'Registro Globo 3/4"', kg:0.42, entry:'2025-01-20', expiries: [] },
];
products['C2.G1'] = [
  // Q009 Veda Rosca: vencido aqui, futura em C4
  { code: 'Q009', name: 'Veda Rosca',        kg: 0.02, entry: '2025-01-15', expiries: ['2025-02-20'] },           // VENCIDA
  { code: 'Q009', name: 'Veda Rosca',        kg: 0.02, entry: '2025-02-25', expiries: ['2025-04-10'] },           // expiring
];
products['C2.G2'] = [
  { code: 'Q010', name: 'Silicone Branco',   kg: 0.15, entry: '2025-02-10', expiries: ['2025-03-25', '2025-09-01'] }, // expiring + futura
  { code: 'Q010', name: 'Silicone Branco',   kg: 0.15, entry: '2025-03-05', expiries: ['2026-03-05'] },           // mesma Q010, data futura
];
products['C2.G3'] = [
  { code: 'Q011', name: 'Silicone Transparente',kg:0.14,entry:'2025-02-15',expiries: ['2025-04-15', '2025-10-15'] }, // expiring
  { code: 'Q010', name: 'Silicone Branco',   kg: 0.15, entry: '2025-03-15', expiries: ['2026-09-15'] }, // Q010 3ª localização
];
products['C3.G1'] = [
  { code: 'H008', name: 'Torneira Jardim',   kg: 0.38, entry: '2025-02-01', expiries: [] },
  { code: 'H009', name: 'Torneira Pia',      kg: 0.52, entry: '2025-02-01', expiries: [] },
];
products['C3.G2'] = [
  { code: 'H010', name: 'Sifão Cozinha',     kg: 0.22, entry: '2025-02-15', expiries: [] },
  { code: 'H011', name: 'Válvula Descarga',  kg: 0.65, entry: '2025-02-15', expiries: [] },
];
products['C4.G1'] = [
  { code: 'Q009', name: 'Veda Rosca',        kg: 0.04, entry: '2025-03-10', expiries: ['2026-03-10'] }, // Q009 futura — 3ª localização!
  { code: 'H012', name: 'Manta Veda Calha',  kg: 1.40, entry: '2025-03-08', expiries: [] },
];
products['C4.G2'] = [
  { code: 'H013', name: 'Redutor PVC 3/4>1/2"',kg:0.05,entry:'2025-01-10',expiries:[] },
  { code: 'H014', name: 'Cap PVC 1/2"',      kg: 0.03, entry: '2025-01-10', expiries: [] },
];
products['C5.G1'] = [
  { code: 'H001', name: 'Cano PVC 1/2"',     kg: 0.90, entry: '2025-03-20', expiries: [] }, // H001 também na C5!
  { code: 'H015', name: 'Cano CPVC 1/2"',    kg: 1.10, entry: '2025-03-20', expiries: [] },
];
products['C5.G2'] = [
  { code: 'H016', name: 'Bomba dÁgua 1/2cv',kg:5.20, entry: '2025-02-05', expiries: [] },
];

// ══ PRATELEIRA D — químicos / consumíveis ════════════════════════════════════
products['D1.G1'] = [
  { code: 'Q001', name: 'WD-40 300ml',       kg: 0.32, entry: '2025-01-10', expiries: ['2026-01-10'] },
  { code: 'Q001', name: 'WD-40 300ml',       kg: 0.32, entry: '2025-02-05', expiries: ['2026-07-10', '2027-01-10'] }, // mesmo Q001 datas futuras
  { code: 'Q002', name: 'Óleo Lubrificante', kg: 0.45, entry: '2025-01-10', expiries: ['2026-01-10'] },
];
products['D1.G2'] = [
  { code: 'Q003', name: 'Graxa Branca',      kg: 0.50, entry: '2025-02-01', expiries: ['2026-02-01'] },
  { code: 'Q003', name: 'Graxa Branca',      kg: 0.50, entry: '2025-03-01', expiries: ['2026-08-01'] }, // mesmo Q003, lote mais novo
];
products['D2.G1'] = [
  { code: 'Q004', name: 'Solvente 500ml',    kg: 0.55, entry: '2025-01-15', expiries: ['2025-02-28'] }, // VENCIDO
  { code: 'Q004', name: 'Solvente 500ml',    kg: 0.55, entry: '2025-03-01', expiries: ['2025-04-07', '2025-10-01'] }, // mesmo Q004 expiring
];
products['D2.G2'] = [
  { code: 'Q012', name: 'Spray Dielétrico',  kg: 0.28, entry: '2025-03-10', expiries: ['2026-03-10'] }, // Q012 ok aqui, vencido no B6!
];
products['D2.G3'] = [
  { code: 'Q005', name: 'Álcool Isopropílico',kg:0.48, entry: '2025-02-20', expiries: ['2025-08-20'] },
  { code: 'Q005', name: 'Álcool Isopropílico',kg:0.48, entry: '2025-03-10', expiries: ['2025-09-10', '2026-03-10'] }, // Q005 lote2
];
products['D3.G1'] = [
  { code: 'Q006', name: 'Lixa Gr.80',        kg: 0.08, entry: '2025-03-01', expiries: [] },
  { code: 'Q007', name: 'Lixa Gr.120',       kg: 0.08, entry: '2025-03-01', expiries: [] },
  { code: 'Q008', name: 'Lixa Gr.220',       kg: 0.08, entry: '2025-03-01', expiries: [] },
  { code: 'Q006', name: 'Lixa Gr.80',        kg: 0.08, entry: '2025-03-15', expiries: [] }, // Q006 reposição
];
products['D3.G2'] = [
  { code: 'Q013', name: 'Tinta Spray Preta', kg: 0.40, entry: '2025-02-10', expiries: ['2025-04-08'] },           // expiring
  { code: 'Q013', name: 'Tinta Spray Preta', kg: 0.40, entry: '2025-03-05', expiries: ['2025-04-30', '2026-03-05'] }, // mesma tinta, 2 datas
  { code: 'Q014', name: 'Tinta Spray Branca',kg: 0.40, entry: '2025-02-10', expiries: ['2026-02-10'] },
];
products['D4.G1'] = [
  { code: 'Q015', name: 'Acetona 500ml',     kg: 0.45, entry: '2025-01-20', expiries: ['2025-03-10'] }, // VENCIDA
  { code: 'Q015', name: 'Acetona 500ml',     kg: 0.45, entry: '2025-03-08', expiries: ['2025-09-08'] }, // Q015 lote novo
];
products['D4.G2'] = [
  { code: 'Q016', name: 'Removedor Tinta',   kg: 0.38, entry: '2025-02-01', expiries: ['2025-04-01', '2025-11-01'] }, // expiring + futura
];
products['D4.G3'] = [
  { code: 'Q017', name: 'Pano Microfibra',   kg: 0.06, entry: '2025-02-28', expiries: [] },
  { code: 'Q018', name: 'Esponja Abrasiva',  kg: 0.03, entry: '2025-02-28', expiries: [] },
  { code: 'Q017', name: 'Pano Microfibra',   kg: 0.06, entry: '2025-03-20', expiries: [] }, // Q017 reposição
];


