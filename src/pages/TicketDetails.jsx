import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerTicketStatusChanged, triggerCommentAdded } from '../components/notifications/notificationEngine';
import { AuthContext } from '../components/auth/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  MessageSquare, 
  Clock, 
  Paperclip, 
  Send, 
  User, 
  Calendar,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  Lock,
  Download,
  EyeOff,
  Image as ImageIcon,
  Users,
  Plus,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  FileEdit,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import TasksTab from '../components/tickets/TasksTab';
import PartnerHistoryComponent from '../components/tickets/PartnerHistory';

const statuses = ["Aguardando Atendimento", "Aguardando aprovação", "Aguardando teste", "Aguardando validação", "Em análise", "Em config. Desenv.", "Em estimativa", "Encaminhado para atendente", "Encaminhado para encerramento", "Encaminhado para solicitante", "Finalizado", "Paralisado"];
const attachmentTypes = ["Evidência do erro", "Evidência do teste", "Detalhamento", "Especificação"];

const getSLAColor = (percentage) => {
  if (percentage <= 70) return 'bg-green-500';
  if (percentage <= 85) return 'bg-yellow-500';
  if (percentage <= 96) return 'bg-orange-500';
  return 'bg-red-500';
};

const calculateSLAPercentage = (deadline, opened) => {
  if (!deadline || !opened) return 0;
  const now = new Date();
  const openedDate = new Date(opened);
  const deadlineDate = new Date(deadline);
  const total = deadlineDate - openedDate;
  const elapsed = now - openedDate;
  const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return Math.round(percentage);
};

