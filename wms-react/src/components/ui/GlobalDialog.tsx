import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { useWMSStore } from '../../store/useWMSStore';

const GlobalDialog: React.FC = () => {
  const dialog = useWMSStore(state => state.dialog);
  const closeDialog = useWMSStore(state => state.closeDialog);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (dialog.isOpen) {
      setInputValue(dialog.defaultValue || '');
    }
  }, [dialog.isOpen, dialog.defaultValue]);

  if (!dialog.isOpen) return null;

  const handleConfirm = () => {
    if (dialog.onConfirm) {
      dialog.onConfirm(dialog.type === 'prompt' ? inputValue : undefined);
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    closeDialog();
  };

  return (
    <Modal 
      isOpen={dialog.isOpen} 
      onClose={handleCancel} 
      title={dialog.title || 'MENSAGEM DO SISTEMA'}
    >
      <div className="dialog-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ fontSize: '15px', color: 'var(--text)', lineHeight: '1.5' }}>
          {dialog.message}
        </p>

        {dialog.type === 'prompt' && (
          <input 
            type="text"
            className="btn"
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '14px', 
              background: 'var(--surface2)',
              textAlign: 'left'
            }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          />
        )}

        <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
            <button className="btn" onClick={handleCancel}>
              CANCELAR
            </button>
          )}
          <button className="btn btn-accent" onClick={handleConfirm}>
            {dialog.type === 'alert' ? 'OK' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GlobalDialog;
