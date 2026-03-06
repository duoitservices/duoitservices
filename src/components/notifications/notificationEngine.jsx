/**
 * Notification Engine
 * Motor de notificações que integra configurações com disparo real
 * Arquitetura: Evento → Engine → Context → UI
 */

import { notificationSettingsService } from '../settings/notifications/notificationSettingsService';

/**
 * Mapeia tipos de evento para tipos de notificação
 */
const EVENT_TO_NOTIFICATION_TYPE = {
  'TICKET_STATUS_CHANGED': 'status_change',
  'TICKET_CREATED': 'ticket_created',
  'TICKET_ASSIGNED': 'ticket_assigned',
  'COMMENT_ADDED': 'comment_added',
  'APPROVAL_REQUESTED': 'approval_needed',
  'SLA_WARNING': 'sla_warning'
};

/**
 * Processa variáveis do template
 */
function processTemplate(template, data) {
  let processed = template;
  
  const variables = {
    '{{nome_usuario}}': data.targetUserName || 'Usuário',
    '{{numero_chamado}}': data.ticketNumber || '',
    '{{titulo_chamado}}': data.ticketTitle || '',
    '{{status}}': data.newStatus || data.status || '',
    '{{descricao}}': data.description || '',
    '{{prioridade}}': data.priority || '',
    '{{criador}}': data.creator || '',
    '{{prazo_sla}}': data.slaDeadline || '',
    '{{tempo_restante}}': data.remainingTime || '',
    '{{link_sistema}}': data.systemLink || window.location.href,
    '{{autor_comentario}}': data.commentAuthor || '',
    '{{conteudo_comentario}}': data.commentContent || '',
    '{{tipo_aprovacao}}': data.approvalType || '',
    '{{solicitante}}': data.requester || '',
    '{{detalhes}}': data.details || ''
  };

  Object.entries(variables).forEach(([key, value]) => {
    processed = processed.replaceAll(key, value);
  });

  return processed;
}

/**
 * Classe principal do motor de notificações
 */
class NotificationEngine {
  constructor() {
    this.addNotificationCallback = null;
    this.settings = {};
    this.pendingNotifications = [];
  }

  /**
   * Inicializa o engine com callback do contexto
   */
  async initialize(addNotificationCallback) {
    this.addNotificationCallback = addNotificationCallback;
    
    // Carrega configurações
    try {
      this.settings = await notificationSettingsService.fetchNotificationSettings();
      console.log('[NotificationEngine] Initialized with settings:', Object.keys(this.settings));
    } catch (error) {
      console.error('[NotificationEngine] Failed to load settings:', error);
    }
  }

  /**
   * Recarrega configurações (útil após salvar settings)
   */
  async reloadSettings() {
    try {
      this.settings = await notificationSettingsService.fetchNotificationSettings();
      console.log('[NotificationEngine] Settings reloaded');
    } catch (error) {
      console.error('[NotificationEngine] Failed to reload settings:', error);
    }
  }

  /**
   * Classifica prioridade baseado no evento
   */
  classifyPriority(event) {
    const { type, data } = event;
    
    // 🔴 Crítico
    if (type === 'SLA_WARNING' && data.slaPercentage >= 90) {
      return 'critico';
    }
    if (type === 'TICKET_ASSIGNED' && ['Alta', 'Emergencial'].includes(data.priority)) {
      return 'critico';
    }
    
    // 🟡 Atenção
    if (type === 'SLA_WARNING' && data.slaPercentage >= 70) {
      return 'atencao';
    }
    if (type === 'TICKET_ASSIGNED') {
      return 'atencao';
    }
    
    // 🔵 Informativo (padrão)
    return 'informativo';
  }

  /**
   * Dispara uma notificação baseada em evento
   * @param {Object} event - Evento do sistema
   * @param {string} event.type - Tipo do evento (ex: 'TICKET_STATUS_CHANGED')
   * @param {Object} event.data - Dados do evento
   */
  async triggerNotification(event) {
    console.log('[NotificationEngine] Event received:', event.type, event.data);

    const notificationType = EVENT_TO_NOTIFICATION_TYPE[event.type];
    
    if (!notificationType) {
      console.warn('[NotificationEngine] Unknown event type:', event.type);
      return;
    }

    const config = this.settings[notificationType];
    
    if (!config) {
      console.warn('[NotificationEngine] No config found for:', notificationType);
      return;
    }

    // Validações
    if (!config.enabled) {
      console.log('[NotificationEngine] Notification disabled:', notificationType);
      return;
    }

    if (!config.channels?.push) {
      console.log('[NotificationEngine] Push channel disabled for:', notificationType);
      return;
    }

    console.log('[NotificationEngine] Processing notification:', notificationType, config);

    // Processar template
    const title = processTemplate(
      config.emailTemplate?.subject || 'Notificação',
      event.data
    );
    
    const description = processTemplate(
      config.emailTemplate?.body?.split('\n')[0] || '',
      event.data
    );

    // Classificar prioridade
    const priority = this.classifyPriority(event);

    const notification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      title,
      description,
      type: this.getNotificationType(notificationType),
      priority,
      createdAt: new Date().toISOString(),
      read: false,
      redirectUrl: event.data.systemLink || `/TicketDetails?id=${event.data.ticketId}`,
      metadata: {
        eventType: event.type,
        ticketId: event.data.ticketId,
        ticketNumber: event.data.ticketNumber
      }
    };

    // Aplicar delay se configurado
    const delayMs = (config.delayInMinutes || 0) * 60 * 1000;
    
    if (delayMs > 0) {
      console.log(`[NotificationEngine] Scheduling notification with ${config.delayInMinutes}min delay`);
      setTimeout(() => this.deliverNotification(notification), delayMs);
    } else {
      this.deliverNotification(notification);
    }
  }

  /**
   * Entrega a notificação ao contexto
   */
  deliverNotification(notification) {
    if (!this.addNotificationCallback) {
      console.error('[NotificationEngine] No callback registered!');
      return;
    }

    console.log('[NotificationEngine] Delivering notification:', notification);
    this.addNotificationCallback(notification);
  }

  /**
   * Mapeia tipo de notificação para ícone
   */
  getNotificationType(notificationType) {
    const typeMap = {
      'status_change': 'info',
      'ticket_created': 'info',
      'ticket_assigned': 'info',
      'comment_added': 'info',
      'approval_needed': 'warning',
      'sla_warning': 'warning'
    };
    return typeMap[notificationType] || 'info';
  }
}

// Exporta instância singleton
export const notificationEngine = new NotificationEngine();

// Funções auxiliares para disparo fácil
export const triggerTicketStatusChanged = (data) => {
  notificationEngine.triggerNotification({
    type: 'TICKET_STATUS_CHANGED',
    data
  });
};

export const triggerTicketCreated = (data) => {
  notificationEngine.triggerNotification({
    type: 'TICKET_CREATED',
    data
  });
};

export const triggerTicketAssigned = (data) => {
  notificationEngine.triggerNotification({
    type: 'TICKET_ASSIGNED',
    data
  });
};

export const triggerCommentAdded = (data) => {
  notificationEngine.triggerNotification({
    type: 'COMMENT_ADDED',
    data
  });
};

export const triggerApprovalRequested = (data) => {
  notificationEngine.triggerNotification({
    type: 'APPROVAL_REQUESTED',
    data
  });
};

export const triggerSlaWarning = (data) => {
  notificationEngine.triggerNotification({
    type: 'SLA_WARNING',
    data
  });
};