export default function TicketDetails() {
  const { currentUser, loading: authLoading } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get('id');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', ticketId],
    queryFn: () => base44.entities.Task.filter({ ticket_id: ticketId }),
    enabled: !!ticketId
  });

  const [messageContent, setMessageContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [showTimeEntry, setShowTimeEntry] = useState(false);
  const [timeEntryData, setTimeEntryData] = useState({ date: '', start_time: '', end_time: '' });
  const [attachmentType, setAttachmentType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [hidePrivate, setHidePrivate] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const messagesPerPage = 10;
  const [pastedImages, setPastedImages] = useState([]);
  const [viewImage, setViewImage] = useState(null);
  const [pendingTimeEntry, setPendingTimeEntry] = useState(null);

  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => base44.entities.Ticket.filter({ id: ticketId }).then(t => t[0]),
    enabled: !!ticketId
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['ticketMessages', ticketId],
    queryFn: () => base44.entities.TicketMessage.filter({ ticket_id: ticketId }, 'created_date'),
    enabled: !!ticketId
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['ticketTimeEntries', ticketId],
    queryFn: () => base44.entities.TimeEntry.filter({ ticket_id: ticketId }, 'date'),
    enabled: !!ticketId
  });

  const { data: ticketContract } = useQuery({
    queryKey: ['ticketContract', ticket?.contract_id],
    queryFn: () => base44.entities.ServiceContract.filter({ id: ticket.contract_id }).then(r => r[0]),
    enabled: !!ticket?.contract_id
  });

  const { data: contractCalendar } = useQuery({
    queryKey: ['contractCalendar', ticketContract?.calendar_id],
    queryFn: () => base44.entities.WorkCalendar.filter({ id: ticketContract.calendar_id }).then(r => r[0]),
    enabled: !!ticketContract?.calendar_id
  });

  const { data: allContractTimeEntries = [] } = useQuery({
    queryKey: ['contractTimeEntries', ticket?.contract_id],
    queryFn: async () => {
      const contractTickets = await base44.entities.Ticket.filter({ contract_id: ticket.contract_id });
      const ticketIds = contractTickets.map(t => t.id);
      const allEntries = await base44.entities.TimeEntry.list();
      return allEntries.filter(e => ticketIds.includes(e.ticket_id));
    },
    enabled: !!ticket?.contract_id
  });



  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ticket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketId]);
      toast.success('Chamado atualizado!');
    }
  });

  const createMessage = useMutation({
    mutationFn: (data) => base44.entities.TicketMessage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticketMessages', ticketId]);
      setMessageContent('');
      setIsPrivate(false);
      toast.success('Mensagem enviada!');
    }
  });

  const createTimeEntry = useMutation({
    mutationFn: async (data) => {
      await base44.entities.TimeEntry.create(data);
      const newLoggedHours = (ticket.logged_hours || 0) + data.total_hours;
      await base44.entities.Ticket.update(ticketId, { logged_hours: newLoggedHours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketId]);
      toast.success('Apontamento registrado!');
    }
  });

  const handleStatusChange = async (newStatus) => {
    const now = new Date().toISOString();
    const previousStatus = ticket.status;
    
    const statusHistory = [...(ticket.status_history || []), {
      status: newStatus,
      changed_at: now,
      changed_by: currentUser?.email
    }];
    
    const updateData = { status: newStatus, status_history: statusHistory };
    
    if (newStatus !== 'Aguardando Atendimento' && !ticket.first_response_at) {
      updateData.first_response_at = now;
      updateData.sla_response_met = new Date() <= new Date(ticket.sla_response_deadline);
    }
    
    if (newStatus === 'Finalizado') {
      updateData.closed_at = now;
      updateData.sla_solution_met = new Date() <= new Date(ticket.sla_solution_deadline);
    }
    
    updateTicket.mutate({ id: ticketId, data: updateData });
    
    // Disparar notificação de mudança de status
    triggerTicketStatusChanged({
      ticketId: ticketId,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      previousStatus: previousStatus,
      newStatus: newStatus,
      targetUserName: (() => {
        const user = allUsers.find(u => u.email === ticket.created_by);
        return user ? `${user.first_name} ${user.last_name}` : 'Usuário';
      })(),
      systemLink: window.location.href
    });
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() && !pendingTimeEntry) return;
    
    // Update status if changed
    if (newStatus && newStatus !== ticket.status) {
      await handleStatusChange(newStatus);
    }
    
    // Post time entry if exists
    if (pendingTimeEntry) {
      await createTimeEntry.mutateAsync(pendingTimeEntry);
      
      // Combinar dados do apontamento com mensagem digitada
      let fullContent = `Data do apontamento: ${format(new Date(pendingTimeEntry.date), 'dd/MM/yyyy')} - Total apontado: ${pendingTimeEntry.total_hours.toFixed(2)}h`;
      
      if (messageContent.trim()) {
        fullContent += `\n\n${messageContent}`;
      }
      
      await createMessage.mutateAsync({
        ticket_id: ticketId,
        content: fullContent,
        is_private: true,
        is_time_entry: true,
        time_entry_data: pendingTimeEntry,
        author_name: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Usuário',
        author_email: currentUser?.email
      });
      
      setPendingTimeEntry(null);
    } else if (messageContent.trim()) {
      // Post message with typed content only if no time entry
      await createMessage.mutateAsync({
        ticket_id: ticketId,
        content: messageContent,
        is_private: isPrivate,
        is_time_entry: false,
        author_name: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Usuário',
        author_email: currentUser?.email
      });
      
      // Disparar notificação de comentário (somente se não for privada)
      if (!isPrivate) {
        triggerCommentAdded({
          ticketId: ticketId,
          ticketNumber: ticket.ticket_number,
          ticketTitle: ticket.title,
          commentAuthor: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Usuário',
          commentContent: messageContent.substring(0, 100),
          targetUserName: (() => {
            const user = allUsers.find(u => u.email === ticket.created_by);
            return user ? `${user.first_name} ${user.last_name}` : 'Usuário';
          })(),
          systemLink: window.location.href
        });
      }
    }
    
    setNewStatus('');
  };

  const toggleMessagePrivacy = async (messageId, currentPrivacy) => {
    await base44.entities.TicketMessage.update(messageId, { is_private: !currentPrivacy });
    queryClient.invalidateQueries(['ticketMessages', ticketId]);
    toast.success(`Mensagem marcada como ${!currentPrivacy ? 'privada' : 'pública'}`);
  };

  const handleTimeEntry = async () => {
    if (!timeEntryData.date || !timeEntryData.start_time || !timeEntryData.end_time) {
      toast.error('Preencha todos os campos');
      return;
    }

    // Restrições de calendário do contrato
    if (contractCalendar && timeEntryData.date) {
      const eDate = new Date(timeEntryData.date + 'T00:00:00');
      const dow = eDate.getDay();
      const dNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const dLabels = {sunday:'Domingo',monday:'Segunda-feira',tuesday:'Terça-feira',wednesday:'Quarta-feira',thursday:'Quinta-feira',friday:'Sexta-feira',saturday:'Sábado'};
      const hol = contractCalendar.holidays?.find(h => h.date === timeEntryData.date);
      if (hol) { toast.error(`Bloqueado: ${hol.name || 'Feriado'} em ${format(eDate,'dd/MM/yyyy')}. Feriados do contrato não permitem apontamentos.`,{duration:7000}); return; }
      if (!contractCalendar.work_hours?.[dNames[dow]]?.enabled) { toast.error(`Bloqueado: ${dLabels[dNames[dow]]} não é dia de trabalho no calendário do contrato.`,{duration:7000}); return; }
    }

    // Verificar se o contrato está ativo e dentro do prazo
    if (ticketContract) {
      if (ticketContract.status !== 'Ativo') {
        toast.error(`Apontamento bloqueado: o contrato está com status "${ticketContract.status}".`, { duration: 6000 });
        return;
      }
      if (ticketContract.end_date) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const endDate = new Date(ticketContract.end_date); endDate.setHours(0, 0, 0, 0);
        if (endDate < today) {
          toast.error('Apontamento bloqueado: a data final do contrato foi atingida. Contato o gestor para atualizar o contrato.', { duration: 6000 });
          return;
        }
      }
    }

    // Verificar se o usuário é recurso principal ou demais recursos
    const collaboratorName = currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Usuário';
    const isMainResource = ticket.main_resource === collaboratorName;
    const isOtherResource = ticket.other_resources?.includes(collaboratorName);

    if (!isMainResource && !isOtherResource) {
      toast.error('Você não está atribuído como recurso neste chamado', { duration: 5000 });
      return;
    }

    const start = new Date(`${timeEntryData.date}T${timeEntryData.start_time}`);
    const end = new Date(`${timeEntryData.date}T${timeEntryData.end_time}`);
    const totalHours = (end - start) / (1000 * 60 * 60);

    if (totalHours <= 0) {
      toast.error('Hora final deve ser maior que hora inicial');
      return;
    }

    // Validação 1: Verificar baseline do contrato
    if (ticketContract && ticketContract.baseline_hours > 0) {
      const totalConsumedInContract = allContractTimeEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0);
      if (totalConsumedInContract + totalHours > ticketContract.baseline_hours) {
        const remaining = ticketContract.baseline_hours - totalConsumedInContract;
        toast.error(
          `Limite do contrato atingido! O contrato possui ${ticketContract.baseline_hours}h no total, com ${totalConsumedInContract.toFixed(2)}h já consumidas. Saldo restante: ${remaining.toFixed(2)}h.`,
          { duration: 7000 }
        );
        return;
      }
    }

    // Validação 2: Verificar limite de horas do usuário no contrato
    if (ticketContract && currentUser?.email) {
      const linkedUser = ticketContract.linked_users?.find(lu => lu.user_email === currentUser.email);
      if (linkedUser && linkedUser.allocated_hours > 0) {
        const userConsumedInContract = allContractTimeEntries
          .filter(e => e.user_email === currentUser.email)
          .reduce((sum, e) => sum + (e.total_hours || 0), 0);
        if (userConsumedInContract + totalHours > linkedUser.allocated_hours) {
          const remaining = linkedUser.allocated_hours - userConsumedInContract;
          toast.error(
            `Limite de horas do usuário atingido! Você possui ${linkedUser.allocated_hours}h alocadas no contrato, com ${userConsumedInContract.toFixed(2)}h já consumidas. Saldo restante: ${remaining.toFixed(2)}h.`,
            { duration: 7000 }
          );
          return;
        }
      }
    }

    // Validação de sobreposição de horário
    const userEntriesOnDay = await base44.entities.TimeEntry.filter({
      user_email: currentUser.email,
      date: timeEntryData.date
    });

    const newStart = new Date(`${timeEntryData.date}T${timeEntryData.start_time}`);
    const newEnd = new Date(`${timeEntryData.date}T${timeEntryData.end_time}`);

    const overlapping = userEntriesOnDay.filter(e => {
      if ((e.total_hours || 0) <= 0) return false; // ignorar estornos
      const eStart = new Date(`${e.date}T${e.start_time}`);
      const eEnd = new Date(`${e.date}T${e.end_time}`);
      return newStart < eEnd && newEnd > eStart;
    });

    if (overlapping.length > 0) {
      const conflict = overlapping[0];
      toast.error(
        `Já existe um apontamento neste horário (${conflict.start_time} - ${conflict.end_time}) no chamado #${conflict.ticket_number}.`,
        { duration: 6000 }
      );
      return;
    }

    const entryData = {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      ticket_title: ticket.title,
      partner: ticket.partner,
      date: timeEntryData.date,
      start_time: timeEntryData.start_time,
      end_time: timeEntryData.end_time,
      total_hours: totalHours,
      user_email: currentUser?.email,
      user_name: collaboratorName || 'Não identificado'
    };

    setPendingTimeEntry(entryData);
    setShowTimeEntry(false);
    setTimeEntryData({ date: '', start_time: '', end_time: '' });
    toast.success('Apontamento salvo! Será enviado ao postar a mensagem.');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleFileAttach = async () => {
    if (!selectedFile) return;
    if (!attachmentType) {
      toast.error('Selecione o tipo do anexo');
      return;
    }

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const attachments = [...(ticket.attachments || []), { url: file_url, name: selectedFile.name, type: attachmentType }];
      await updateTicket.mutateAsync({ id: ticketId, data: { attachments } });
      
      // Add link to message content
      const fileLink = `\n[📎 ${selectedFile.name}](${file_url})`;
      setMessageContent(prev => prev + fileLink);
      
      setSelectedFile(null);
      setAttachmentType('');
      toast.success('Anexo adicionado!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        
        setIsUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
          const attachments = [...(ticket.attachments || []), { url: file_url, name: `imagem-${Date.now()}.png`, type: 'Evidência do erro' }];
          await updateTicket.mutateAsync({ id: ticketId, data: { attachments } });
          
          setPastedImages(prev => [...prev, file_url]);
          const imageLink = `\n[IMG:${file_url}]`;
          setMessageContent(prev => prev + imageLink);
          
          toast.success('Imagem anexada!');
        } catch (error) {
          toast.error('Erro ao anexar imagem');
        } finally {
          setIsUploading(false);
        }
        break;
      }
    }
  };

  const handleSendMessageWithImage = async () => {
    await handleSendMessage();
    setPastedImages([]);
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  const getCreatorName = () => {
    const email = ticket?.requester_email || ticket?.created_by;
    const creator = allUsers.find(u => u.email === email);
    return creator ? `${creator.first_name} ${creator.last_name}` : '';
  };

  const getCreatorManager = () => {
    const email = ticket?.requester_email || ticket?.created_by;
    const creator = allUsers.find(u => u.email === email);
    if (!creator || !creator.manager_email) return null;
    
    const manager = allUsers.find(u => u.email === creator.manager_email);
    return manager ? {
      name: `${manager.first_name} ${manager.last_name}`,
      email: manager.email
    } : null;
  };

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const partnerData = partners.find(p => p.id === ticket?.partner_id || p.name === ticket?.partner);
  const partnerManager = partnerData?.manager || '-';

  const getUserBackgroundColor = (userEmail) => {
    const user = allUsers.find(u => u.email === userEmail);
    if (!user) return 'bg-gray-50';
    
    // Determina cor com base no tipo de usuário
    if (user.is_collaborator && !user.is_partner) return 'bg-blue-50';
    if (user.is_partner) return 'bg-yellow-50';
    return 'bg-gray-50';
  };

  const calculateTimeEntryTotal = () => {
    if (!timeEntryData.start_time || !timeEntryData.end_time || !timeEntryData.date) return '0.00';
    const start = new Date(`${timeEntryData.date}T${timeEntryData.start_time}`);
    const end = new Date(`${timeEntryData.date}T${timeEntryData.end_time}`);
    const hours = (end - start) / (1000 * 60 * 60);
    return hours > 0 ? hours.toFixed(2) : '0.00';
  };

  if (authLoading || ticketLoading || !ticket) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-600">Erro: Usuário não autenticado</p>
      </div>
    );
  }

  const slaResponse = calculateSLAPercentage(ticket.sla_response_deadline, ticket.opened_at);
  const slaSolution = calculateSLAPercentage(ticket.sla_solution_deadline, ticket.opened_at);

  return (
    <div className="p-6 w-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl('MyTickets')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-[#2D1B69]">#{ticket.ticket_number}</span>
            {ticket.title}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="outline">{ticket.category}</Badge>
            <Badge variant="outline">{ticket.module}</Badge>
            {ticket.ticket_type && <Badge variant="outline">{ticket.ticket_type}</Badge>}
            <Badge className={cn(
              "text-white",
              ticket.priority === 'Emergencial' && "bg-red-500",
              ticket.priority === 'Alta' && "bg-orange-500",
              ticket.priority === 'Média' && "bg-yellow-500",
              ticket.priority === 'Baixa' && "bg-green-500"
            )}>
              {ticket.priority}
            </Badge>
            <Badge className="bg-blue-500 text-white">
              {ticket.status}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue={urlParams.get('tab') || 'details'} className="space-y-6">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="details" className="data-[state=active]:bg-white">
            <FileText size={16} className="mr-2" />
            Detalhes
          </TabsTrigger>
          <TabsTrigger value="messages" className="data-[state=active]:bg-white">
            <MessageSquare size={16} className="mr-2" />
            Mensagens ({messages.filter(msg => !msg.is_private).length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-white">
            <CheckCircle2 size={16} className="mr-2" />
            Tarefas ({tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="hours-estimate" className="data-[state=active]:bg-white">
            <Clock size={16} className="mr-2" />
            Consumo de horas
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-white">
            <BarChart3 size={16} className="mr-2" />
            Saúde do chamado
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-white">
            <Clock size={16} className="mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="partner-history" className="data-[state=active]:bg-white">
            <FileText size={16} className="mr-2" />
            Histórico do parceiro
          </TabsTrigger>
          {ticket.ticket_type === 'Melhoria' && (
            <TabsTrigger value="estimates" className="data-[state=active]:bg-white">
              <FileEdit size={16} className="mr-2" />
              Estimativas
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Main Info */}
            <div className="xl:col-span-3 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Descrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap break-words">{ticket.description}</p>
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Anexos</CardTitle>
                </CardHeader>
                <CardContent>
                  {ticket.attachments?.length > 0 ? (
                    <div className="space-y-2">
                      {ticket.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Paperclip size={16} className="text-gray-500" />
                            <span className="text-sm">{att.name}</span>
                            <Badge variant="outline" className="text-xs">{att.type}</Badge>
                          </div>
                          <a href={att.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm">
                              <Download size={14} />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">Nenhum anexo</p>
                  )}
                </CardContent>
              </Card>

            </div>

            {/* Sidebar - Recursos, SLA, Status, Horas */}
            <div className="space-y-6">
              {/* Recursos */}
              <ResourcesCard ticket={ticket} ticketId={ticketId} updateTicket={updateTicket} />

              {/* Parceiro e Contrato */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Parceiro / Contrato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Parceiro</p>
                    <p className="text-sm font-medium">{ticket.partner || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contrato</p>
                    <p className="text-sm font-medium">{ticket.contract_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Gestor do Parceiro</p>
                    <p className="text-sm font-medium">{partnerManager}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Solicitante</p>
                    {getCreatorName() && <p className="text-sm font-medium mb-0.5">{getCreatorName()}</p>}
                    <p className="text-sm text-gray-600">{ticket.requester_email || ticket.created_by || '-'}</p>
                  </div>
                  {getCreatorManager() && (
                    <div>
                      <p className="text-xs text-gray-500">Gestor do Solicitante</p>
                      <p className="text-sm font-medium mb-0.5">{getCreatorManager().name}</p>
                      <p className="text-sm text-gray-600">{getCreatorManager().email}</p>
                    </div>
                  )}
                  {ticket.requester_phone && (
                    <div>
                      <p className="text-xs text-gray-500">Telefone</p>
                      <p className="text-sm text-gray-600">{ticket.requester_phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SLA Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">SLA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">SLA de Resposta</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", getSLAColor(slaResponse))} style={{ width: `${slaResponse}%` }} />
                      </div>
                      <span className="text-sm font-medium">{slaResponse}%</span>
                    </div>
                    {ticket.sla_response_deadline && (
                      <p className="text-xs text-gray-400 mt-1">
                        Prazo: {format(new Date(ticket.sla_response_deadline), "dd/MM/yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-2">SLA de Solução</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", getSLAColor(slaSolution))} style={{ width: `${slaSolution}%` }} />
                      </div>
                      <span className="text-sm font-medium">{slaSolution}%</span>
                    </div>
                    {ticket.sla_solution_deadline && (
                      <p className="text-xs text-gray-400 mt-1">
                        Prazo: {format(new Date(ticket.sla_solution_deadline), "dd/MM/yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardContent className="pt-6">
              {/* Pagination Top */}
              {messages.filter(msg => !hidePrivate || !msg.is_private).length > messagesPerPage && (() => {
                const filteredMessages = messages.filter(msg => !hidePrivate || !msg.is_private);
                const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
                const startMsg = (currentPage - 1) * messagesPerPage + 1;
                const endMsg = Math.min(currentPage * messagesPerPage, filteredMessages.length);
                
                return (
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <div>
                      Página {currentPage} de {totalPages} - Mostrando {startMsg} de {filteredMessages.length} mensagens
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-3"
                      >
                        &lt; Anterior
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn("h-8 w-8", currentPage === pageNum && "bg-blue-600 hover:bg-blue-700")}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 px-3"
                      >
                        Próxima &gt;
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Messages List */}
              <div className="space-y-4 mb-6">
                {messages
                  .filter(msg => !hidePrivate || !msg.is_private)
                  .reverse()
                  .slice((currentPage - 1) * messagesPerPage, currentPage * messagesPerPage)
                  .map((msg) => (
                  <div key={msg.id}>
                    <div 
                      className={cn(
                        "p-4 rounded-lg relative",
                        msg.is_private ? "bg-red-50 border border-red-200" : 
                        getUserBackgroundColor(msg.author_email)
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <User size={14} className="text-gray-500" />
                        <span className="text-sm font-medium">{msg.author_name}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(msg.created_date), "dd/MM/yyyy HH:mm")}
                        </span>
                        {msg.is_private && (
                          <Badge variant="outline" className="text-xs">
                            <Lock size={10} className="mr-1" /> Privado
                          </Badge>
                        )}
                        {msg.is_time_entry && (
                          <Badge variant="outline" className="text-xs bg-orange-100">
                            <Clock size={10} className="mr-1" /> Apontamento
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2 text-xs text-gray-600 bg-white/50 px-3 py-1 rounded-lg inline-flex">
                        <User size={12} />
                        <span className="font-medium">Recurso Principal:</span>
                        <span>{ticket.main_resource || 'Não atribuído'}</span>
                        <span className="text-gray-400">|</span>
                        <User size={12} />
                        <span className="font-medium">Postado por:</span>
                        <span>{msg.author_name}</span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {msg.content.split('\n').map((line, i) => {
                          const imgMatch = line.match(/\[IMG:(.*?)\]/);
                          if (imgMatch) {
                            return (
                              <img 
                                key={i}
                                src={imgMatch[1]} 
                                alt="Imagem anexada"
                                className="max-w-[200px] rounded-lg cursor-pointer border hover:opacity-80 transition-opacity my-2"
                                onClick={() => setViewImage(imgMatch[1])}
                              />
                            );
                          }
                          const linkMatch = line.match(/\[(.*?)\]\((.*?)\)/);
                          if (linkMatch) {
                            return (
                              <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">
                                {linkMatch[1]}
                              </a>
                            );
                          }
                          return <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>;
                        })}
                      </p>
                      {!msg.is_time_entry && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-7 text-xs"
                          onClick={() => toggleMessagePrivacy(msg.id, msg.is_private)}
                        >
                          {msg.is_private ? 'Privada' : 'Pública'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {messages.filter(msg => !hidePrivate || !msg.is_private).length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhuma mensagem ainda</p>
                )}
              </div>

              {/* Pagination */}
              {messages.filter(msg => !hidePrivate || !msg.is_private).length > messagesPerPage && (() => {
                const filteredMessages = messages.filter(msg => !hidePrivate || !msg.is_private);
                const totalPages = Math.ceil(filteredMessages.length / messagesPerPage);
                const startMsg = (currentPage - 1) * messagesPerPage + 1;
                const endMsg = Math.min(currentPage * messagesPerPage, filteredMessages.length);
                
                return (
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <div>
                      Página {currentPage} de {totalPages} - Mostrando {startMsg} de {filteredMessages.length} mensagens
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-3"
                      >
                        &lt; Anterior
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn("h-8 w-8", currentPage === pageNum && "bg-blue-600 hover:bg-blue-700")}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 px-3"
                      >
                        Próxima &gt;
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Message Input */}
              <div className="border-t pt-4">
                <div className="relative">
                  <Textarea
                    placeholder="Digite sua mensagem ou cole uma imagem..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onPaste={handlePaste}
                    className="mb-3 min-h-[200px]"
                  />
                  {pastedImages.length > 0 && (
                    <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 pointer-events-none">
                      {pastedImages.map((url, idx) => (
                        <img 
                          key={idx}
                          src={url} 
                          alt="Imagem colada" 
                          className="max-w-full rounded-lg border shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="private" 
                        checked={isPrivate} 
                        onCheckedChange={setIsPrivate}
                      />
                      <label htmlFor="private" className="text-sm cursor-pointer">
                        Mensagem privada
                      </label>
                    </div>

                    {/* Time Entry Dialog */}
                    <Dialog open={showTimeEntry} onOpenChange={setShowTimeEntry}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Clock size={14} className="mr-2" />
                          Apontar horas
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Apontamento de Horas</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label>Data</Label>
                            <Input
                              type="date"
                              value={timeEntryData.date}
                              onChange={(e) => setTimeEntryData({ ...timeEntryData, date: e.target.value })}
                              className="mt-1"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Hora Inicial</Label>
                              <Input
                                type="time"
                                value={timeEntryData.start_time}
                                onChange={(e) => setTimeEntryData({ ...timeEntryData, start_time: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label>Hora Final</Label>
                              <Input
                                type="time"
                                value={timeEntryData.end_time}
                                onChange={(e) => setTimeEntryData({ ...timeEntryData, end_time: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg text-center">
                           <p className="text-sm text-gray-500">Total de horas</p>
                           <p className="text-2xl font-bold text-[#2D1B69]">{calculateTimeEntryTotal()}h</p>
                          </div>
                          <Button 
                            onClick={handleTimeEntry} 
                            className="w-full bg-[#2D1B69] hover:bg-[#2D1B69]/90"
                            disabled={createTimeEntry.isPending}
                          >
                            {createTimeEntry.isPending ? <Loader2 className="animate-spin" /> : 'Salvar'}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Attachment */}
                    <div className="flex items-center gap-2">
                      <label>
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Paperclip size={14} className="mr-1" />
                            {selectedFile ? selectedFile.name : 'Anexar'}
                          </span>
                        </Button>
                      </label>
                      {selectedFile && (
                        <>
                          <Select value={attachmentType} onValueChange={setAttachmentType}>
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue placeholder="Tipo anexo *" />
                            </SelectTrigger>
                            <SelectContent>
                              {attachmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={handleFileAttach} disabled={isUploading}>
                            {isUploading ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                          </Button>
                        </>
                      )}
                    </div>

                    <Button variant="outline" size="sm" onClick={() => setHidePrivate(!hidePrivate)}>
                      <EyeOff size={14} className="mr-2" />
                      {hidePrivate ? 'Mostrar privadas' : 'Ocultar privadas'}
                    </Button>

                    {pendingTimeEntry && (
                      <div className="h-8 px-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                        <Clock size={14} className="text-green-600" />
                        <span className="text-sm text-green-800">
                          Horas registradas: {pendingTimeEntry.total_hours.toFixed(2)}h
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 h-6"
                          onClick={() => setPendingTimeEntry(null)}
                        >
                          ✕
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {ticket.ticket_type === 'Melhoria' && (
                      <Link to={createPageUrl(`TicketEstimate?id=${ticketId}`)}>
                        <Button 
                          variant="outline"
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <FileEdit size={16} className="mr-2" />
                          Estimativa
                        </Button>
                      </Link>
                    )}
                    
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Alterar status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Manter status</SelectItem>
                        {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Button 
                      onClick={handleSendMessageWithImage}
                      className="bg-gradient-to-r from-[#2D1B69] to-[#4338ca]"
                      disabled={createMessage.isPending}
                    >
                      {createMessage.isPending ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                      <span className="ml-2">Enviar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Image Viewer Dialog */}
          <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Visualizar Imagem</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <img src={viewImage} alt="Imagem em tamanho real" className="w-full h-auto rounded-lg" />
                <div className="flex gap-2 mt-4">
                  <a href={viewImage} download className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Download size={16} className="mr-2" />
                      Download
                    </Button>
                  </a>
                  <a href={viewImage} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Abrir em nova aba
                    </Button>
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico do chamado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {ticket.status_history?.slice().reverse().map((item, idx) => (
                  <div key={idx} className="flex gap-4 pb-6 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2",
                        idx === 0 ? "bg-[#2D1B69] border-[#2D1B69]" : "bg-white border-gray-300"
                      )} />
                      {idx < ticket.status_history.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 mt-1" style={{ minHeight: '40px' }} />
                      )}
                    </div>
                    <div className="flex-1 -mt-1 pb-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="font-semibold text-base text-gray-800">{item.status}</p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                          <Calendar size={14} />
                          <span>{format(new Date(item.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <User size={14} />
                          <span>{item.changed_by}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab ticketId={ticketId} ticket={ticket} />
        </TabsContent>

        <TabsContent value="hours-estimate">
          <HoursEstimateTab timeEntries={timeEntries} ticketId={ticketId} />
        </TabsContent>

        <TabsContent value="health">
          <TicketHealthTab ticket={ticket} timeEntries={timeEntries} />
        </TabsContent>

        <TabsContent value="partner-history">
          <PartnerHistoryComponent
            ticketType={ticket.ticket_type}
            module={ticket.module}
            partner={ticket.partner}
            mainResource={ticket.main_resource}
            currentTicketId={ticketId}
          />
        </TabsContent>

        <TabsContent value="estimates">
          <EstimatesTab ticketId={ticketId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EstimatesTab({ ticketId }) {
  const [selectedEstimate, setSelectedEstimate] = useState(null);

  const { data: approvedEstimates = [], isLoading } = useQuery({
    queryKey: ['approvedEstimates', ticketId],
    queryFn: () => base44.entities.EstimateReview.filter({ 
      ticket_id: ticketId,
      status: { $in: ['aprovada', 'reprovada'] }
    }),
    initialData: []
  });

  const { data: ticket } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => base44.entities.Ticket.filter({ id: ticketId }).then(t => t[0]),
    enabled: !!ticketId
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const getApproverName = (estimate) => {
    if (!estimate?.client_decision_date) return '-';
    // Buscar no created_by do EstimateReview ou usar o email do ticket
    const approverEmail = estimate.created_by || ticket?.requester_email || ticket?.created_by;
    const approver = allUsers.find(u => u.email === approverEmail);
    return approver ? `${approver.first_name} ${approver.last_name}` : 'Sistema';
  };

  const getRequesterName = () => {
    if (!ticket) return '-';
    const email = ticket.requester_email || ticket.created_by;
    const user = allUsers.find(u => u.email === email);
    return user ? `${user.first_name} ${user.last_name}` : email || '-';
  };

  const partnerData = partners.find(p => p.id === ticket?.partner_id || p.name === ticket?.partner);
  const partnerManager = partnerData?.manager || '-';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Estimativas</CardTitle>
        <p className="text-sm text-gray-500">
          Histórico de todas as estimativas aprovadas e reprovadas para este chamado
        </p>
      </CardHeader>
      <CardContent>
        {approvedEstimates.length > 0 ? (
          <div className="space-y-3">
            {approvedEstimates
              .sort((a, b) => new Date(a.client_decision_date) - new Date(b.client_decision_date))
              .map((estimate, index) => (
              <div
                key={estimate.id}
                className="p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => setSelectedEstimate(estimate)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Estimativa #v{index + 1}</p>
                    <p className="text-sm text-gray-600">
                      {estimate.status === 'aprovada' ? 'Aprovada' : 'Reprovada'} em {format(new Date(estimate.client_decision_date), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <Badge className={estimate.status === 'aprovada' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}>
                    {estimate.status === 'aprovada' ? 'Aprovada' : 'Reprovada'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Nenhuma estimativa registrada</p>
        )}

        {/* Dialog com detalhes da estimativa */}
        <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Estimativa</DialogTitle>
            </DialogHeader>

            {selectedEstimate && (
              <div className="space-y-6 pt-4">
                {/* Informações do Chamado */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3">Informações do Chamado</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-medium">Solicitante:</p>
                      <p className="text-gray-800">{getRequesterName()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Módulo:</p>
                      <p className="text-gray-800">{ticket?.module || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Parceiro:</p>
                      <p className="text-gray-800">{ticket?.partner || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Gestor do Parceiro:</p>
                      <p className="text-gray-800">{partnerManager}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Contrato:</p>
                      <p className="text-gray-800">{ticket?.contract_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-medium">Data de Abertura:</p>
                      <p className="text-gray-800">
                        {ticket?.opened_at ? format(new Date(ticket.opened_at), 'dd/MM/yyyy HH:mm') : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Descrição do Chamado */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-2">Descrição do Chamado</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {ticket?.description || '-'}
                  </p>
                </div>

                {/* Descrição da Solução */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="font-semibold mb-2">Descrição da Solução</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedEstimate.original_estimate?.solution_description}
                  </p>
                </div>

                {/* Tabela de Métricas */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Métricas de Horas</h3>
                  <table className="w-full border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Atividade</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">Funcional (Horas)</th>
                        <th className="px-4 py-3 text-right text-sm font-medium">ABAP (Horas)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedEstimate.manager_reviewed_metrics?.map((metric, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm">{metric.activity}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-700 font-medium">
                            {metric.funcional_hours_reviewed?.toFixed(1) || '0.0'}h
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-700 font-medium">
                            {metric.abap_hours_reviewed?.toFixed(1) || '0.0'}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Informações de Aprovação */}
                <div className={`border rounded-lg p-4 ${selectedEstimate.status === 'aprovada' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <h3 className={`font-semibold mb-2 ${selectedEstimate.status === 'aprovada' ? 'text-green-800' : 'text-red-800'}`}>
                    {selectedEstimate.status === 'aprovada' ? 'Informações de Aprovação' : 'Informações de Reprovação'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">{selectedEstimate.status === 'aprovada' ? 'Aprovada em:' : 'Reprovada em:'}</p>
                      <p className="font-medium">
                        {format(new Date(selectedEstimate.client_decision_date), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">{selectedEstimate.status === 'aprovada' ? 'Aprovada por:' : 'Reprovada por:'}</p>
                      <p className="font-medium">{getApproverName(selectedEstimate)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Recurso Principal:</p>
                      <p className="font-medium">{selectedEstimate.main_resource || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Demais Recursos:</p>
                      <p className="font-medium">{selectedEstimate.other_resources?.join(', ') || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function ResourcesCard({ ticket, ticketId, updateTicket }) {
  const [isEditing, setIsEditing] = useState(false);
  const [resources, setResources] = useState({
    main_resource: ticket.main_resource || '',
    other_resources: ticket.other_resources || []
  });
  const [newResource, setNewResource] = useState('');

  const { data: contract } = useQuery({
    queryKey: ['contract', ticket.contract_id],
    queryFn: async () => {
      if (!ticket.contract_id) return null;
      const contracts = await base44.entities.ServiceContract.filter({ id: ticket.contract_id });
      return contracts[0] || null;
    },
    enabled: !!ticket.contract_id
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const users = await base44.entities.SystemUser.list('first_name');
      return users.filter(u => u.is_collaborator && u.active !== false);
    }
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  // Filtrar apenas colaboradores vinculados ao contrato com status ativo
  const contractLinkedEmails = contract?.linked_users
    ?.filter(lu => lu.status === 'Ativa')
    .map(lu => lu.user_email?.toLowerCase().trim()) || [];
  
  console.log('🔍 [ResourcesCard] Debug:', {
    contractId: ticket.contract_id,
    contractLinkedUsers: contract?.linked_users?.length || 0,
    contractLinkedEmails,
    totalCollaborators: collaborators.length
  });

  const activeCollaborators = collaborators
    .filter(c => {
      const collabEmail = c.email?.toLowerCase().trim();
      const isLinked = contractLinkedEmails.includes(collabEmail);
      console.log(`  Checking ${c.first_name} ${c.last_name} (${collabEmail}): ${isLinked}`);
      return isLinked;
    })
    .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const handleSave = async () => {
    // Validar se o recurso principal está vinculado ao contrato
    if (resources.main_resource) {
      const resourceEmail = collaborators.find(c => 
        `${c.first_name} ${c.last_name}` === resources.main_resource
      )?.email?.toLowerCase().trim();
      
      if (!contractLinkedEmails.includes(resourceEmail)) {
        toast.error('Este usuário não está vinculado ao contrato selecionado.');
        return;
      }
    }

    // Validar outros recursos
    for (const resourceName of resources.other_resources) {
      const resourceEmail = collaborators.find(c => 
        `${c.first_name} ${c.last_name}` === resourceName
      )?.email?.toLowerCase().trim();
      
      if (!contractLinkedEmails.includes(resourceEmail)) {
        toast.error(`O usuário ${resourceName} não está vinculado ao contrato selecionado.`);
        return;
      }
    }

    const previousMainResource = ticket.main_resource;
    const previousOtherResources = ticket.other_resources || [];
    
    // Registrar troca se houver mudança no recurso principal
    if (previousMainResource !== resources.main_resource) {
      const resourceHistory = ticket.resource_history || [];
      resourceHistory.push({
        changed_at: new Date().toISOString(),
        previous_main_resource: previousMainResource,
        new_main_resource: resources.main_resource
      });
      
      await updateTicket.mutateAsync({
        id: ticketId,
        data: { ...resources, resource_history: resourceHistory }
      });
      
      // Disparar notificação de atribuição (importar no topo se necessário)
      const { triggerTicketAssigned } = await import('../components/notifications/notificationEngine');
      triggerTicketAssigned({
        ticketId: ticketId,
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        targetUserName: resources.main_resource,
        priority: ticket.priority,
        slaDeadline: ticket.sla_solution_deadline,
        systemLink: window.location.href
      });
    } else {
      await updateTicket.mutateAsync({
        id: ticketId,
        data: resources
      });
    }
    
    setIsEditing(false);
  };

  const addOtherResource = () => {
    if (newResource && !resources.other_resources.includes(newResource)) {
      setResources({
        ...resources,
        other_resources: [...resources.other_resources, newResource]
      });
      setNewResource('');
    }
  };

  const removeOtherResource = (resource) => {
    setResources({
      ...resources,
      other_resources: resources.other_resources.filter(r => r !== resource)
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recursos</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? 'Salvar' : 'Editar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isEditing ? (
          <>
            <div>
              <Label className="text-xs text-gray-500">Recurso Principal</Label>
              <Select 
                value={resources.main_resource} 
                onValueChange={(value) => setResources({...resources, main_resource: value})}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {activeCollaborators.map(c => (
                    <SelectItem key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Demais Recursos</Label>
              <div className="space-y-2 mt-1">
                {resources.other_resources.map((resource, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={resource} disabled className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOtherResource(resource)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Select value={newResource} onValueChange={setNewResource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Adicionar recurso" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCollaborators
                        .filter(c => `${c.first_name} ${c.last_name}` !== resources.main_resource && !resources.other_resources.includes(`${c.first_name} ${c.last_name}`))
                        .map(c => (
                          <SelectItem key={c.id} value={`${c.first_name} ${c.last_name}`}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addOtherResource} disabled={!newResource}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-500">Recurso Principal</p>
              <p className="text-sm font-medium">{ticket.main_resource || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Demais Recursos</p>
              <p className="text-sm font-medium">{ticket.other_resources?.join(', ') || '-'}</p>
            </div>
            {(() => {
              // Coletar todos os recursos (principal + demais)
              const allResources = [
                ticket.main_resource,
                ...(ticket.other_resources || [])
              ].filter(Boolean);

              // Buscar gestores únicos dos recursos
              const managers = new Map();
              
              allResources.forEach(resourceName => {
                const resourceUser = allUsers.find(u => 
                  `${u.first_name} ${u.last_name}` === resourceName
                );
                
                if (resourceUser?.manager_email) {
                  const managerUser = allUsers.find(u => u.email === resourceUser.manager_email);
                  if (managerUser) {
                    const managerKey = managerUser.email;
                    if (!managers.has(managerKey)) {
                      managers.set(managerKey, {
                        name: `${managerUser.first_name} ${managerUser.last_name}`,
                        email: managerUser.email
                      });
                    }
                  }
                }
              });

              if (managers.size === 0) return null;

              return (
                <div>
                  <p className="text-xs text-gray-500">
                    {managers.size === 1 ? 'Gestor do Recurso' : 'Gestores dos Recursos'}
                  </p>
                  <div className="space-y-1">
                    {Array.from(managers.values()).map((manager, idx) => (
                      <div key={idx}>
                        <p className="text-sm font-medium">{manager.name}</p>
                        <p className="text-xs text-gray-600">{manager.email}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}



function HoursEstimateTab({ timeEntries, ticketId }) {
  const { data: messages = [] } = useQuery({
    queryKey: ['ticketMessages', ticketId],
    queryFn: () => base44.entities.TicketMessage.filter({ ticket_id: ticketId }, 'created_date'),
    enabled: !!ticketId
  });

  // Calcular total de horas por consultor e total geral (incluindo exclusões)
  const hoursByCollaborator = {};
  let totalHours = 0;

  messages
    .filter(msg => msg.is_time_entry)
    .forEach(msg => {
      const userName = msg.author_name || 'Não identificado';
      const hours = msg.time_entry_data?.total_hours || 0;
      
      if (!hoursByCollaborator[userName]) {
        hoursByCollaborator[userName] = 0;
      }
      hoursByCollaborator[userName] += hours;
      totalHours += hours;
    });

  // Ordenar mensagens por data (mais recente primeiro)
  const sortedMessages = messages
    .filter(msg => msg.is_time_entry)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Consumo de Horas</CardTitle>
        <p className="text-sm text-gray-500">Histórico de apontamentos de horas</p>
      </CardHeader>
      <CardContent>
        {/* Mini balões de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Total por Consultor */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <p className="text-sm font-medium text-gray-700 mb-3">Horas por Consultor</p>
            <div className="space-y-2">
              {Object.entries(hoursByCollaborator).map(([name, hours]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{name}</span>
                  <Badge className="bg-blue-600 text-white">
                    {hours.toFixed(2)}h
                  </Badge>
                </div>
              ))}
              {Object.keys(hoursByCollaborator).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">Nenhum apontamento</p>
              )}
            </div>
          </div>

          {/* Total Geral */}
          <div className="border rounded-lg p-4 bg-[#2D1B69] text-white">
            <p className="text-sm font-medium mb-2">Total de Horas no Chamado</p>
            <p className="text-4xl font-bold">{totalHours.toFixed(2)}h</p>
          </div>
        </div>

        {/* Lista de apontamentos */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
            Histórico de Apontamentos
          </h3>
          
          {sortedMessages.length > 0 ? (
            sortedMessages.map((msg) => (
              <div key={msg.id} className="bg-white rounded-lg p-4 border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <User size={16} className="text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {msg.author_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>
                        {format(new Date(msg.created_date), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>
                        {format(new Date(msg.created_date), "HH:mm")}
                      </span>
                    </div>
                    <Badge className={cn(
                      "text-white font-semibold",
                      (msg.time_entry_data?.total_hours || 0) >= 0 ? "bg-green-600" : "bg-red-600"
                    )}>
                      {(msg.time_entry_data?.total_hours || 0) >= 0 ? '+' : ''}
                      {(msg.time_entry_data?.total_hours || 0).toFixed(2)}h
                    </Badge>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 whitespace-pre-wrap pl-7">
                  {msg.content}
                </p>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">Nenhum apontamento de horas ainda</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TicketHealthTab({ ticket, timeEntries }) {
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);
  const statusChanges = ticket.status_history?.length || 0;
  
  // Calcular trocas de recursos a partir do histórico dedicado
  const resourceChanges = ticket.resource_history?.length || 0;
  
  // SLA Status
  const slaResponsePercentage = calculateSLAPercentage(ticket.sla_response_deadline, ticket.opened_at);
  const slaSolutionPercentage = calculateSLAPercentage(ticket.sla_solution_deadline, ticket.opened_at);
  
  const isSLABreached = ticket.status !== 'Finalizado' && 
    (slaSolutionPercentage >= 100 || slaResponsePercentage >= 100);
  
  const daysOpen = ticket.opened_at ? 
    Math.floor((new Date() - new Date(ticket.opened_at)) / (1000 * 60 * 60 * 24)) : 0;
  
  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Dias em Aberto</p>
                <p className="text-2xl font-bold text-[#2D1B69] mt-1">{daysOpen}</p>
              </div>
              <Calendar size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Trocas de Status</p>
                <p className="text-2xl font-bold text-[#2D1B69] mt-1">{statusChanges}</p>
              </div>
              <Activity size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Trocas de Recursos</p>
                <p className="text-2xl font-bold text-[#2D1B69] mt-1">{resourceChanges}</p>
              </div>
              <Users size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Horas Apontadas</p>
                <p className="text-2xl font-bold text-[#2D1B69] mt-1">{totalHours.toFixed(1)}h</p>
              </div>
              <Clock size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status do SLA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">SLA de Resposta</span>
              <span className="text-sm font-semibold">{slaResponsePercentage}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", getSLAColor(slaResponsePercentage))}
                style={{ width: `${Math.min(100, slaResponsePercentage)}%` }}
              />
            </div>
            {ticket.sla_response_deadline && (
              <p className="text-xs text-gray-500 mt-1">
                Prazo: {format(new Date(ticket.sla_response_deadline), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">SLA de Solução</span>
              <span className="text-sm font-semibold">{slaSolutionPercentage}%</span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all", getSLAColor(slaSolutionPercentage))}
                style={{ width: `${Math.min(100, slaSolutionPercentage)}%` }}
              />
            </div>
            {ticket.sla_solution_deadline && (
              <p className="text-xs text-gray-500 mt-1">
                Prazo: {format(new Date(ticket.sla_solution_deadline), "dd/MM/yyyy HH:mm")}
              </p>
            )}
          </div>
          
          <div className={cn(
            "p-4 rounded-lg flex items-center gap-3",
            isSLABreached ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
          )}>
            {isSLABreached ? (
              <>
                <TrendingDown size={24} className="text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">SLA Estourado</p>
                  <p className="text-sm text-red-600">O chamado ultrapassou o prazo estabelecido</p>
                </div>
              </>
            ) : (
              <>
                <TrendingUp size={24} className="text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Dentro do SLA</p>
                  <p className="text-sm text-green-600">O chamado está dentro do prazo estabelecido</p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Data de Abertura</span>
              <span className="font-medium">
                {ticket.opened_at ? format(new Date(ticket.opened_at), "dd/MM/yyyy HH:mm") : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Primeira Resposta</span>
              <span className="font-medium">
                {ticket.first_response_at ? format(new Date(ticket.first_response_at), "dd/MM/yyyy HH:mm") : 'Pendente'}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Previsão de Encerramento (SLA)</span>
              <span className="font-medium">
                {ticket.sla_solution_deadline ? format(new Date(ticket.sla_solution_deadline), "dd/MM/yyyy HH:mm") : '-'}
              </span>
            </div>
            {ticket.closed_at && (
              <div className="flex justify-between items-center p-3 bg-green-50 rounded border border-green-200">
                <span className="text-sm text-green-700 font-medium">Data de Encerramento</span>
                <span className="font-semibold text-green-800">
                  {format(new Date(ticket.closed_at), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// PartnerHistory moved to components/tickets/PartnerHistory.jsx