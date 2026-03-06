import React from 'react';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Zap } from 'lucide-react';

/**
 * Componente de configuração de gatilhos de notificação
 * Define quando a notificação deve ser disparada
 */
export default function NotificationTriggerConfig({ triggerEvents = [], onChange }) {
  const availableTriggers = [
    { value: 'on_create', label: 'Ao criar registro', description: 'Dispara quando um novo item é criado' },
    { value: 'on_update', label: 'Ao atualizar registro', description: 'Dispara em qualquer atualização' },
    { value: 'on_status_change', label: 'Ao mudar status', description: 'Dispara ao alterar o status' },
    { value: 'on_assign', label: 'Ao atribuir responsável', description: 'Dispara ao mudar o responsável' },
    { value: 'on_comment', label: 'Ao adicionar comentário', description: 'Dispara quando há novo comentário' },
    { value: 'on_approval_request', label: 'Ao solicitar aprovação', description: 'Dispara quando aprovação é necessária' },
    { value: 'on_sla_threshold', label: 'Ao atingir limite de SLA', description: 'Dispara quando SLA atinge percentual' }
  ];

  const handleToggle = (triggerValue, checked) => {
    if (checked) {
      onChange([...triggerEvents, triggerValue]);
    } else {
      onChange(triggerEvents.filter(t => t !== triggerValue));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-gray-600" />
        <Label className="text-sm font-medium">Momento do Disparo</Label>
      </div>

      <Card className="p-4">
        <div className="space-y-3">
          {availableTriggers.map(trigger => (
            <div key={trigger.value} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
              <Checkbox
                id={trigger.value}
                checked={triggerEvents.includes(trigger.value)}
                onCheckedChange={(checked) => handleToggle(trigger.value, checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <label
                  htmlFor={trigger.value}
                  className="text-sm font-medium cursor-pointer"
                >
                  {trigger.label}
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {trigger.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {triggerEvents.length === 0 && (
        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          ⚠️ Nenhum gatilho selecionado. A notificação não será disparada.
        </p>
      )}
    </div>
  );
}