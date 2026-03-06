import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

export default function PositionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true
  });
  
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: () => base44.entities.Position.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Position.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
      setDialogOpen(false);
      resetForm();
      toast.success('Cargo criado com sucesso');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Position.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
      setDialogOpen(false);
      resetForm();
      toast.success('Cargo atualizado com sucesso');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['positions']);
      toast.success('Cargo excluído com sucesso');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      active: true
    });
    setEditingPosition(null);
  };

  const handleOpenDialog = (position = null) => {
    if (position) {
      setEditingPosition(position);
      setFormData({
        name: position.name,
        description: position.description || '',
        active: position.active !== false
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingPosition) {
      updateMutation.mutate({ id: editingPosition.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (position) => {
    if (window.confirm('Tem certeza que deseja excluir este cargo?')) {
      deleteMutation.mutate(position.id);
    }
  };

  if (isLoading) {
    return <div className="p-8">Carregando...</div>;
  }

  const sortedPositions = [...positions].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cargos</h1>
          <p className="text-gray-600 mt-1">Gerencie os cargos dos colaboradores</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Cargo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedPositions.map((position) => (
          <Card key={position.id} className={!position.active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#2D1B69]" />
                  <CardTitle>{position.name}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(position)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(position)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600 space-y-1">
                {position.description && <p>{position.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-xs">
                    {position.active !== false ? 'Ativo' : 'Inativo'}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPosition ? 'Editar Cargo' : 'Novo Cargo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label>Ativo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPosition ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}