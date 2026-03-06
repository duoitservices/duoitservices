import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, Send, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const priorities = ["Baixa", "Média", "Alta", "Emergencial"];

export default function ClientNewTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    ticket_type: '',
    partner: '',
    partner_id: '',
    contract_id: '',
    contract_name: '',
    module: '',
    priority: '',
    external_info: '',
    related_ticket_id: '',
    description: '',
    attachments: []
  });
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const { data: userTickets = [] } = useQuery({
    queryKey: ['userTickets', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return base44.entities.Ticket.filter({ created_by: currentUser.email }, '-created_date');
    },
    enabled: !!currentUser
  });

  const { data: lastTicket } = useQuery({
    queryKey: ['lastTicketNumber'],
    queryFn: async () => {
      const tickets = await base44.entities.Ticket.list('-ticket_number', 1);
      return tickets[0] || null;
    }
  });

  const { data: allContracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list()
  });

  const systemUser = currentUser;

  const userContracts = allContracts.filter(c => {
    if (c.status !== 'Ativo') return false;
    if (!c.linked_users || !systemUser) return false;
    
    const userEmail = systemUser.email?.toLowerCase().trim();
    return c.linked_users.some(lu => 
      lu.user_email?.toLowerCase().trim() === userEmail && 
      lu.status === 'Ativa'
    );
  });

  const partnerIds = [...new Set(userContracts.map(c => c.partner_id).filter(Boolean))];
  const partners = partnerIds.map(pid => {
    const contract = userContracts.find(c => c.partner_id === pid);
    return { id: pid, name: contract?.partner_name || '' };
  }).filter(p => p.name);

  const availableContracts = formData.partner_id
    ? userContracts.filter(c => c.partner_id === formData.partner_id)
    : [];

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => base44.entities.TicketType.list()
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => base44.entities.Module.list()
  });

  const { data: slas = [] } = useQuery({
    queryKey: ['slas'],
    queryFn: () => base44.entities.SLA.list()
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list()
  });

  const createTicket = useMutation({
    mutationFn: async (data) => {
      const now = new Date().toISOString();

      const responseSLA = slas.find(s => 
        s.sla_type === 'Resposta' && 
        s.partner_id === data.partner_id && 
        (!s.ticket_type || s.ticket_type === data.ticket_type) &&
        s.active !== false
      );

      const solutionSLA = slas.find(s => 
        s.sla_type === 'Solução' && 
        s.partner_id === data.partner_id && 
        (!s.ticket_type || s.ticket_type === data.ticket_type) &&
        s.active !== false
      );

      const getHoursForPriority = (sla, priority) => {
        if (!sla) return 24;
        switch(priority) {
          case 'Baixa': return sla.priority_low_hours || 24;
          case 'Média': return sla.priority_medium_hours || 24;
          case 'Alta': return sla.priority_high_hours || 24;
          case 'Emergencial': return sla.priority_emergency_hours || 24;
          default: return 24;
        }
      };

      const responseHours = getHoursForPriority(responseSLA, data.priority);
      const solutionHours = getHoursForPriority(solutionSLA, data.priority);

      const calculateDeadline = (hours, calendarId) => {
        const calendar = calendars.find(c => c.id === calendarId);
        if (!calendar) {
          return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }
        
        return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      };

      const slaResponseDeadline = calculateDeadline(responseHours, responseSLA?.calendar_id);
      const slaSolutionDeadline = calculateDeadline(solutionHours, solutionSLA?.calendar_id);

      const ticketNumber = (lastTicket?.ticket_number || 0) + 1;

      return base44.entities.Ticket.create({
        ...data,
        ticket_number: ticketNumber,
        status: 'Aguardando Atendimento',
        opened_at: now,
        sla_response_deadline: slaResponseDeadline,
        sla_solution_deadline: slaSolutionDeadline,
        sla_response_hours: responseHours,
        sla_solution_hours: solutionHours,
        status_history: [{ status: 'Aguardando Atendimento', changed_at: now, changed_by: currentUser?.email || '' }],
        logged_hours: 0
      });
    },
    onSuccess: (ticket) => {
      toast.success('Chamado criado com sucesso!');
      navigate(createPageUrl(`TicketDetails?id=${ticket.id}`));
    },
    onError: (error) => {
      toast.error('Erro ao criar chamado: ' + error.message);
    }
  });

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setIsUploading(true);

    try {
      const uploadedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return { url: file_url, name: file.name, type: 'Detalhamento' };
        })
      );

      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploadedFiles]
      }));
      setFiles((prev) => [...prev, ...selectedFiles]);
      toast.success('Arquivo(s) anexado(s)!');
    } catch (error) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.contract_id || !formData.module || !formData.priority || !formData.description) {
      toast.error('Preencha todos os campos obrigatórios (incluindo Contrato)');
      return;
    }
    
    const user = currentUser;
    const ticketData = {
      ...formData,
      requester_email: user?.email || '',
      requester_phone: user?.phone || ''
    };
    
    createTicket.mutate(ticketData);
  };

  const handleClear = () => {
    setFormData({
      title: '',
      ticket_type: '',
      partner: '',
      partner_id: '',
      contract_id: '',
      contract_name: '',
      module: '',
      priority: '',
      external_info: '',
      related_ticket_id: '',
      description: '',
      attachments: []
    });
    setFiles([]);
  };

  return (
    <div className="p-6 w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Novo Chamado</h1>
        <p className="text-gray-500 text-sm mt-1">Preencha os dados para abrir um novo chamado</p>
      </div>

      <Card className="shadow-sm border-gray-100 w-full">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-medium text-gray-700">Título *</Label>
              <Input
                id="title"
                placeholder="Digite o título do chamado"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1" />

            </div>

            {/* Row: Partner, Contract, Type, Module, Priority */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Parceiro *</Label>
                <Select 
                  value={formData.partner_id} 
                  onValueChange={(v) => {
                    const partner = partners.find(p => p.id === v);
                    setFormData({ 
                      ...formData, 
                      partner_id: v, 
                      partner: partner?.name || '',
                      contract_id: '',
                      contract_name: ''
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Contrato *</Label>
                <Select 
                  value={formData.contract_id} 
                  onValueChange={(v) => {
                    const contract = userContracts.find(c => c.id === v);
                    setFormData({ 
                      ...formData, 
                      contract_id: v,
                      contract_name: contract?.name || ''
                    });
                  }}
                  disabled={!formData.partner_id}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o parceiro primeiro" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Tipo de chamado</Label>
                <Select value={formData.ticket_type} onValueChange={(v) => setFormData({ ...formData, ticket_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketTypes.filter(t => t.active !== false).map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Módulo *</Label>
                <Select value={formData.module} onValueChange={(v) => setFormData({ ...formData, module: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.filter(m => m.active !== false).map((m) => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Prioridade *</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* External Info and Related Ticket */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Informações externas</Label>
                <Input
                  placeholder="Ex: Número do SAP, ID externo..."
                  value={formData.external_info}
                  onChange={(e) => setFormData({ ...formData, external_info: e.target.value })}
                  className="mt-1" />

              </div>

              <div>
                <Label className="peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-sm font-medium text-gray-700">Chamado relacionado</Label>
                <Select value={formData.related_ticket_id} onValueChange={(v) => setFormData({ ...formData, related_ticket_id: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione um chamado" />
                  </SelectTrigger>
                  <SelectContent>
                    {userTickets.map((t) =>
                    <SelectItem key={t.id} value={t.id}>#{t.ticket_number} - {t.title}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Descrição *</Label>
              <Textarea
                placeholder="Descreva detalhadamente o chamado..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 min-h-[150px]" />

            </div>

            {/* Attachments */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Anexos</Label>
              <div className="mt-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading} />

                  <Button type="button" variant="outline" className="border-dashed" disabled={isUploading} asChild>
                    <span>
                      {isUploading ?
                      <Loader2 className="animate-spin mr-2" size={16} /> :

                      <Paperclip size={16} className="mr-2" />
                      }
                      Anexar arquivos
                    </span>
                  </Button>
                </label>
                {files.length > 0 &&
                <div className="mt-2 flex flex-wrap gap-2">
                    {files.map((f, i) =>
                  <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{f.name}</span>
                  )}
                  </div>
                }
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="bg-gradient-to-r from-[#2D1B69] to-[#4338ca] hover:from-[#3d2b79] hover:to-[#5348da] text-white"
                disabled={createTicket.isPending}>

                {createTicket.isPending ?
                <Loader2 className="animate-spin mr-2" size={16} /> :

                <Send size={16} className="mr-2" />
                }
                Criar chamado
              </Button>
              <Button type="button" variant="outline" onClick={handleClear}>
                <RotateCcw size={16} className="mr-2" />
                Limpar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}