import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Users } from 'lucide-react';

/**
 * Componente de configuração de destinatários
 * Permite selecionar múltiplos destinatários por tipo
 */
export default function NotificationRecipientConfig({ recipients = [], onChange }) {
  const [newRecipient, setNewRecipient] = useState({ type: '', value: '', label: '' });

  const recipientTypes = [
    { value: 'ticket_owner', label: 'Responsável pelo chamado' },
    { value: 'ticket_creator', label: 'Criador do chamado' },
    { value: 'assigned_user', label: 'Usuário atribuído' },
    { value: 'role', label: 'Perfil específico' },
    { value: 'user', label: 'Usuário específico' },
    { value: 'email', label: 'E-mail manual' }
  ];

  const roles = [
    { value: 'admin', label: 'Administradores' },
    { value: 'manager', label: 'Gestores' },
    { value: 'consultant', label: 'Consultores' },
    { value: 'partner', label: 'Parceiros' }
  ];

  const handleAdd = () => {
    if (!newRecipient.type) return;

    const recipient = {
      type: newRecipient.type,
      label: newRecipient.label || recipientTypes.find(r => r.value === newRecipient.type)?.label
    };

    if (newRecipient.type === 'role' || newRecipient.type === 'user' || newRecipient.type === 'email') {
      recipient.value = newRecipient.value;
    }

    onChange([...recipients, recipient]);
    setNewRecipient({ type: '', value: '', label: '' });
  };

  const handleRemove = (index) => {
    onChange(recipients.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <Users size={16} />
        <Label>Destinatários</Label>
      </div>

      {/* Lista de destinatários */}
      <div className="flex flex-wrap gap-2">
        {recipients.map((recipient, idx) => (
          <Badge key={idx} variant="secondary" className="px-3 py-1.5 flex items-center gap-2">
            <span>{recipient.label || recipient.type}</span>
            {recipient.value && (
              <span className="text-xs text-gray-500">({recipient.value})</span>
            )}
            <button
              onClick={() => handleRemove(idx)}
              className="hover:text-red-600 transition-colors"
            >
              <X size={14} />
            </button>
          </Badge>
        ))}
        {recipients.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum destinatário configurado</p>
        )}
      </div>

      {/* Formulário de adição */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select
            value={newRecipient.type}
            onValueChange={(value) => setNewRecipient({ type: value, value: '', label: '' })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {recipientTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Campo condicional baseado no tipo */}
        {newRecipient.type === 'role' && (
          <div>
            <Label className="text-xs">Perfil</Label>
            <Select
              value={newRecipient.value}
              onValueChange={(value) => {
                const role = roles.find(r => r.value === value);
                setNewRecipient({ ...newRecipient, value, label: role?.label });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(newRecipient.type === 'user' || newRecipient.type === 'email') && (
          <div>
            <Label className="text-xs">
              {newRecipient.type === 'email' ? 'E-mail' : 'ID do Usuário'}
            </Label>
            <Input
              type={newRecipient.type === 'email' ? 'email' : 'text'}
              placeholder={newRecipient.type === 'email' ? 'email@exemplo.com' : 'ID'}
              value={newRecipient.value}
              onChange={(e) => setNewRecipient({ ...newRecipient, value: e.target.value, label: e.target.value })}
              className="mt-1"
            />
          </div>
        )}

        <div className="flex items-end">
          <Button
            onClick={handleAdd}
            disabled={!newRecipient.type || (
              ['role', 'user', 'email'].includes(newRecipient.type) && !newRecipient.value
            )}
            className="w-full"
            size="sm"
          >
            <Plus size={16} className="mr-2" />
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}