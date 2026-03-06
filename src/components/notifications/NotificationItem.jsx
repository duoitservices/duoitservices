import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNotifications } from './useNotifications';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '../../utils';

/**
 * Componente NotificationItem
 * Representa uma notificação individual
 * Ao clicar, marca como lida
 */
export default function NotificationItem({ notification }) {
  const { markAsRead, closePanel } = useNotifications();
  const navigate = useNavigate();

  // Visual por prioridade
  const priorityConfig = {
    informativo: {
      icon: Info,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-l-blue-500',
      bgColor: 'bg-blue-50/30 dark:bg-blue-900/10'
    },
    atencao: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-l-yellow-500',
      bgColor: 'bg-yellow-50/30 dark:bg-yellow-900/10'
    },
    critico: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-l-red-500',
      bgColor: 'bg-red-50/30 dark:bg-red-900/10'
    }
  };

  const priority = notification.priority || 'informativo';
  const config = priorityConfig[priority] || priorityConfig.informativo;
  const Icon = config.icon;

  // Formata tempo relativo
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR
  });

  const handleClick = () => {
    console.log('Notificação clicada:', notification.id);
    
    // Marcar como lida
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Fechar painel
    console.log('Fechando painel...');
    closePanel();
    
    // Navegar se houver redirectUrl
    if (notification.redirectUrl) {
      let path = notification.redirectUrl;
      
      console.log('RedirectUrl original:', path);
      
      // Se for URL completa, extrair apenas o path
      if (path.startsWith('http')) {
        try {
          const url = new URL(path);
          path = url.pathname + url.search;
          console.log('Path extraído:', path);
        } catch (e) {
          console.error('Erro ao parsear URL:', e);
        }
      }
      
      // Navegar
      console.log('Navegando para:', path);
      navigate(path);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 cursor-pointer",
        "relative border-l-4",
        config.borderColor,
        !notification.read && config.bgColor,
        notification.read && "opacity-70"
      )}
    >
      <div className="flex gap-3">
        {/* Ícone com animação */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
          config.iconBg,
          !notification.read && "animate-pulse"
        )}>
          <Icon size={20} className={config.iconColor} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              "text-sm font-medium transition-colors",
              notification.read ? "text-gray-600 dark:text-gray-400" : "text-gray-900 dark:text-white"
            )}>
              {notification.title}
            </h4>
            
            {/* Indicador visual de não lida */}
            {!notification.read && (
              <div className={cn(
                "w-2 h-2 rounded-full flex-shrink-0 mt-1 animate-pulse",
                priority === 'critico' && "bg-red-500",
                priority === 'atencao' && "bg-yellow-500",
                priority === 'informativo' && "bg-blue-500"
              )} />
            )}
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1.5">
            {notification.description}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {timeAgo}
            </span>
            
            {/* Badge de agrupamento */}
            {notification.groupedCount > 1 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                +{notification.groupedCount - 1}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}