import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TicketTypes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', active: true });
  
  const queryClient = useQueryClient();

  const { data: ticketTypes = [], isLoading } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => base44.entities.TicketType.list()
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TicketType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticketTypes']);
      setDialogOpen(false);
      resetForm();
      toast.success('Tipo de chamado criado com sucesso');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TicketType.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticketTypes']);
      setDialogOpen(false);
      resetForm();
      toast.success('Tipo de chamado atualizado com sucesso');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TicketType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticketTypes']);
      toast.success('Tipo de chamado excluído com sucesso');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', active: true });
    setEditingType(null);
  };

  const handleOpenDialog = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        active: type.active !== false
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (type) => {
    const isUsed = tickets.some(t => t.ticket_type === type.name);
    
    if (isUsed) {
      toast.error('Este tipo está vinculado a chamados. Desative-o ao invés de excluir.');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este tipo de chamado?')) {
      deleteMutation.mutate(type.id);
    }
  };

  const toggleActive = (type) => {
    updateMutation.mutate({
      id: type.id,
      data: { ...type, active: !type.active }
    });
  };

  if (isLoading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tipos de Chamados</h1>
          <p className="text-gray-600 mt-1">Gerencie os tipos de chamados ITIL</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ticketTypes.map((type) => {
          const isUsed = tickets.some(t => t.ticket_type === type.name);
          
          return (
            <Card key={type.id} className={!type.active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{type.name}</CardTitle>
                    {type.description && (
                      <CardDescription className="mt-2">{type.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(type)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(type)}
                      disabled={isUsed}
                    >
                      <Trash2 className={`w-4 h-4 ${isUsed ? 'text-gray-300' : 'text-red-500'}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={type.active !== false}
                      onCheckedChange={() => toggleActive(type)}
                    />
                    <Label>{type.active !== false ? 'Ativo' : 'Inativo'}</Label>
                  </div>
                  {isUsed && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      Em uso
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de Chamado' : 'Novo Tipo de Chamado'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingType ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}