import React, { useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import type { Product, Unit } from '../../../types';
import './ProductForm.css';

interface ProductFormProps {
  onSave: (product: Product) => void;
  onCancel: () => void;
  targetDrawer: string | null;
}

const ProductForm: React.FC<ProductFormProps> = ({ onSave, onCancel, targetDrawer }) => {
  const showDialog = useWMSStore(state => state.showDialog);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<Unit>('un');
  const [kg, setKg] = useState(0.1);
  const [expiries, setExpiries] = useState<string[]>([]);
  const [newExpiry, setNewExpiry] = useState('');

  const addExpiry = () => {
    if (newExpiry) {
      setExpiries([...expiries, newExpiry]);
      setNewExpiry('');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !name) {
      showDialog({
        type: 'alert',
        title: 'CAMPOS OBRIGATÓRIOS',
        message: 'Por favor, informe o Código (SKU) e o Nome do produto para continuar.'
      });
      return;
    }

    onSave({
      code: sku,
      name,
      qty,
      unit,
      kg,
      entry: new Date().toISOString(),
      expiries
    });
  };

  return (
    <form className="product-form" onSubmit={handleSave}>
      <div className="form-info">
        Alocando em: <strong>{targetDrawer || 'RECEBIMENTO'}</strong>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Código (SKU)</label>
          <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="Ex: P001" />
        </div>

        <div className="form-group">
          <label>Nome do Produto</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Parafuso M6" />
        </div>

        <div className="form-group">
          <label>Peso Unitário (kg)</label>
          <input type="number" step="any" value={kg} onChange={(e) => setKg(parseFloat(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Quantidade</label>
          <input type="number" value={qty} onChange={(e) => setQty(parseInt(e.target.value))} />
        </div>

        <div className="form-group">
          <label>Unidade</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="un">UN</option>
            <option value="cx">CX</option>
            <option value="kg">KG</option>
          </select>
        </div>

        <div className="form-group full-width">
          <label>Validades (Opcional)</label>
          <div className="flex gap-2">
            <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
            <button type="button" className="btn btn-accent" onClick={addExpiry}>+ ADD</button>
          </div>
          <div className="expiry-list">
            {expiries.map((ex, i) => (
              <span key={i} className="expiry-chip">{ex}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>CANCELAR</button>
        <button type="submit" className="btn btn-accent">SALVAR PRODUTO</button>
      </div>
    </form>
  );
};

export default ProductForm;
