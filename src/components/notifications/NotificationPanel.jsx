import React, { useState } from 'react';
import { CheckCheck, Archive, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from './useNotifications';
import NotificationItem from './NotificationItem';
import { cn } from "@/lib/utils";
import { createPageUrl } from '../../utils';

/**
 * Componente NotificationPanel
 * Painel dropdown que exibe lista de notificações
 * Permite marcar todas como lidas e rolar pela lista
 */
export default function NotificationPanel() {
  const { notifications, markAllAsRead, unreadCount, archivedNotifications, clearAllNotifications } = useNotifications();
  const [filter, setFilter] = useState('todas');

  // Filtrar notificações
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'todas') return true;
    if (filter === 'nao_lidas') return !n.read;
    return n.priority === filter;
  });

  return (
    <div className={cn(
      "absolute right-0 top-12 w-[360px] bg-white dark:bg-gray-800",
      "rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700",
      "animate-in fade-in slide-in-from-top-2 duration-200",
      "z-50"
    )}>
      {/* Cabeçalho */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Notificações
            </h3>
            {unreadCount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
              </p>
            )}
          </div>
          
          <Button
            size="sm"
            onClick={markAllAsRead}
            className="text-xs gap-1.5 h-8 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <CheckCheck size={14} />
            Marcar como lidas
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => setFilter('todas')}
            className={cn(
              "h-7 text-xs px-2",
              filter === 'todas'
                ? "bg-[#2D1B69] text-white hover:bg-[#2D1B69]/90"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Todas
          </Button>
          <Button
            size="sm"
            onClick={() => setFilter('nao_lidas')}
            className={cn(
              "h-7 text-xs px-2",
              filter === 'nao_lidas'
                ? "bg-[#2D1B69] text-white hover:bg-[#2D1B69]/90"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Não lidas
          </Button>
          <Button
            size="sm"
            onClick={() => setFilter('informativo')}
            className={cn(
              "h-7 text-xs px-2",
              filter === 'informativo'
                ? "bg-[#2D1B69] text-white hover:bg-[#2D1B69]/90"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Informativo
          </Button>
          <Button
            size="sm"
            onClick={() => setFilter('atencao')}
            className={cn(
              "h-7 text-xs px-2",
              filter === 'atencao'
                ? "bg-[#2D1B69] text-white hover:bg-[#2D1B69]/90"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Atenção
          </Button>
          <Button
            size="sm"
            onClick={() => setFilter('critico')}
            className={cn(
              "h-7 text-xs px-2",
              filter === 'critico'
                ? "bg-[#2D1B69] text-white hover:bg-[#2D1B69]/90"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            )}
          >
            Crítico
          </Button>
        </div>
      </div>

      {/* Lista de Notificações */}
      <ScrollArea className="h-[350px]">
        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredNotifications.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
              />
            ))}
          </div>
        ) : (
          // Estado vazio
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <CheckCheck size={32} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {filter === 'todas' ? 'Você não possui notificações' : 'Nenhuma notificação neste filtro'}
            </p>
          </div>
        )}
      </ScrollArea>
      
      {/* Footer com contador e link para histórico */}
      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {notifications.length}/10 notificações
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-transparent"
            onClick={clearAllNotifications}
            title="Limpar todas as notificações"
          >
            <X size={14} />
          </Button>
        </div>
        
        {archivedNotifications.length > 0 && (
          <Link
            to={createPageUrl('NotificationsHistory')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Archive size={12} />
            Ver histórico ({archivedNotifications.length})
          </Link>
        )}
      </div>
    </div>
  );
}