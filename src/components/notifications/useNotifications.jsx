import { useContext } from 'react';
import { NotificationContext } from './NotificationContext';

/**
 * Hook customizado para acessar o contexto de notificações
 * Encapsula a lógica de consumo do contexto
 * 
 * @returns {Object} Objeto contendo estado e funções de notificações
 * @throws {Error} Se usado fora do NotificationProvider
 */
export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotifications deve ser usado dentro de um NotificationProvider'
    );
  }

  return context;
}