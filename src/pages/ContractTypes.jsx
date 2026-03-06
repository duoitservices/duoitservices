import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ContractTypes() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true
  });

  const { data: contractTypes = [], isLoading } = useQuery({
    queryKey: ['contractTypes'],
    queryFn: () => base44.entities.ContractType.list('-created_date')
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['serviceContracts'],
    queryFn: () => base44.entities.ServiceContract.list()
  });

  const saveType = useMutation({
    mutationFn: async (data) => {
      if (editingType) {
        return base44.entities.ContractType.update(editingType.id, data);
      } else {
        return base44.entities.ContractType.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contractTypes']);
      toast.success(editingType ? 'Tipo atualizado!' : 'Tipo criado!');
      handleCloseDialog();
    },
    onError: () => toast.error('Erro ao salvar tipo')
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, active }) => {
      return base44.entities.ContractType.update(id, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contractTypes']);
      toast.success('Status atualizado!');
    }
  });

  const handleOpenDialog = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        active: type.active
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        description: '',
        active: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingType(null);
    setFormData({
      name: '',
      description: '',
      active: true
    });
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error('O nome é obrigatório');
      return;
    }
    saveType.mutate(formData);
  };

  const handleToggleStatus = (type) => {
    const hasContracts = contracts.some(c => c.contract_type_id === type.id);
    
    if (!type.active) {
      // Reativando - sempre permitir
      toggleStatus.mutate({ id: type.id, active: true });
    } else {
      // Desativando
      if (hasContracts) {
        toast.warning('Este tipo está vinculado a contratos. Desativando para impedir uso futuro.');
      }
      toggleStatus.mutate({ id: type.id, active: false });
    }
  };

  const filteredTypes = contractTypes.filter(t =>
    !searchTerm || 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Tipos de Contratos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie os tipos de contratos</p>
        </div>
        <Button 
          className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
          onClick={() => handleOpenDialog()}
        >
          <Plus size={16} className="mr-2" />
          Novo Tipo
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Input
              placeholder="Buscar tipos de contratos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
                      Nenhum tipo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{type.description || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={type.active ? "default" : "secondary"}>
                          {type.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleOpenDialog(type)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(type)}
                          >
                            <Switch checked={type.active} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de Contrato' : 'Novo Tipo de Contrato'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Nome do tipo de contrato"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Descrição do tipo"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm">{formData.active ? 'Ativo' : 'Inativo'}</span>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={saveType.isPending}
              >
                {saveType.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}