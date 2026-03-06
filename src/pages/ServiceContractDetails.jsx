import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Save, Plus, X, Search, Calendar, Clock, TrendingUp, CheckCircle2, AlertCircle, Pause, Play, Edit, Eye, Trash2, Send } from 'lucide-react';
import ContractSLATab from '../components/contracts/ContractSLATab';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

export default function ServiceContractDetails() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get('id');
  const viewMode = searchParams.get('view') === 'true';

  const [formData, setFormData] = useState({
    contract_id: '',
    name: '',
    description: '',
    partner_id: '',
    partner_name: '',
    manager_email: '',
    manager_name: '',
    start_date: '',
    end_date: '',
    contract_type: 'Horas',
    status: 'Ativo',
    baseline_hours: 0,
    hours_per_ticket: 0,
    normal_hour_rate: 0,
    excess_hour_rate: 0,
    exception_hour_rate: 0,
    warning_hour_rate: 0,
    linked_users: [],
    consumed_hours: 0,
    active: true,
    audit_log: [],
    calendar_id: '',
    calendar_name: ''
  });

  const [userDialog, setUserDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [allocatedHours, setAllocatedHours] = useState(0);
  const [editUserDialog, setEditUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editAllocatedHours, setEditAllocatedHours] = useState(0);
  const [editUserStatus, setEditUserStatus] = useState('Ativa');
  const [ticketFilters, setTicketFilters] = useState({
    ticketNumber: '',
    status: '',
    mainResource: '',
    manager: '',
    ticketType: '',
    module: ''
  });

  const { data: contract, isLoading: contractLoading } = useQuery({
    queryKey: ['serviceContract', contractId],
    queryFn: () => base44.entities.ServiceContract.filter({ id: contractId }),
    enabled: !!contractId,
    select: (data) => data[0]
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['systemUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  const { data: contractTypes = [] } = useQuery({
    queryKey: ['contractTypes'],
    queryFn: () => base44.entities.ContractType.list()
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list()
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list()
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const session = localStorage.getItem('app_user');
      if (session) {
        const userData = JSON.parse(session);
        return userData;
      }
      return null;
    }
  });

  const managerUsers = users.filter(u => u.is_manager === true);
  const activeContractTypes = contractTypes.filter(ct => ct.active === true);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Closure.delete(id),
    onSuccess: () => {
      toast.success('Fechamento excluído com sucesso!');
      queryClient.invalidateQueries(['closures']);
      setDeleteDialog({ open: false, closureId: null });
    },
    onError: () => {
      toast.error('Erro ao excluir fechamento');
    }
  });

  const sendToPartnerMutation = useMutation({
    mutationFn: async (closure) => {
      const partners = await base44.entities.Partner.filter({ id: closure.partner_id });
      const partner = partners[0];

      if (!partner || !partner.manager) {
        throw new Error('Gestor do parceiro não encontrado');
      }

      await base44.entities.Closure.update(closure.id, {
        status: 'Aguardando aprovação',
        sent_to_partner_at: new Date().toISOString(),
        sent_by: (await base44.auth.me()).email
      });

      await base44.integrations.Core.SendEmail({
        to: partner.manager,
        subject: `Fechamento de Horas - ${closure.month}`,
        body: `
Prezado(a) gestor(a),

Um novo fechamento de horas está disponível para aprovação:

Mês: ${closure.month}
Contrato: ${closure.contract_name}
Total de Horas: ${closure.total_hours.toFixed(2)}h
Valor Total: R$ ${closure.total_value.toFixed(2)}

Por favor, acesse o sistema para revisar e aprovar o fechamento.

Atenciosamente,
DuoIT Services
        `
      });
    },
    onSuccess: () => {
      toast.success('Fechamento enviado ao parceiro!');
      queryClient.invalidateQueries(['closures']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao enviar fechamento');
    }
  });

  const handleDelete = (closure) => {
    if (closure.status === 'Aguardando aprovação') {
      toast.error('Não é possível excluir um fechamento que está aguardando aprovação.');
      return;
    }
    if (closure.status === 'Aprovado') {
      toast.error('Não é possível excluir um fechamento já aprovado.');
      return;
    }
    setDeleteDialog({ open: true, closureId: closure.id });
  };

  const confirmDelete = () => {
    if (deleteDialog.closureId) {
      deleteMutation.mutate(deleteDialog.closureId);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Aguardando revisão': 'bg-yellow-100 text-yellow-800',
      'Aguardando aprovação': 'bg-blue-100 text-blue-800',
      'Aprovado': 'bg-green-100 text-green-800',
      'Rejeitado': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status] || ''}>
        {status}
      </Badge>
    );
  };

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list()
  });

  const { data: closures = [] } = useQuery({
    queryKey: ['closures', contractId, formData.partner_id],
    queryFn: () => base44.entities.Closure.list('-created_date'),
    enabled: !!contractId,
    select: (data) => data.filter(c => 
      c.contract_id === formData.contract_id && 
      c.partner_id === formData.partner_id
    )
  });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, closureId: null });

  useEffect(() => {
    if (contract) {
      // Auto-suspend if end_date has passed
      const autoSuspend = (() => {
        if (!contract.end_date || contract.status === 'Suspenso') return contract;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const endDate = new Date(contract.end_date); endDate.setHours(0, 0, 0, 0);
        if (endDate < today && contract.status === 'Ativo') {
          base44.entities.ServiceContract.update(contract.id, { status: 'Suspenso' });
          return { ...contract, status: 'Suspenso' };
        }
        return contract;
      })();
      setFormData(autoSuspend);
    }
  }, [contract]);

  const saveContract = useMutation({
    mutationFn: async (data) => {
      // Validar ID único
      if (!contractId) {
        const existingContracts = await base44.entities.ServiceContract.filter({ contract_id: data.contract_id });
        if (existingContracts.length > 0) {
          throw new Error('Já existe um contrato cadastrado com este ID. Informe um código único.');
        }
      }
      
      if (contractId) {
        return base44.entities.ServiceContract.update(contractId, data);
      } else {
        return base44.entities.ServiceContract.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['serviceContracts']);
      toast.success(contractId ? 'Contrato atualizado!' : 'Contrato criado!');
      navigate(createPageUrl('ServiceContracts'));
    },
    onError: (error) => toast.error(error.message || 'Erro ao salvar contrato')
  });

  const handleSave = () => {
    if (!formData.contract_id) {
      toast.error('O ID do Contrato é obrigatório');
      return;
    }
    if (!formData.name) {
      toast.error('O nome do contrato é obrigatório');
      return;
    }
    if (!formData.description) {
      toast.error('A descrição do contrato é obrigatória');
      return;
    }
    if (!formData.manager_email) {
      toast.error('O Gestor do contrato é obrigatório');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error('As datas inicial e final são obrigatórias');
      return;
    }
    if (!formData.contract_type) {
      toast.error('O tipo de contrato é obrigatório');
      return;
    }
    if (!formData.calendar_id) {
      toast.error('O calendário é obrigatório');
      return;
    }
    // Validar total de horas alocadas vs baseline
    if (formData.baseline_hours > 0) {
      const totalAllocated = (formData.linked_users || []).reduce((sum, u) => sum + (u.allocated_hours || 0), 0);
      if (totalAllocated > formData.baseline_hours) {
        toast.error(`O total de horas alocadas (${totalAllocated}h) não pode ser maior que o baseline (${formData.baseline_hours}h).`);
        return;
      }
    }
    saveContract.mutate(formData);
  };

  const handleAddUsers = () => {
    if (selectedUsers.length === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }
    
    const newUsers = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      return {
        user_email: user.email,
        user_name: `${user.first_name} ${user.last_name}`,
        allocated_hours: allocatedHours,
        status: 'Ativa',
        allocation_history: [{
          date: new Date().toISOString(),
          action: 'Vinculação',
          previous_hours: 0,
          new_hours: allocatedHours,
          previous_status: null,
          new_status: 'Ativa',
          changed_by: currentUser?.email || 'Sistema'
        }]
      };
    });

    setFormData({
      ...formData,
      linked_users: [...formData.linked_users, ...newUsers]
    });

    setUserDialog(false);
    setSelectedUsers([]);
    setAllocatedHours(0);
    setUserSearchTerm('');
    toast.success(`${newUsers.length} usuário(s) vinculado(s)`);
  };

  const handleRemoveUser = (email) => {
    if (viewMode) {
      toast.error('Não é possível desvincular usuários no modo de visualização.');
      return;
    }
    // Verificar se há horas apontadas para este usuário no contrato
    const userHours = timeEntries.filter(te => 
      te.user_email === email && 
      contractTickets.some(ct => ct.id === te.ticket_id)
    );
    
    if (userHours.length > 0) {
      toast.error('Não é possível desvincular este usuário pois já existem horas apontadas neste contrato.');
      return;
    }

    setFormData({
      ...formData,
      linked_users: formData.linked_users.filter(u => u.user_email !== email)
    });
    toast.success('Usuário desvinculado com sucesso!');
  };

  const handleToggleUserStatus = (email) => {
    if (viewMode) {
      toast.error('Não é possível alterar o status de alocação no modo de visualização.');
      return;
    }
    const updatedUsers = formData.linked_users.map(u => {
      if (u.user_email === email) {
        const newStatus = u.status === 'Ativa' ? 'Pausada' : 'Ativa';
        return {
          ...u,
          status: newStatus,
          allocation_history: [
            ...(u.allocation_history || []),
            {
              date: new Date().toISOString(),
              action: newStatus === 'Pausada' ? 'Pausar alocação' : 'Reativar alocação',
              previous_status: u.status,
              new_status: newStatus,
              changed_by: currentUser?.email || 'Sistema'
            }
          ]
        };
      }
      return u;
    });

    setFormData({
      ...formData,
      linked_users: updatedUsers
    });
    toast.success(updatedUsers.find(u => u.user_email === email).status === 'Pausada' ? 'Alocação pausada!' : 'Alocação reativada!');
  };

  const handleEditUser = (user) => {
    if (viewMode) {
      toast.error('Não é possível editar alocações no modo de visualização.');
      return;
    }
    setEditingUser(user);
    setEditAllocatedHours(user.allocated_hours);
    setEditUserStatus(user.status || 'Ativa');
    setEditUserDialog(true);
  };

  const handleSaveEditUser = () => {
    // Validar total de horas alocadas vs baseline
    if (formData.baseline_hours > 0) {
      const totalAllocated = formData.linked_users.reduce((sum, u) => {
        if (u.user_email === editingUser.user_email) return sum + (editAllocatedHours || 0);
        return sum + (u.allocated_hours || 0);
      }, 0);
      if (totalAllocated > formData.baseline_hours) {
        toast.error('Total de horas dos usuários vinculados é maior que o Baseline indicado');
        return;
      }
    }
    const updatedUsers = formData.linked_users.map(u => {
      if (u.user_email === editingUser.user_email) {
        return {
          ...u,
          allocated_hours: editAllocatedHours,
          status: editUserStatus,
          allocation_history: [
            ...(u.allocation_history || []),
            {
              date: new Date().toISOString(),
              action: 'Edição de alocação',
              previous_hours: u.allocated_hours,
              new_hours: editAllocatedHours,
              previous_status: u.status,
              new_status: editUserStatus,
              changed_by: currentUser?.email || 'Sistema'
            }
          ]
        };
      }
      return u;
    });

    setFormData({
      ...formData,
      linked_users: updatedUsers
    });

    setEditUserDialog(false);
    setEditingUser(null);
    toast.success('Alocação atualizada com sucesso!');
  };

  const filteredUsers = users.filter(u => 
    !formData.linked_users.some(lu => lu.user_email === u.email) &&
    (!userSearchTerm || 
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearchTerm.toLowerCase()))
  );

  const contractTickets = tickets.filter(t => t.contract_id === contractId);
  
  console.log('Contract ID:', contractId);
  console.log('All tickets:', tickets.length);
  console.log('Contract tickets:', contractTickets.length);
  
  const filteredTickets = contractTickets.filter(t => {
    const matchNumber = !ticketFilters.ticketNumber || t.ticket_number?.toString().includes(ticketFilters.ticketNumber);
    const matchStatus = !ticketFilters.status || t.status === ticketFilters.status;
    const matchResource = !ticketFilters.mainResource || t.main_resource === ticketFilters.mainResource;
    const matchManager = !ticketFilters.manager || t.manager === ticketFilters.manager;
    const matchType = !ticketFilters.ticketType || t.ticket_type === ticketFilters.ticketType;
    const matchModule = !ticketFilters.module || t.module === ticketFilters.module;
    
    return matchNumber && matchStatus && matchResource && matchManager && matchType && matchModule;
  });

  const openTickets = contractTickets.filter(t => t.status !== 'Finalizado' && t.status !== 'Encaminhado para encerramento').length;
  const closedTickets = contractTickets.filter(t => t.status === 'Finalizado' || t.status === 'Encaminhado para encerramento').length;

  const totalConsumedHours = (() => {
    const contractTicketIds = contractTickets.map(t => t.id);
    return timeEntries
      .filter(te => contractTicketIds.includes(te.ticket_id))
      .reduce((sum, te) => sum + (te.total_hours || 0), 0);
  })();

  const hoursProgress = formData.baseline_hours > 0 ? (totalConsumedHours / formData.baseline_hours) * 100 : 0;
  
  const totalDays = formData.start_date && formData.end_date ? 
    differenceInDays(new Date(formData.end_date), new Date(formData.start_date)) : 0;
  const elapsedDays = formData.start_date ? 
    differenceInDays(new Date(), new Date(formData.start_date)) : 0;
  const timeProgress = totalDays > 0 ? Math.min((elapsedDays / totalDays) * 100, 100) : 0;

  if (contractLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('ServiceContracts'))}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {contractId ? (viewMode ? 'Visualizar Contrato' : 'Editar Contrato') : 'Novo Contrato'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {contractId ? (viewMode ? 'Visualização do contrato' : 'Edite as informações do contrato') : 'Preencha os dados do novo contrato'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('ServiceContracts'))}>
            {viewMode ? 'Voltar' : 'Cancelar'}
          </Button>
          {!viewMode && (
            <Button 
              className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
              onClick={handleSave}
              disabled={saveContract.isPending}
            >
              {saveContract.isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-2" />
                  Salvar
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          {contractId && <TabsTrigger value="data">Dados do Contrato</TabsTrigger>}
          {contractId && <TabsTrigger value="closures">Controle de fechamentos</TabsTrigger>}
          {contractId && <TabsTrigger value="sla">SLA</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          {/* Formulário 1 - Informações do Contrato */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                   value={formData.name}
                   onChange={(e) => setFormData({...formData, name: e.target.value})}
                   placeholder="Nome do contrato"
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID do Contrato *</Label>
                  <Input
                   value={formData.contract_id}
                   onChange={(e) => setFormData({...formData, contract_id: e.target.value})}
                   placeholder="Ex: CTR-2024-001"
                   disabled={!!contractId || viewMode}
                  />
                  {contractId && (
                    <p className="text-xs text-gray-500">O ID do contrato não pode ser alterado após a criação</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição *</Label>
                <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({...formData, description: e.target.value})}
                 placeholder="Descrição detalhada do contrato"
                 rows={3}
                 disabled={viewMode}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Parceiro</Label>
                  <Select 
                    value={formData.partner_id || ''} 
                    onValueChange={(v) => {
                      const partner = partners.find(p => p.id === v);
                      setFormData({
                        ...formData, 
                        partner_id: v || null,
                        partner_name: partner?.name || ''
                      });
                    }}
                    disabled={viewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o parceiro (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum parceiro</SelectItem>
                      {partners.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gestor do Contrato *</Label>
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
                    disabled={viewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gestor" />
                    </SelectTrigger>
                    <SelectContent>
                      {managerUsers.map(u => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select 
                    value={formData.contract_type_id || ''} 
                    onValueChange={(v) => {
                      const type = contractTypes.find(ct => ct.id === v);
                      setFormData({
                        ...formData, 
                        contract_type_id: v,
                        contract_type: type?.name || ''
                      });
                    }}
                    disabled={viewMode}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeContractTypes.map(ct => (
                        <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Calendário <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.calendar_id || ''}
                  onValueChange={(v) => {
                    const cal = calendars.find(c => c.id === v);
                    setFormData({ ...formData, calendar_id: cal ? cal.id : '', calendar_name: cal?.name || '' });
                  }}
                  disabled={viewMode}
                >
                  <SelectTrigger className={!formData.calendar_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione o calendário" />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.filter(c => c.active !== false).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial *</Label>
                  <Input
                   type="date"
                   value={formData.start_date}
                   onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Final *</Label>
                  <Input
                   type="date"
                   value={formData.end_date}
                   onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                    disabled={viewMode}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Em aprovação">Em aprovação</SelectItem>
                      <SelectItem value="Encerrado">Encerrado</SelectItem>
                      <SelectItem value="Suspenso">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formulário 2 - Informações de Cobrança */}
          <Card>
            <CardHeader>
              <CardTitle>Informações de Cobrança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total de horas (Baseline)</Label>
                  <Input
                   type="number"
                   value={formData.baseline_hours}
                   onChange={(e) => setFormData({...formData, baseline_hours: parseFloat(e.target.value) || 0})}
                   placeholder="0"
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total de horas por chamado</Label>
                  <Input
                   type="number"
                   value={formData.hours_per_ticket}
                   onChange={(e) => setFormData({...formData, hours_per_ticket: parseFloat(e.target.value) || 0})}
                   placeholder="0"
                   disabled={viewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor hora normal (R$)</Label>
                  <Input
                   type="number"
                   value={formData.normal_hour_rate}
                   onChange={(e) => setFormData({...formData, normal_hour_rate: parseFloat(e.target.value) || 0})}
                   placeholder="0.00"
                   step="0.01"
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor hora excedente (R$)</Label>
                  <Input
                   type="number"
                   value={formData.excess_hour_rate}
                   onChange={(e) => setFormData({...formData, excess_hour_rate: parseFloat(e.target.value) || 0})}
                   placeholder="0.00"
                   step="0.01"
                   disabled={viewMode}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor hora exceção (R$)</Label>
                  <Input
                   type="number"
                   value={formData.exception_hour_rate}
                   onChange={(e) => setFormData({...formData, exception_hour_rate: parseFloat(e.target.value) || 0})}
                   placeholder="0.00"
                   step="0.01"
                   disabled={viewMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor hora aviso (R$)</Label>
                  <Input
                   type="number"
                   value={formData.warning_hour_rate}
                   onChange={(e) => setFormData({...formData, warning_hour_rate: parseFloat(e.target.value) || 0})}
                   placeholder="0.00"
                   step="0.01"
                   disabled={viewMode}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formulário 3 - Usuários Vinculados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
              Usuários Vinculados
              {!viewMode && (
              <Dialog open={userDialog} onOpenChange={setUserDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus size={16} className="mr-2" />
                    Vincular usuário
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[600px] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Selecionar Usuários</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <Input
                          placeholder="Buscar por nome ou e-mail..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedUsers(filteredUsers.map(u => u.id))}
                        >
                          Marcar todos
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedUsers([])}
                        >
                          Desmarcar todos
                        </Button>
                      </div>

                      <div className="border rounded-lg max-h-64 overflow-y-auto">
                        {filteredUsers.map(user => (
                          <div key={user.id} className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{user.first_name} {user.last_name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <Label>Horas de alocação</Label>
                        <Input
                          type="number"
                          value={allocatedHours}
                          onChange={(e) => setAllocatedHours(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                        {selectedUsers.length > 1 && (
                          <p className="text-sm text-amber-600">
                            ⚠️ As horas informadas serão aplicadas individualmente para cada usuário vinculado.
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setUserDialog(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddUsers}>
                          Adicionar ({selectedUsers.length})
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {formData.linked_users.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhum usuário vinculado
                </p>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Horas Alocadas</TableHead>
                        <TableHead>Horas Consumidas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.linked_users.map((user, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{user.user_name}</TableCell>
                          <TableCell>{user.user_email}</TableCell>
                          <TableCell>{user.allocated_hours}h</TableCell>
                          <TableCell>
                            {(() => {
                              const userTickets = contractTickets.map(t => t.id);
                              const consumed = timeEntries.filter(te => te.user_email === user.user_email && userTickets.includes(te.ticket_id)).reduce((sum, te) => sum + (te.total_hours || 0), 0);
                              return <span className={consumed > user.allocated_hours ? 'text-red-500 font-semibold' : ''}>{consumed.toFixed(2)}h</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.status === 'Ativa' ? 'default' : 'secondary'}>
                              {user.status || 'Ativa'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                           {!viewMode && (
                           <div className="flex justify-end gap-1">
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => handleToggleUserStatus(user.user_email)}
                               title={user.status === 'Ativa' ? 'Pausar alocação' : 'Reativar alocação'}
                             >
                               {user.status === 'Ativa' ? (
                                 <Pause size={14} className="text-orange-500" />
                               ) : (
                                 <Play size={14} className="text-green-500" />
                               )}
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => handleEditUser(user)}
                               title="Editar alocação"
                             >
                               <Edit size={14} className="text-blue-500" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => handleRemoveUser(user.user_email)}
                               title="Desvincular"
                             >
                               <X size={14} className="text-red-500" />
                             </Button>
                           </div>
                           )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog para Editar Usuário */}
          <Dialog open={editUserDialog} onOpenChange={setEditUserDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Alocação</DialogTitle>
              </DialogHeader>
              {editingUser && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Usuário</p>
                    <p className="font-medium">{editingUser.user_name}</p>
                    <p className="text-sm text-gray-500">{editingUser.user_email}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Horas de alocação</Label>
                    <Input
                      type="number"
                      value={editAllocatedHours}
                      onChange={(e) => setEditAllocatedHours(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status da alocação</Label>
                    <Select value={editUserStatus} onValueChange={setEditUserStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativa">Ativa</SelectItem>
                        <SelectItem value="Pausada">Pausada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditUserDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSaveEditUser}>
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          {/* Mini Dashboards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Chamados</p>
                    <p className="text-2xl font-bold">{contractTickets.length}</p>
                  </div>
                  <AlertCircle className="text-blue-500" size={32} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Data Inicial</p>
                    <p className="text-lg font-bold">
                      {formData.start_date ? format(new Date(formData.start_date), 'dd/MM/yy') : '-'}
                    </p>
                  </div>
                  <Calendar className="text-green-500" size={32} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Data Final</p>
                    <p className="text-lg font-bold">
                      {formData.end_date ? format(new Date(formData.end_date), 'dd/MM/yy') : '-'}
                    </p>
                  </div>
                  <Calendar className="text-red-500" size={32} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className="mt-1">{formData.status}</Badge>
                  </div>
                  <TrendingUp className="text-purple-500" size={32} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Abertos</p>
                    <p className="text-2xl font-bold text-orange-500">{openTickets}</p>
                  </div>
                  <AlertCircle className="text-orange-500" size={32} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Encerrados</p>
                    <p className="text-2xl font-bold text-green-500">{closedTickets}</p>
                  </div>
                  <CheckCircle2 className="text-green-500" size={32} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Progresso */}
          <Card>
            <CardHeader>
              <CardTitle>Progresso do Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Consumo de Horas</span>
                  <span className="text-sm text-gray-500">
                    {totalConsumedHours.toFixed(2)}h / {formData.baseline_hours}h ({hoursProgress.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={hoursProgress} className="h-3" />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Tempo Decorrido</span>
                  <span className="text-sm text-gray-500">
                    {elapsedDays} / {totalDays} dias ({timeProgress.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={timeProgress} className="h-3" />
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={20} className="text-blue-500" />
                  <span className="font-medium">Indicador Combinado</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {hoursProgress > timeProgress + 10 ? (
                    <span className="text-red-500">⚠️ Consumo de horas acima do esperado para o período</span>
                  ) : hoursProgress < timeProgress - 10 ? (
                    <span className="text-green-500">✓ Consumo de horas abaixo do ritmo esperado</span>
                  ) : (
                    <span className="text-blue-500">→ Consumo de horas dentro do esperado</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Chamados */}
          <Card>
            <CardHeader>
              <CardTitle>Chamados Vinculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Input
                  placeholder="Nº Chamado"
                  value={ticketFilters.ticketNumber}
                  onChange={(e) => setTicketFilters({...ticketFilters, ticketNumber: e.target.value})}
                />
                <Select value={ticketFilters.status} onValueChange={(v) => setTicketFilters({...ticketFilters, status: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    <SelectItem value="Aguardando Atendimento">Aguardando Atendimento</SelectItem>
                    <SelectItem value="Em análise">Em análise</SelectItem>
                    <SelectItem value="Finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Recurso Principal"
                  value={ticketFilters.mainResource}
                  onChange={(e) => setTicketFilters({...ticketFilters, mainResource: e.target.value})}
                />
                <Input
                  placeholder="Gestor"
                  value={ticketFilters.manager}
                  onChange={(e) => setTicketFilters({...ticketFilters, manager: e.target.value})}
                />
                <Input
                  placeholder="Tipo"
                  value={ticketFilters.ticketType}
                  onChange={(e) => setTicketFilters({...ticketFilters, ticketType: e.target.value})}
                />
                <Input
                  placeholder="Módulo"
                  value={ticketFilters.module}
                  onChange={(e) => setTicketFilters({...ticketFilters, module: e.target.value})}
                />
              </div>

              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Gestor</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Módulo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          Nenhum chamado vinculado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets.map(ticket => (
                        <TableRow key={ticket.id}>
                          <TableCell>{ticket.ticket_number}</TableCell>
                          <TableCell>{ticket.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ticket.status}</Badge>
                          </TableCell>
                          <TableCell>{ticket.main_resource || '-'}</TableCell>
                          <TableCell>{ticket.manager || '-'}</TableCell>
                          <TableCell>{ticket.ticket_type || '-'}</TableCell>
                          <TableCell>{ticket.module || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="closures" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fechamentos Gerados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead>Total Horas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.map((closure) => (
                    <TableRow key={closure.id}>
                      <TableCell>{closure.month}</TableCell>
                      <TableCell>{closure.partner_name}</TableCell>
                      <TableCell>{closure.contract_name}</TableCell>
                      <TableCell>{closure.total_hours.toFixed(2)}h</TableCell>
                      <TableCell>R$ {closure.total_value.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(closure.status)}</TableCell>
                      <TableCell>
                        {format(new Date(closure.created_date), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(createPageUrl('ClosureDetails') + `?id=${closure.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {closure.status === 'Aguardando revisão' && (
                            <Button
                              size="sm"
                              onClick={() => sendToPartnerMutation.mutate(closure)}
                              disabled={sendToPartnerMutation.isPending}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDelete(closure)}
                                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {closures.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nenhum fechamento gerado ainda
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla">
          <ContractSLATab
            contractId={contractId}
            partnerId={formData.partner_id}
            partnerName={formData.partner_name}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja excluir este fechamento? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, closureId: null })}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}