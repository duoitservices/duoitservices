import React, { createContext, useState, useEffect, useCallback } from 'react';
import { notificationSettingsService } from './notificationSettingsService';
import { toast } from 'sonner';

export const NotificationSettingsContext = createContext();

/**
 * Provider de Configurações de Notificações
 * Gerencia estado global das configurações de notificações
 */
export function NotificationSettingsProvider({ children }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Carrega configurações ao montar
   */
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Busca configurações do serviço
   */
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationSettingsService.fetchNotificationSettings();
      setSettings(data);
    } catch (err) {
      setError(err.message);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualiza configuração de um tipo específico
   * @param {string} notificationType - Tipo da notificação
   * @param {Object} data - Dados da configuração
   */
  const updateSetting = useCallback(async (notificationType, data) => {
    try {
      const updated = await notificationSettingsService.updateNotificationSetting(
        notificationType,
        data
      );
      
      setSettings(prev => ({
        ...prev,
        [notificationType]: updated
      }));
      
      toast.success('Configuração salva com sucesso');
    } catch (err) {
      toast.error('Erro ao salvar configuração');
      throw err;
    }
  }, []);

  /**
   * Restaura template padrão
   * @param {string} notificationType - Tipo da notificação
   */
  const resetToDefault = useCallback(async (notificationType) => {
    try {
      const defaultSetting = await notificationSettingsService.resetNotificationTemplate(
        notificationType
      );
      
      setSettings(prev => ({
        ...prev,
        [notificationType]: defaultSetting
      }));
      
      toast.success('Template restaurado para o padrão');
    } catch (err) {
      toast.error('Erro ao restaurar template');
      throw err;
    }
  }, []);

  const value = {
    settings,
    loading,
    error,
    getSettings: loadSettings,
    updateSetting,
    resetToDefault
  };

  return (
    <NotificationSettingsContext.Provider value={value}>
      {children}
    </NotificationSettingsContext.Provider>
  );
}