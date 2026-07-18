import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface NotificationToastProps {
  notifications: string[];
  onDismiss: (index: number) => void;
}

/**
 * T6 — transient toast overlay. Each toast auto-dismisses after 3s.
 * The persistent history lives in GameState.alerts (surfaced in the Orders tab).
 */
export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      // dismiss the oldest toast
      onDismiss(0);
    }, 3000);
    return () => clearTimeout(timer);
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  const toastContent = (
    <div className="notification-container">
      {notifications.map((notification, index) => (
        <div key={index} className={`notification-toast${index === 0 ? ' toast-fresh' : ''}`}>
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
