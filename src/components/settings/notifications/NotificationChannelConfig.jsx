import React from 'react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Bell, Mail, Clock } from 'lucide-react';

/**
 * Componente de configuração de canais de notificação
 * Permite ativar/desativar Push e E-mail, com delay configurável
 */
export default function NotificationChannelConfig({ channels, delayInMinutes, onChange }) {
  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Canais de Notificação</Label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Push Notification */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Bell size={20} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Notificação Push</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Notificação no sistema
                </p>
              </div>
            </div>
            <Switch
              checked={channels?.push || false}
              onCheckedChange={(checked) => 
                onChange({ channels: { ...channels, push: checked }, delayInMinutes })
              }
            />
          </div>
        </Card>

        {/* Email Notification */}
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <Mail size={20} className="text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-sm">E-mail</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Notificação por e-mail
                </p>
              </div>
            </div>
            <Switch
              checked={channels?.email || false}
              onCheckedChange={(checked) => 
                onChange({ channels: { ...channels, email: checked }, delayInMinutes })
              }
            />
          </div>
        </Card>
      </div>

      {/* Delay Configuration */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Clock size={16} className="text-gray-600" />
          <Label className="text-sm">Atraso no Envio</Label>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            min="0"
            value={delayInMinutes || 0}
            onChange={(e) => onChange({ channels, delayInMinutes: parseInt(e.target.value) || 0 })}
            className="w-32"
          />
          <span className="text-sm text-gray-600">minutos</span>
          <span className="text-xs text-gray-500 ml-auto">
            {delayInMinutes === 0 ? 'Envio imediato' : `Aguardar ${delayInMinutes} min`}
          </span>
        </div>
      </Card>
    </div>
  );
}