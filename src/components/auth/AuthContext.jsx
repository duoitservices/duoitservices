import React, { createContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export const AuthContext = createContext();

/**
 * Provider de Autenticação
 * Gerencia estado global do usuário autenticado
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar usuário autenticado ao iniciar
  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      setLoading(true);
      
      // Buscar sessão local
      const sessionData = localStorage.getItem('app_user');
      
      console.log('🔐 [AuthContext] Buscando sessão local');
      
      if (!sessionData) {
        console.log('⚠️ [AuthContext] Nenhuma sessão encontrada no localStorage');
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      const session = JSON.parse(sessionData);
      console.log('📦 [AuthContext] Sessão encontrada:', { id: session.id, email: session.email });

      // Buscar dados completos do usuário na entidade SystemUser usando o ID
      const users = await base44.entities.SystemUser.filter({ id: session.id });
      
      console.log('👥 [AuthContext] Usuários encontrados:', users.length);
      
      if (users.length > 0) {
        const user = users[0];
        
        // Verificar se usuário ainda está ativo
        if (user.active === false) {
          console.log('⚠️ [AuthContext] Usuário inativo, limpando sessão');
          localStorage.removeItem('app_user');
          localStorage.removeItem('smartcare_email');
          setCurrentUser(null);
          setLoading(false);
          return;
        }
        
        console.log('✅ [AuthContext] Usuário carregado:', {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          position: user.position_name
        });
        setCurrentUser(user);
      } else {
        console.log('❌ [AuthContext] Usuário não encontrado, limpando sessão');
        localStorage.removeItem('app_user');
        localStorage.removeItem('smartcare_email');
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('💥 [AuthContext] Erro ao carregar usuário:', error);
      localStorage.removeItem('app_user');
      localStorage.removeItem('smartcare_email');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = useCallback(async (userId, data) => {
    try {
      await base44.entities.SystemUser.update(userId, data);
      await loadCurrentUser();
      return { success: true };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    console.log('🚪 [AuthContext] Fazendo logout');
    localStorage.removeItem('app_user');
    localStorage.removeItem('smartcare_email');
    localStorage.removeItem('smartcare_session'); // Compatibilidade
    setCurrentUser(null);
    window.location.href = '/Auth';
  }, []);

  const value = {
    currentUser,
    loading,
    updateUser,
    logout,
    refreshUser: loadCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}