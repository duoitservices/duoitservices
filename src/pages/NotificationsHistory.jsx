import React, { useState } from 'react';
import { useNotifications } from '../components/notifications/useNotifications';
import { ArrowLeft, Info, AlertTriangle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createPageUrl } from '../utils';

/**
 * Página de Histórico de Notificações
 * Exibe notificações arquivadas com paginação
 */
export default function NotificationsHistory() {
  const { archivedNotifications } = useNotifications();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Paginação
  const totalPages = Math.ceil(archivedNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentNotifications = archivedNotifications.slice(startIndex, startIndex + itemsPerPage);

  // Visual por prioridade
  const priorityConfig = {
    informativo: {
      icon: Info,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-l-blue-500',
      label: '🔵 Informativo'
    },
    atencao: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-l-yellow-500',
      label: '🟡 Atenção'
    },
    critico: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-l-red-500',
      label: '🔴 Crítico'
    }
  };

  const handleNotificationClick = (notification) => {
    if (notification.redirectUrl) {
      let path = notification.redirectUrl;
      
      if (path.startsWith('http')) {
        try {
          const url = new URL(path);
          path = url.pathname + url.search;
        } catch (e) {
          console.error('Erro ao parsear URL:', e);
        }
      }
      
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft size={16} className="mr-2" />
            Voltar
          </Button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Histórico de Notificações
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {archivedNotifications.length} notificações arquivadas
          </p>
        </div>

        {/* Lista de Notificações Arquivadas */}
        {currentNotifications.length > 0 ? (
          <div className="space-y-3">
            {currentNotifications.map((notification) => {
              const priority = notification.priority || 'informativo';
              const config = priorityConfig[priority] || priorityConfig.informativo;
              const Icon = config.icon;
              
              const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
                locale: ptBR
              });

              return (
                <Card
                  key={notification.id}
                  className={cn(
                    "cursor-pointer hover:shadow-lg transition-all border-l-4",
                    config.borderColor
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {/* Ícone */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                        config.iconBg
                      )}>
                        <Icon size={20} className={config.iconColor} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </h4>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {config.label}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                          {notification.description}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>{timeAgo}</span>
                          {notification.archivedAt && (
                            <span>
                              • Arquivada {formatDistanceToNow(new Date(notification.archivedAt), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Nenhuma notificação arquivada
              </p>
            </CardContent>
          </Card>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-10"
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}