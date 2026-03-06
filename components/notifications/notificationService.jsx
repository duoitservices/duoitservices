/**
 * Serviço de Notificações
 * Camada de abstração para comunicação com backend
 * Atualmente usa mock data, preparado para integração com API real
 */

// Mock data - 5 notificações de exemplo
const mockNotifications = [
  {
    id: 'notif-1',
    title: 'Novo chamado atribuído',
    description: 'Você foi atribuído ao chamado #1234 - Erro no sistema de vendas',
    createdAt: new Date(Date.now() - 21 * 60 * 1000).toISOString(), // 21 minutos atrás
    read: false,
    type: 'info'
  },
  {
    id: 'notif-2',
    title: 'SLA próximo do vencimento',
    description: 'O chamado #1230 está a 2 horas do vencimento do SLA de resposta',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
    read: false,
    type: 'warning'
  },
  {
    id: 'notif-3',
    title: 'Horas aprovadas',
    description: 'Suas 8 horas do dia 15/02 foram aprovadas pelo gestor',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 horas atrás
    read: true,
    type: 'success'
  },
  {
    id: 'notif-4',
    title: 'Nova mensagem no chamado',
    description: 'O parceiro respondeu no chamado #1228',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 dia atrás
    read: true,
    type: 'info'
  },
  {
    id: 'notif-5',
    title: 'Tarefa finalizada',
    description: 'A tarefa TK0045 foi marcada como finalizada',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 dias atrás
    read: true,
    type: 'success'
  }
];

// Simula delay de rede
const simulateDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export const notificationService = {
  /**
   * Busca todas as notificações do usuário
   * @returns {Promise<Array>} Lista de notificações
   */
  async getNotifications() {
    await simulateDelay();
    // TODO: Substituir por chamada real à API
    // return await base44.entities.Notification.list('-created_date');
    return [...mockNotifications];
  },

  /**
   * Marca uma notificação específica como lida
   * @param {string} id - ID da notificação
   * @returns {Promise<void>}
   */
  async markNotificationAsRead(id) {
    await simulateDelay(100);
    // TODO: Substituir por chamada real à API
    // return await base44.entities.Notification.update(id, { read: true });
    console.log(`Notificação ${id} marcada como lida`);
  },

  /**
   * Marca todas as notificações como lidas
   * @returns {Promise<void>}
   */
  async markAllNotificationsAsRead() {
    await simulateDelay(200);
    // TODO: Substituir por chamada real à API
    // const notifications = await base44.entities.Notification.filter({ read: false });
    // await Promise.all(notifications.map(n => base44.entities.Notification.update(n.id, { read: true })));
    console.log('Todas as notificações marcadas como lidas');
  },

  /**
   * Cria uma nova notificação
   * @param {Object} data - Dados da notificação
   * @returns {Promise<Object>} Notificação criada
   */
  async createNotification(data) {
    await simulateDelay(150);
    // TODO: Substituir por chamada real à API
    // return await base44.entities.Notification.create(data);
    const newNotification = {
      id: `notif-${Date.now()}`,
      ...data,
      createdAt: new Date().toISOString(),
      read: false
    };
    console.log('Nova notificação criada:', newNotification);
    return newNotification;
  }
};