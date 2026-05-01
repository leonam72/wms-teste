import React, { useState } from 'react';
import { useWMSStore } from '../../../store/useWMSStore';
import { exportInventoryToCSV } from '../../../utils/csv';
import './SettingsPage.css';

const SettingsPage: React.FC = () => {
  const activeDepotId = useWMSStore(state => state.activeDepotId);
  const depots = useWMSStore(state => state.depots);
  const activeDepot = depots.find(d => d.id === activeDepotId);
  
  const productsAll = useWMSStore(state => state.productsAll[activeDepotId] || {});
  const updateDepot = useWMSStore(state => state.updateDepot);
  const deleteDepot = useWMSStore(state => state.deleteDepot);
  const clearAudit = useWMSStore(state => state.clearAudit);
  const logAction = useWMSStore(state => state.logAction);

  const [editData, setEditData] = useState(activeDepot || { name: '', manager: '', phone: '', address: '' });

  const handleSaveInfo = () => {
    if (activeDepotId) {
        updateDepot(activeDepotId, editData);
        logAction('⚙️', 'Ajuste Config', `Dados do depósito ${activeDepotId} atualizados`);
        alert('Dados salvos com sucesso!');
    }
  };

  const handleDeleteDepot = async () => {
    if (confirm(`Tem certeza que deseja apagar o depósito "${activeDepot?.name}"? ESTA AÇÃO É IRREVERSÍVEL.`)) {
        await deleteDepot(activeDepotId);
        window.location.href = '/'; // Redireciona para resetar o estado
    }
  };

  const handleClearAudit = async () => {
    if (confirm('Deseja limpar TODO o histórico de auditoria do sistema?')) {
        await clearAudit();
        alert('Histórico removido.');
    }
  };

  const handleExport = () => {
    const csv = exportInventoryToCSV(productsAll);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${activeDepotId}.csv`;
    link.click();
  };

  return (
    <div className="settings-page">
      <div className="workspace-header">
        <div className="ws-title">
          <strong>GESTÃO DA UNIDADE</strong> {' - '} {activeDepot?.name}
        </div>
      </div>

      <div className="settings-grid">
        <section className="settings-card info-card">
          <h3>INFORMAÇÕES DA UNIDADE</h3>
          <div className="settings-form">
             <div className="form-group">
                <label>Nome do Depósito</label>
                <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
             </div>
             <div className="form-group">
                <label>Gerente Responsável</label>
                <input value={editData.manager || ''} onChange={e => setEditData({...editData, manager: e.target.value})} />
             </div>
             <div className="form-group">
                <label>Telefone de Contato</label>
                <input value={editData.phone || ''} onChange={e => setEditData({...editData, phone: e.target.value})} />
             </div>
             <div className="form-group">
                <label>Endereço Físico</label>
                <input value={editData.address || ''} onChange={e => setEditData({...editData, address: e.target.value})} />
             </div>
             <button className="btn btn-accent" onClick={handleSaveInfo}>SALVAR ALTERAÇÕES</button>
          </div>
        </section>

        <section className="settings-card">
          <h3>DADOS E BACKUP</h3>
          <p>Operações de exportação e manutenção de registros.</p>
          <div className="flex flex-col gap-4 mt-4">
            <button className="btn" onClick={handleExport}>EXPORTAR INVENTÁRIO (.CSV)</button>
            <button className="btn btn-danger" onClick={handleClearAudit}>APAGAR HISTÓRICO DE AUDITORIA</button>
          </div>
        </section>

        <section className="settings-card danger">
          <h3>DESATIVAR UNIDADE</h3>
          <p>Remover permanentemente este depósito do sistema. Esta ação não pode ser desfeita.</p>
          <button className="btn btn-danger" onClick={handleDeleteDepot}>EXCLUIR DEPÓSITO DEFINITIVAMENTE</button>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
