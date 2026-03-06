import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const menuPermissions = [
  { id: 'consultor_novo_chamado', label: 'Área do Consultor - Novo chamado', category: 'Área do Consultor', page: 'NewTicket' },
  { id: 'consultor_meus_chamados', label: 'Área do Consultor - Meus chamados', category: 'Área do Consultor', page: 'MyTickets' },
  { id: 'consultor_meu_dashboard', label: 'Área do Consultor - Meu dashboard', category: 'Área do Consultor', page: 'MyDashboard' },
  { id: 'consultor_gestao_horas', label: 'Área do Consultor - Gestão de Horas', category: 'Área do Consultor', page: 'TimeManagement' },
  { id: 'consultor_apontamento_horas', label: 'Área do Consultor - Acompanhamento mensal', category: 'Área do Consultor', page: 'TimeEntry' },
  { id: 'gestor_dashboards', label: 'Área do Gestor - Dashboards', category: 'Área do Gestor', page: 'Dashboards' },
  { id: 'gestor_relatorios', label: 'Área do Gestor - Relatórios', category: 'Área do Gestor', page: 'Reports' },
  { id: 'gestor_lista_chamados', label: 'Área do Gestor - Lista de chamados', category: 'Área do Gestor', page: 'AllTickets' },
  { id: 'gestor_fechamentos', label: 'Área do Gestor - Fechamentos', category: 'Área do Gestor', page: 'Fechamentos' },
  { id: 'admin_usuarios', label: 'Administração - Usuários', category: 'Administração', page: 'Users' },
  { id: 'admin_colaboradores', label: 'Administração - Colaboradores', category: 'Administração', page: 'Collaborators' },
  { id: 'admin_parceiros', label: 'Administração - Parceiros', category: 'Administração', page: 'Partners' },
  { id: 'admin_contratos', label: 'Administração - Contratos de serviço', category: 'Administração', page: 'ServiceContracts' },
  { id: 'config_tipo_chamados', label: 'Configurações - Tipo de chamados', category: 'Configurações', page: 'TicketTypes' },
  { id: 'config_modulos', label: 'Configurações - Módulos', category: 'Configurações', page: 'Modules' },
  { id: 'config_calendario', label: 'Configurações - Calendário', category: 'Configurações', page: 'Calendar' },
  { id: 'config_cargos', label: 'Configurações - Cargos', category: 'Configurações', page: 'Positions' },
  { id: 'config_funcoes_acesso', label: 'Configurações - Funções de acesso', category: 'Configurações', page: 'AccessRoles' },
  { id: 'config_sla', label: 'Configurações - SLA', category: 'Configurações', page: 'SLA' }
];

export default function AccessRoles() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {},
    partner_ids: []
  });

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['accessRoles'],
    queryFn: () => base44.entities.AccessRole.list('-created_date')
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list('name')
  });

  const createRole = useMutation({
    mutationFn: (data) => base44.entities.AccessRole.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['accessRoles']);
      toast.success('Função criada com sucesso!');
      handleCloseDialog();
    },
    onError: () => toast.error('Erro ao criar função')
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AccessRole.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['accessRoles']);
      toast.success('Função atualizada!');
      handleCloseDialog();
    },
    onError: () => toast.error('Erro ao atualizar função')
  });

  const deleteRole = useMutation({
    mutationFn: (id) => base44.entities.AccessRole.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['accessRoles']);
      toast.success('Função excluída!');
    },
    onError: () => toast.error('Erro ao excluir função')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingRole) {
      updateRole.mutate({ id: editingRole.id, data: formData });
    } else {
      createRole.mutate(formData);
    }
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name || '',
      description: role.description || '',
      permissions: role.permissions || {},
      partner_ids: role.partner_ids || []
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      permissions: {},
      partner_ids: []
    });
  };

  const handlePermissionChange = (permissionId, checked) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permissionId]: checked
      }
    });
  };

  const groupedPermissions = menuPermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {});

  const handlePartnerToggle = (partnerId) => {
    const newPartnerIds = formData.partner_ids.includes(partnerId)
      ? formData.partner_ids.filter(id => id !== partnerId)
      : [...formData.partner_ids, partnerId];
    setFormData({ ...formData, partner_ids: newPartnerIds });
  };

  const filteredRoles = roles.filter(role =>
    role.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-bold text-gray-800">Funções de Acesso</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie as funções e permissões de acesso ao sistema</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2D1B69] hover:bg-[#2D1B69]/90" onClick={() => handleCloseDialog()}>
              <Plus size={16} className="mr-2" />
              Nova Função
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRole ? 'Editar Função' : 'Nova Função'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nome da Função *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <Label className="text-lg font-semibold mb-4 block">Permissões de Acesso</Label>
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, perms]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm mb-3 text-[#2D1B69]">{category}</h3>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <div key={perm.id} className="flex items-center gap-2">
                            <Checkbox
                              id={perm.id}
                              checked={formData.permissions[perm.id] || false}
                              onCheckedChange={(checked) => handlePermissionChange(perm.id, checked)}
                            />
                            <label htmlFor={perm.id} className="text-sm cursor-pointer">
                              {perm.label.split(' - ')[1]}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-lg font-semibold mb-4 block">Parceiros com Acesso</Label>
                <p className="text-sm text-gray-500 mb-3">Selecione os parceiros que o usuário poderá acessar</p>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {partners.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum parceiro cadastrado</p>
                  ) : (
                    <div className="space-y-2">
                      {partners.map((partner) => (
                        <div key={partner.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`partner-${partner.id}`}
                            checked={formData.partner_ids.includes(partner.id)}
                            onCheckedChange={() => handlePartnerToggle(partner.id)}
                          />
                          <label htmlFor={`partner-${partner.id}`} className="text-sm cursor-pointer">
                            {partner.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
                  {editingRole ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Buscar função de acesso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Funções */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Função</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Parceiros</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.map((role) => {
              const permissionCount = Object.values(role.permissions || {}).filter(Boolean).length;
              const partnerCount = (role.partner_ids || []).length;
              
              return (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} className="text-[#2D1B69]" />
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-gray-600 truncate">
                      {role.description || '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {permissionCount} permissões
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {partnerCount === 0 ? 'Todos' : `${partnerCount} parceiro${partnerCount > 1 ? 's' : ''}`}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(role)}>
                        <Pencil size={14} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          if (confirm('Deseja excluir esta função?')) {
                            deleteRole.mutate(role.id);
                          }
                        }}
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        {filteredRoles.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500">Nenhuma função encontrada</p>
          </div>
        )}
      </Card>
    </div>
  );
}