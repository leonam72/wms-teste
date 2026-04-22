import React, { useState } from 'react';
import type { Product, Unit } from '../../../types';
import './ProductForm.css';

interface ProductFormProps {
  initialData?: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const UNITS: Unit[] = ['un', 'cx', 'kg', 'lt', 'mt', 'pc', 'pr'];

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Product>(initialData || {
    code: '',
    name: '',
    kg: 0,
    qty: 0,
    unit: 'un',
    entry: new Date().toISOString().split('T')[0],
    expiries: []
  });

  const [newExpiry, setNewExpiry] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'kg' || name === 'qty') ? parseFloat(value) || 0 : value
    }));
  };

  const addExpiry = () => {
    if (!newExpiry) return;
    setFormData(prev => ({
      ...prev,
      expiries: [...prev.expiries, newExpiry].sort()
    }));
    setNewExpiry('');
  };

  const removeExpiry = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      expiries: prev.expiries.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      alert('Código e Nome são obrigatórios.');
      return;
    }
    onSave(formData);
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>CÓDIGO (SKU)</label>
        <input name="code" value={formData.code} onChange={handleChange} placeholder="ex: P001" required />
      </div>

      <div className="form-group">
        <label>NOME DO PRODUTO</label>
        <input name="name" value={formData.name} onChange={handleChange} placeholder="ex: Parafuso Sextavado" required />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>PESO UNIT (KG)</label>
          <input type="number" step="0.001" name="kg" value={formData.kg} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>QUANTIDADE</label>
          <input type="number" name="qty" value={formData.qty} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>UNIDADE</label>
          <select name="unit" value={formData.unit} onChange={handleChange}>
            {UNITS.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div className="expiry-section">
        <label>DATAS DE VALIDADE (LOTES)</label>
        <div className="expiry-input-row">
          <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
          <button type="button" className="btn btn-accent" onClick={addExpiry}>+ ADD</button>
        </div>
        <div className="expiry-chips">
          {formData.expiries.map((date, i) => (
            <div key={i} className="expiry-chip">
              {new Date(date).toLocaleDateString('pt-BR')}
              <span className="remove" onClick={() => removeExpiry(i)}>&times;</span>
            </div>
          ))}
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
