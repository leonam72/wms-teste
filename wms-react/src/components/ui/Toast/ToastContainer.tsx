import React from 'react';
import ReactDOM from 'react-dom';
import Toast from './Toast';
import type { ToastItem } from '../../../hooks/useToasts';
import './Toast.css';

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return ReactDOM.createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <Toast 
          key={t.id}
          id={t.id}
          message={t.message}
          type={t.type}
          onClose={onRemove}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
