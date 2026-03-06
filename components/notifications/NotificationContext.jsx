import React, { createContext, useState, useEffect, useCallback } from 'react';
import { notificationService } from './notificationService';
import { notificationEngine } from './notificationEngine';

export const NotificationContext = createContext();

const STORAGE_KEY_PREFIX = 'smartcare_notifications_';
const MAX_NOTIFICATIONS = 10;

/**
 * Provider de Notificações
 * Gerencia estado global de notificações, persistência e ações
 */
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [archivedNotifications, setArchivedNotifications] = useState([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Determinar usuário atual
  useEffect(() => {
    const userId = localStorage.getItem('smartcare_email') || 'default';
    setCurrentUserId(userId);
  }, []);

  // Carregar notificações do localStorage ao iniciar
  useEffect(() => {
    if (!currentUserId) return;

    const loadNotifications = async () => {
      try {
        const storageKey = `${STORAGE_KEY_PREFIX}${currentUserId}`;
        const archivedKey = `${STORAGE_KEY_PREFIX}${currentUserId}_archived`;
        
        // Carregar notificações ativas
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setNotifications(JSON.parse(stored));
        } else {
          const data = await notificationService.getNotifications();
          setNotifications(data);
        }

        // Carregar notificações arquivadas
        const archivedStored = localStorage.getItem(archivedKey);
        if (archivedStored) {
          setArchivedNotifications(JSON.parse(archivedStored));
        }
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    };

    loadNotifications();
  }, [currentUserId]);

  // Inicializar NotificationEngine com callback
  useEffect(() => {
    notificationEngine.initialize(addNotification);
    console.log('[NotificationContext] Engine initialized');
  }, []);

  // Persistir notificações no localStorage sempre que mudarem
  useEffect(() => {
    if (!currentUserId) return;
    
    const storageKey = `${STORAGE_KEY_PREFIX}${currentUserId}`;
    const archivedKey = `${STORAGE_KEY_PREFIX}${currentUserId}_archived`;
    
    if (notifications.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    }
    
    if (archivedNotifications.length > 0) {
      localStorage.setItem(archivedKey, JSON.stringify(archivedNotifications));
    }
  }, [notifications, archivedNotifications, currentUserId]);

  // Calcular notificações não lidas
  const unreadCount = notifications.filter(n => !n.read).length;

  /**
   * Adiciona nova notificação com agrupamento inteligente
   */
  const addNotification = useCallback((notification) => {
    setNotifications(prev => {
      // Verificar agrupamento (mesmo chamado, mesmo tipo, últimos 5 minutos)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const existingGrouped = prev.find(n => 
        n.metadata?.ticketId === notification.metadata?.ticketId &&
        n.metadata?.eventType === notification.metadata?.eventType &&
        new Date(n.createdAt).getTime() > fiveMinutesAgo &&
        !n.read
      );

      if (existingGrouped) {
        // Atualizar notificação existente com contagem
        const count = (existingGrouped.groupedCount || 1) + 1;
        const updated = prev.map(n =>
          n.id === existingGrouped.id
            ? {
                ...n,
                groupedCount: count,
                title: notification.title.replace(/^[^#]*/, `${count} `),
                createdAt: new Date().toISOString()
              }
            : n
        );
        return updated;
      }

      // Nova notificação
      const newNotification = {
        id: notification.id || `notif-${Date.now()}-${Math.random()}`,
        title: notification.title,
        description: notification.description,
        createdAt: notification.createdAt || new Date().toISOString(),
        read: false,
        type: notification.type || 'info',
        priority: notification.priority || 'informativo',
        redirectUrl: notification.redirectUrl || '',
        archived: false,
        userId: currentUserId,
        metadata: notification.metadata || {},
        groupedCount: 1
      };

      const updated = [newNotification, ...prev];
      
      // Arquivar notificações excedentes
      if (updated.length > MAX_NOTIFICATIONS) {
        const toArchive = updated.slice(MAX_NOTIFICATIONS).map(n => ({
          ...n,
          archived: true,
          archivedAt: new Date().toISOString()
        }));
        
        setArchivedNotifications(prevArchived => [...toArchive, ...prevArchived]);
        return updated.slice(0, MAX_NOTIFICATIONS);
      }
      
      return updated;
    });
  }, [currentUserId]);

  /**
   * Marca uma notificação como lida
   */
  const markAsRead = useCallback(async (id) => {
    try {
      console.log('Notificação', id, 'marcada como lida');
      await notificationService.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }, []);

  /**
    * Marca todas as notificações como lidas
    */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  }, []);

  /**
    * Limpa todas as notificações
    */
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    if (!currentUserId) return;
    const storageKey = `${STORAGE_KEY_PREFIX}${currentUserId}`;
    localStorage.removeItem(storageKey);
  }, [currentUserId]);

  /**
   * Alterna visibilidade do painel
   */
  const togglePanel = useCallback(() => {
    setIsPanelOpen(prev => !prev);
  }, []);

  /**
   * Fecha o painel
   */
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const value = {
    notifications,
    archivedNotifications,
    unreadCount,
    isPanelOpen,
    addNotification,
    markAsRead,
    markAllAsRead,
    togglePanel,
    closePanel,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}