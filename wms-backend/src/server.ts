import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Inicialização minimalista
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/api/state/:depotId', async (req, res) => {
  try {
    const depot = await prisma.depot.findUnique({
      where: { id: req.params.depotId },
      include: { shelves: true, fpObjects: true, inventory: { include: { product: true, shelf: true } } }
    });
    const history = await prisma.movementHistory.findMany({ take: 50, orderBy: { timestamp: 'desc' } });
    res.json({ depot, history });
  } catch (err) {
    res.status(500).json({ error: 'Erro de Banco' });
  }
});

app.listen(3001, () => {
  console.log('🚀 Servidor pronto na 3001');
});
