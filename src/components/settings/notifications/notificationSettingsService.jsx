/**
 * Serviço de Configurações de Notificações
 * Camada de abstração preparada para integração com backend
 * Atualmente usa mock data e localStorage
 */

const STORAGE_KEY = 'smartcare_notification_settings';

// Tipos de notificações disponíveis no sistema
export const notificationTypes = [
  {
    id: 'status_change',
    label: 'Alteração de Status de Chamado',
    description: 'Notifica quando um chamado muda de status'
  },
  {
    id: 'ticket_created',
    label: 'Novo Chamado Criado',
    description: 'Notifica quando um novo chamado é criado'
  },
  {
    id: 'ticket_assigned',
    label: 'Chamado Atribuído',
    description: 'Notifica quando um chamado é atribuído a alguém'
  },
  {
    id: 'comment_added',
    label: 'Comentário Adicionado',
    description: 'Notifica quando um comentário é adicionado ao chamado'
  },
  {
    id: 'approval_needed',
    label: 'Aprovação Necessária',
    description: 'Notifica quando uma aprovação é necessária'
  },
  {
    id: 'sla_warning',
    label: 'Alerta de SLA',
    description: 'Notifica quando um SLA está próximo do vencimento'
  }
];

// Configurações padrão para cada tipo
const defaultSettings = {
  status_change: {
    id: 'status_change',
    notificationType: 'status_change',
    enabled: true,
    recipients: [{ type: 'ticket_owner', label: 'Responsável pelo chamado' }],
    channels: { push: true, email: true },
    triggerEvents: ['on_status_change'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: 'Chamado #{{numero_chamado}} - Status alterado para {{status}}',
      body: `Olá {{nome_usuario}},

O status do chamado #{{numero_chamado}} foi alterado para {{status}}.

Título: {{titulo_chamado}}
Descrição: {{descricao}}

Acesse o sistema para mais detalhes:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  },
  ticket_created: {
    id: 'ticket_created',
    notificationType: 'ticket_created',
    enabled: true,
    recipients: [{ type: 'role', value: 'admin', label: 'Administradores' }],
    channels: { push: true, email: false },
    triggerEvents: ['on_create'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: 'Novo chamado criado: #{{numero_chamado}}',
      body: `Olá {{nome_usuario}},

Um novo chamado foi criado no sistema.

Chamado: #{{numero_chamado}}
Título: {{titulo_chamado}}
Criado por: {{criador}}
Prioridade: {{prioridade}}

Acesse o sistema:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  },
  ticket_assigned: {
    id: 'ticket_assigned',
    notificationType: 'ticket_assigned',
    enabled: true,
    recipients: [{ type: 'assigned_user', label: 'Usuário atribuído' }],
    channels: { push: true, email: true },
    triggerEvents: ['on_assign'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: 'Chamado #{{numero_chamado}} foi atribuído a você',
      body: `Olá {{nome_usuario}},

O chamado #{{numero_chamado}} foi atribuído a você.

Título: {{titulo_chamado}}
Prioridade: {{prioridade}}
Prazo: {{prazo_sla}}

Acesse o chamado:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  },
  comment_added: {
    id: 'comment_added',
    notificationType: 'comment_added',
    enabled: true,
    recipients: [
      { type: 'ticket_owner', label: 'Responsável pelo chamado' },
      { type: 'ticket_creator', label: 'Criador do chamado' }
    ],
    channels: { push: true, email: false },
    triggerEvents: ['on_comment'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: 'Novo comentário no chamado #{{numero_chamado}}',
      body: `Olá {{nome_usuario}},

Um novo comentário foi adicionado ao chamado #{{numero_chamado}}.

Comentário de: {{autor_comentario}}
{{conteudo_comentario}}

Ver comentário:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  },
  approval_needed: {
    id: 'approval_needed',
    notificationType: 'approval_needed',
    enabled: true,
    recipients: [{ type: 'role', value: 'manager', label: 'Gestores' }],
    channels: { push: true, email: true },
    triggerEvents: ['on_approval_request'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: 'Aprovação necessária - {{tipo_aprovacao}}',
      body: `Olá {{nome_usuario}},

Uma nova solicitação de aprovação requer sua atenção.

Tipo: {{tipo_aprovacao}}
Solicitante: {{solicitante}}
Detalhes: {{detalhes}}

Aprovar ou rejeitar:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  },
  sla_warning: {
    id: 'sla_warning',
    notificationType: 'sla_warning',
    enabled: true,
    recipients: [
      { type: 'ticket_owner', label: 'Responsável pelo chamado' },
      { type: 'role', value: 'manager', label: 'Gestores' }
    ],
    channels: { push: true, email: true },
    triggerEvents: ['on_sla_threshold'],
    delayInMinutes: 0,
    emailTemplate: {
      subject: '⚠️ Alerta SLA - Chamado #{{numero_chamado}}',
      body: `Olá {{nome_usuario}},

ATENÇÃO: O SLA do chamado #{{numero_chamado}} está próximo do vencimento!

Tempo restante: {{tempo_restante}}
Prazo: {{prazo_sla}}
Título: {{titulo_chamado}}

Acesse urgentemente:
{{link_sistema}}

Atenciosamente,
Equipe SmartCare`
    }
  }
};

const simulateDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const notificationSettingsService = {
  /**
   * Busca todas as configurações de notificações
   * @returns {Promise<Object>} Objeto com configurações por tipo
   */
  async fetchNotificationSettings() {
    await simulateDelay();
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Retorna configurações padrão na primeira vez
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSettings));
    return { ...defaultSettings };
  },

  /**
   * Atualiza configuração de um tipo específico
   * @param {string} notificationType - Tipo da notificação
   * @param {Object} data - Dados da configuração
   * @returns {Promise<Object>} Configuração atualizada
   */
  async updateNotificationSetting(notificationType, data) {
    await simulateDelay(200);
    
    const stored = localStorage.getItem(STORAGE_KEY);
    const settings = stored ? JSON.parse(stored) : { ...defaultSettings };
    
    settings[notificationType] = {
      ...settings[notificationType],
      ...data
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // TODO: Substituir por chamada real à API
    // await base44.entities.NotificationSetting.update(notificationType, data);
    
    return settings[notificationType];
  },

  /**
   * Restaura template padrão de um tipo
   * @param {string} notificationType - Tipo da notificação
   * @returns {Promise<Object>} Configuração padrão
   */
  async resetNotificationTemplate(notificationType) {
    await simulateDelay(150);
    
    const stored = localStorage.getItem(STORAGE_KEY);
    const settings = stored ? JSON.parse(stored) : {};
    
    settings[notificationType] = { ...defaultSettings[notificationType] };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // TODO: Substituir por chamada real à API
    // await base44.entities.NotificationSetting.reset(notificationType);
    
    return settings[notificationType];
  },

  /**
   * Valida variáveis do template de e-mail
   * @param {string} template - Template a ser validado
   * @returns {Array} Lista de variáveis encontradas
   */
  extractTemplateVariables(template) {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }
};