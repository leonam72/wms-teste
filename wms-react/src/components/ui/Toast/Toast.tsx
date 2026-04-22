import React, { useEffect } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error':   return '❌';
      case 'warning': return '⚠️';
      default:        return 'ℹ️';
    }
  };

  return (
    <div className={`toast ${type}`} onClick={() => onClose(id)}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">{message}</span>
    </div>
  );
};

export default Toast;
