import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const statuses = ["Aguardando Atendimento", "Aguardando aprovação", "Aguardando teste", "Aguardando validação", "Em análise", "Em config. Desenv.", "Em estimativa", "Encaminhado para atendente", "Encaminhado para encerramento", "Encaminhado para solicitante", "Finalizado", "Paralisado"];

export default function TasksTab({ ticketId, ticket }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    module: '',
    ticket_type: '',
    status: 'Aguardando Atendimento',
    assigned_to: '',
    assigned_to_name: ''
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', ticketId],
    queryFn: () => base44.entities.Task.filter({ ticket_id: ticketId }, 'created_date'),
    enabled: !!ticketId
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.SystemUser.list(),
    staleTime: 5 * 60 * 1000 // 5 minutos
  });

  const taskCreators = React.useMemo(() => {
    const creators = {};
    tasks.forEach(task => {
      if (task.created_by) {
        const user = allUsers.find(u => u.email === task.created_by);
        if (user) {
          creators[task.id] = `${user.first_name} ${user.last_name}`.trim();
        }
      }
    });
    return creators;
  }, [tasks, allUsers]);

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const mods = await base44.entities.Module.list('name');
      return mods.filter(m => m.active !== false);
    }
  });

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: async () => {
      const types = await base44.entities.TicketType.list('name');
      return types.filter(t => t.active !== false);
    }
  });

  const { data: contract } = useQuery({
    queryKey: ['contract', ticket?.contract_id],
    queryFn: async () => {
      if (!ticket?.contract_id) return null;
      const contracts = await base44.entities.ServiceContract.filter({ id: ticket.contract_id });
      return contracts[0] || null;
    },
    enabled: !!ticket?.contract_id
  });

  const { data: collaborators = [] } = React.useMemo(() => {
    return allUsers.filter(u => u.is_collaborator && u.active !== false);
  }, [allUsers]);

  // Filtrar colaboradores que:
  // 1. Estão vinculados ao contrato do chamado com status ativo
  // 2. E são recursos (principal ou demais) no chamado
  const contractLinkedEmails = contract?.linked_users
    ?.filter(lu => lu.status === 'Ativa')
    .map(lu => lu.user_email?.toLowerCase().trim()) || [];
  
  const ticketResources = [
    ticket?.main_resource,
    ...(ticket?.other_resources || [])
  ].filter(Boolean);

  console.log('🔍 [TasksTab] Debug:', {
    contractId: ticket?.contract_id,
    contractLinkedEmails,
    ticketResources,
    totalCollaborators: collaborators.length
  });

  const availableCollaborators = collaborators.filter(c => {
    const collaboratorName = `${c.first_name} ${c.last_name}`;
    const collabEmail = c.email?.toLowerCase().trim();
    const isInContract = contractLinkedEmails.includes(collabEmail);
    const isTicketResource = ticketResources.includes(collaboratorName);
    return isInContract && isTicketResource;
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const sessionData = localStorage.getItem('app_user');
      if (!sessionData) return null;
      const session = JSON.parse(sessionData);
      const users = await base44.entities.SystemUser.filter({ id: session.id });
      return users[0] || null;
    }
  });

  const { data: lastTask } = useQuery({
    queryKey: ['lastTask'],
    queryFn: async () => {
      const allTasks = await base44.entities.Task.list('-created_date');
      return allTasks[0];
    }
  });

  const generateTaskNumber = () => {
    if (!lastTask) return 'TK0001';
    
    const lastNumber = parseInt(lastTask.task_number.replace('TK', ''));
    const newNumber = lastNumber + 1;
    return `TK${String(newNumber).padStart(4, '0')}`;
  };

  const createTask = useMutation({
    mutationFn: async (data) => {
      const taskNumber = generateTaskNumber();
      return base44.entities.Task.create({
        ...data,
        task_number: taskNumber,
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        partner: ticket.partner,
        partner_id: ticket.partner_id,
        category: ticket.category,
        created_by: currentUser?.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tasks', ticketId]);
      queryClient.invalidateQueries(['taskCreators']);
      queryClient.invalidateQueries(['lastTask']);
      toast.success('Tarefa criada com sucesso!');
      handleCloseDialog();
    },
    onError: () => toast.error('Erro ao criar tarefa')
  });

  const hasOpenTask = tasks.some(task => task.status !== 'Finalizado');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (hasOpenTask) {
      toast.error('Finalize a tarefa atual antes de criar uma nova');
      return;
    }
    
    if (!formData.module || !formData.ticket_type) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    if (formData.status !== 'Aguardando Atendimento' && !formData.assigned_to) {
      toast.error('Recurso é obrigatório para este status');
      return;
    }

    // Validar se o recurso está habilitado para atuar no chamado
    if (formData.assigned_to) {
      const assignedCollab = availableCollaborators.find(c => c.id === formData.assigned_to);
      if (!assignedCollab) {
        toast.error('Este usuário não está habilitado para atuar neste chamado.');
        return;
      }
    }

    createTask.mutate(formData);
  };

  const handleAssignedToChange = (collaboratorId) => {
    const collaborator = collaborators.find(c => c.id === collaboratorId);
    setFormData({
      ...formData,
      assigned_to: collaboratorId,
      assigned_to_name: collaborator ? `${collaborator.first_name} ${collaborator.last_name}` : ''
    });
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setFormData({
      title: '',
      description: '',
      module: '',
      ticket_type: '',
      status: 'Aguardando Atendimento',
      assigned_to: '',
      assigned_to_name: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Finalizado': 'bg-green-100 text-green-800',
      'Em análise': 'bg-blue-100 text-blue-800',
      'Aguardando Atendimento': 'bg-yellow-100 text-yellow-800',
      'Paralisado': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Tarefas do Chamado</h3>
            <p className="text-sm text-gray-500 mt-1">Gerencie as tarefas vinculadas a este chamado</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
              disabled={hasOpenTask}
            >
              <Plus size={16} className="mr-2" />
              Criar Tarefa
            </Button>
            
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Tarefa</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Módulo *</Label>
                    <Select 
                      value={formData.module} 
                      onValueChange={(value) => setFormData({ ...formData, module: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {modules.map(m => (
                          <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tipo *</Label>
                    <Select 
                      value={formData.ticket_type} 
                      onValueChange={(value) => setFormData({ ...formData, ticket_type: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ticketTypes.map(t => (
                          <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status *</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      Recurso {formData.status !== 'Aguardando Atendimento' && '*'}
                    </Label>
                    <Select 
                      value={formData.assigned_to} 
                      onValueChange={handleAssignedToChange}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCollaborators.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">
                            Nenhum recurso habilitado para este chamado
                          </div>
                        ) : (
                          availableCollaborators.map(c => (
                            <SelectItem key={c.id} value={c.id}>{`${c.first_name} ${c.last_name}`}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
                    disabled={createTask.isPending}
                  >
                    {createTask.isPending ? <Loader2 className="animate-spin" size={16} /> : 'Criar Tarefa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {hasOpenTask && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <p className="text-sm text-yellow-800">
              Existe uma tarefa em aberto. Finalize-a antes de criar uma nova.
            </p>
          </div>
        )}

        {tasks.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>Criado por</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow 
                  key={task.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => window.location.href = createPageUrl(`TaskDetails?id=${task.id}&ticket_id=${ticketId}`)}
                >
                  <TableCell className="font-mono text-sm">{task.task_number}</TableCell>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.module}</TableCell>
                  <TableCell>{task.ticket_type}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.assigned_to_name || '-'}</TableCell>
                  <TableCell>{taskCreators?.[task.id] || '-'}</TableCell>
                  <TableCell>{format(new Date(task.created_date), 'dd/MM/yyyy HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhuma tarefa criada ainda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}