import React, { useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useNotifications } from './useNotifications';
import NotificationPanel from './NotificationPanel';
import { cn } from "@/lib/utils";

/**
 * Componente NotificationBell
 * Ícone de sino com badge de notificações não lidas
 * Controla abertura/fechamento do painel de notificações
 */
export default function NotificationBell() {
  const { unreadCount, isPanelOpen, togglePanel, closePanel } = useNotifications();
  const panelRef = useRef(null);

  // Fecha o painel ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        closePanel();
      }
    }

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isPanelOpen, closePanel]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Botão do Sino */}
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/10 relative"
        onClick={togglePanel}
      >
        <Bell size={20} />
        
        {/* Badge de notificações não lidas */}
        {unreadCount > 0 && (
          <span className={cn(
            "absolute -top-1 -right-1 h-5 w-5 rounded-full",
            "bg-red-500 text-white text-xs font-bold",
            "flex items-center justify-center",
            "animate-in fade-in zoom-in duration-200"
          )}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Painel de Notificações */}
      {isPanelOpen && <NotificationPanel />}
    </div>
  );
}