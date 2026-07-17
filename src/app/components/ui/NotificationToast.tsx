import React from 'react';
import { createPortal } from 'react-dom';

interface NotificationToastProps {
  notifications: string[];
  onDismiss: (index: number) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  const toastContent = (
    <div className="notification-container">
      {notifications.map((notification, index) => (
        <div key={index} className="notification-toast">
          <div className="toast-content">
            <span className="toast-icon">ℹ️</span>
            <span className="toast-message">{notification}</span>
          </div>
          <button className="toast-dismiss" onClick={() => onDismiss(index)}>×</button>
        </div>
      ))}
    </div>
  );

  return createPortal(toastContent, document.body);
};
