import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Search, Unlock } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { toast } from 'sonner';

export default function Users() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [filterManager, setFilterManager] = useState('all');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    access_role_id: '',
    position_id: '',
    position_name: '',
    calendar_id: '',
    calendar_name: '',
    is_administrator: false,
    is_partner: false,
    is_collaborator: false,
    is_approver: false,
    is_manager: false,
    manager_email: '',
    manager_name: '',
    hourly_rate: 0,
    active: true
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.SystemUser.list('-created_date')
  });

  const { data: accessRoles = [] } = useQuery({
    queryKey: ['accessRoles'],
    queryFn: () => base44.entities.AccessRole.list('-created_date')
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => base44.entities.Position.list()
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list()
  });

  const validatePassword = (password) => {
    if (!password || password.length < 6) return false;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return hasLowercase && hasUppercase && hasNumber && hasSpecialChar;
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const createUser = useMutation({
    mutationFn: async (data) => {
      if (!validatePassword(data.password)) {
        throw new Error('A senha deve conter letra minúscula, maiúscula, número e caractere especial');
      }
      
      // Verificar se email já existe
      const existingUsers = await base44.entities.SystemUser.filter({ email: data.email });
      if (existingUsers.length > 0) {
        throw new Error('Este e-mail já está cadastrado');
      }
      
      // Validação de campos obrigatórios
      if (!data.access_role_id) throw new Error('Função de acesso é obrigatória');
      if (!data.position_id) throw new Error('Cargo é obrigatório');
      if (!data.calendar_id) throw new Error('Calendário é obrigatório');
      
      // Validação adicional para colaborador
      if (data.is_collaborator) {
        if (!data.hourly_rate || data.hourly_rate <= 0) throw new Error('Taxa/Hora é obrigatória para colaboradores');
      }
      
      // Criar usuário na base local
      const newUser = await base44.entities.SystemUser.create({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        access_role_id: data.access_role_id,
        position_id: data.position_id,
        position_name: data.position_name,
        calendar_id: data.calendar_id,
        calendar_name: data.calendar_name,
        is_administrator: data.is_administrator,
        is_partner: data.is_partner,
        is_collaborator: data.is_collaborator,
        is_approver: data.is_approver,
        is_manager: data.is_manager,
        manager_email: data.manager_email,
        manager_name: data.manager_name,
        hourly_rate: data.hourly_rate || 0,
        active: data.active
      });
      
      return newUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('Usuário criado com sucesso!');
      handleCloseDialog();
    },
    onError: (error) => toast.error(error.message || 'Erro ao criar usuário')
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data, currentUser }) => {
      // Validação de campos obrigatórios
      if (!data.access_role_id) throw new Error('Função de acesso é obrigatória');
      if (!data.position_id) throw new Error('Cargo é obrigatório');
      if (!data.calendar_id) throw new Error('Calendário é obrigatório');
      
      // Validação adicional para colaborador
      if (data.is_collaborator) {
        if (!data.hourly_rate || data.hourly_rate <= 0) throw new Error('Taxa/Hora é obrigatória para colaboradores');
      }
      
      const updateData = {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        access_role_id: data.access_role_id,
        position_id: data.position_id,
        position_name: data.position_name,
        calendar_id: data.calendar_id,
        calendar_name: data.calendar_name,
        is_administrator: data.is_administrator,
        is_partner: data.is_partner,
        is_collaborator: data.is_collaborator,
        is_approver: data.is_approver,
        is_manager: data.is_manager,
        manager_email: data.manager_email,
        manager_name: data.manager_name,
        hourly_rate: data.hourly_rate || 0,
        active: data.active
      };
      
      // Se uma nova senha foi fornecida, validar e atualizar
      if (data.password) {
        if (!validatePassword(data.password)) {
          throw new Error('A senha deve conter letra minúscula, maiúscula, número e caractere especial');
        }
        updateData.password = data.password;
      }
      
      return base44.entities.SystemUser.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('Usuário atualizado!');
      handleCloseDialog();
    },
    onError: (error) => toast.error(error.message || 'Erro ao atualizar usuário')
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingUser) {
      updateUser.mutate({ id: editingUser.id, data: formData, currentUser: editingUser });
    } else {
      createUser.mutate(formData);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      access_role_id: user.access_role_id || '',
      position_id: user.position_id || '',
      position_name: user.position_name || '',
      calendar_id: user.calendar_id || '',
      calendar_name: user.calendar_name || '',
      is_administrator: user.is_administrator || false,
      is_partner: user.is_partner || false,
      is_collaborator: user.is_collaborator || false,
      is_approver: user.is_approver || false,
      is_manager: user.is_manager || false,
      manager_email: user.manager_email || '',
      manager_name: user.manager_name || '',
      hourly_rate: user.hourly_rate || 0,
      active: user.active !== false
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      phone: '',
      access_role_id: '',
      position_id: '',
      position_name: '',
      calendar_id: '',
      calendar_name: '',
      is_administrator: false,
      is_partner: false,
      is_collaborator: false,
      is_approver: false,
      is_manager: false,
      manager_email: '',
      manager_name: '',
      hourly_rate: 0,
      active: true
    });
  };



  const grantFullAccess = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('grantFullAccessToUsers', {});
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['users']);
      toast.success(`${data.usersUpdated} usuários agora têm acesso total à plataforma!`);
    },
    onError: (error) => toast.error(error.message || 'Erro ao conceder acesso total')
  });

  const filteredUsers = users.filter(user => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const accessRoleId = user.access_role_id || '';
    
    const matchSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lastName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || accessRoleId === filterRole;
    const matchPartner = filterPartner === 'all' || (filterPartner === 'yes' ? user.is_partner : !user.is_partner);
    const matchPosition = filterPosition === 'all' || user.position_id === filterPosition;
    const matchManager = filterManager === 'all' || user.manager_email === filterManager;
    
    return matchSearch && matchRole && matchPartner && matchPosition && matchManager;
  });

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
          <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os usuários do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="bg-green-600 hover:bg-green-700"
            onClick={() => grantFullAccess.mutate()}
            disabled={grantFullAccess.isPending}
          >
            {grantFullAccess.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
            <Unlock size={16} className="mr-2" />
            Conceder Acesso Total
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2D1B69] hover:bg-[#2D1B69]/90" onClick={() => handleCloseDialog()}>
                <Plus size={16} className="mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                    className={!formData.first_name ? 'border-red-500' : ''}
                  />
                </div>
                <div>
                  <Label>Sobrenome <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                    className={!formData.last_name ? 'border-red-500' : ''}
                  />
                </div>
              </div>

              <div>
                <Label>E-mail <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  disabled={!!editingUser}
                  className={!formData.email ? 'border-red-500' : ''}
                />
              </div>

              <div>
                <Label>Senha {!editingUser && '*'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required={!editingUser}
                  placeholder={editingUser ? 'Deixe vazio para manter a senha atual' : 'Min. 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Deve conter: letra minúscula, maiúscula, número e caractere especial
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setFormData({...formData, phone: formatted});
                    }}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
                <div>
                  <Label>Função de acesso <span className="text-red-500">*</span></Label>
                  <Select value={formData.access_role_id} onValueChange={(v) => setFormData({...formData, access_role_id: v})}>
                    <SelectTrigger className={!formData.access_role_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent>
                      {accessRoles.map(role => (
                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cargo <span className="text-red-500">*</span></Label>
                  <Select 
                    value={formData.position_id} 
                    onValueChange={(v) => {
                      const position = positions.find(p => p.id === v);
                      setFormData({
                        ...formData, 
                        position_id: v,
                        position_name: position?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger className={!formData.position_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecione um cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions
                        .filter(p => p.active !== false)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(pos => (
                          <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Calendário <span className="text-red-500">*</span></Label>
                  <Select 
                    value={formData.calendar_id} 
                    onValueChange={(v) => {
                      const calendar = calendars.find(c => c.id === v);
                      setFormData({
                        ...formData, 
                        calendar_id: v,
                        calendar_name: calendar?.name || ''
                      });
                    }}
                  >
                    <SelectTrigger className={!formData.calendar_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Selecione um calendário" />
                    </SelectTrigger>
                    <SelectContent>
                     {calendars
                       .filter(c => c.active !== false && c.calendar_type === 'Colaborador')
                       .sort((a, b) => a.name.localeCompare(b.name))
                       .map(cal => (
                         <SelectItem key={cal.id} value={cal.id}>{cal.name}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_administrator}
                    onCheckedChange={(checked) => setFormData({...formData, is_administrator: checked})}
                  />
                  <Label>Administrador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_partner}
                    onCheckedChange={(checked) => setFormData({...formData, is_partner: checked})}
                  />
                  <Label>Parceiro</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_collaborator}
                    onCheckedChange={(checked) => setFormData({...formData, is_collaborator: checked})}
                  />
                  <Label>Colaborador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_approver}
                    onCheckedChange={(checked) => setFormData({...formData, is_approver: checked})}
                  />
                  <Label>Aprovador</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_manager}
                    onCheckedChange={(checked) => setFormData({...formData, is_manager: checked})}
                  />
                  <Label>Gestor</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                  />
                  <Label>Ativo</Label>
                </div>
              </div>

              <div>
                <Label>Gestor</Label>
                <Select 
                  value={formData.manager_email} 
                  onValueChange={(v) => {
                    const manager = users.find(u => u.email === v);
                    setFormData({
                      ...formData, 
                      manager_email: v,
                      manager_name: manager ? `${manager.first_name} ${manager.last_name}` : ''
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter(u => u.is_manager && u.active !== false)
                      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                      .map(user => (
                        <SelectItem key={user.email} value={user.email}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.is_collaborator && (
                <div>
                  <Label>Taxa/Hora (R$) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({...formData, hourly_rate: parseFloat(e.target.value) || 0})}
                    className={!formData.hourly_rate || formData.hourly_rate <= 0 ? 'border-red-500' : ''}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Buscar</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Função</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {accessRoles.map(role => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Parceiro</Label>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {positions
                    .filter(p => p.active !== false)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(pos => (
                      <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gestor</Label>
              <Select value={filterManager} onValueChange={setFilterManager}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users
                    .filter(u => u.is_manager && u.active !== false)
                    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
                    .map(user => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Usuários */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const role = accessRoles.find(r => r.id === user.access_role_id);
                  const userType = [];
                  if (user.is_partner) userType.push('Parceiro');
                  if (user.is_collaborator) userType.push('Colaborador');
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{role?.name || '-'}</TableCell>
                      <TableCell>{userType.length > 0 ? userType.join(', ') : '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(user)}
                        >
                          <Pencil size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}