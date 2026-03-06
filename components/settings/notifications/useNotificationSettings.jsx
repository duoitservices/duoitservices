import { useContext } from 'react';
import { NotificationSettingsContext } from './NotificationSettingsContext';

/**
 * Hook customizado para configurações de notificações
 * Encapsula consumo do contexto
 * 
 * @returns {Object} Estado e funções de configuração
 * @throws {Error} Se usado fora do provider
 */
export function useNotificationSettings() {
  const context = useContext(NotificationSettingsContext);

  if (!context) {
    throw new Error(
      'useNotificationSettings deve ser usado dentro de NotificationSettingsProvider'
    );
  }

  return context;
}