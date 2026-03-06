import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function ContractSLATab({ contractId, partnerId, partnerName }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSLA, setEditingSLA] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sla_type: 'Resposta',
    partner_id: partnerId || '',
    partner_name: partnerName || '',
    contract_id: contractId || '',
    ticket_type: '',
    calendar_id: '',
    calendar_name: '',
    priority_low_hours: 0,
    priority_medium_hours: 0,
    priority_high_hours: 0,
    priority_emergency_hours: 0,
    active: true
  });
  const [filters, setFilters] = useState({
    sla_type: 'all',
    ticket_type: 'all',
    status: 'all'
  });

  const { data: slas = [] } = useQuery({
    queryKey: ['slas'],
    queryFn: () => base44.entities.SLA.list()
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list()
  });

  const { data: ticketTypes = [] } = useQuery({
    queryKey: ['ticketTypes'],
    queryFn: () => base44.entities.TicketType.list()
  });

  // Filtrar SLAs do contrato (por contract_id se disponível, senão por partner_id)
  const contractSLAs = slas.filter(s => {
    if (contractId) return s.contract_id === contractId || (!s.contract_id && s.partner_id === partnerId);
    return !partnerId || s.partner_id === partnerId;
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SLA.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['slas']);
      setDialogOpen(false);
      resetForm();
      toast.success('SLA criado com sucesso');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SLA.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['slas']);
      setDialogOpen(false);
      resetForm();
      toast.success('SLA atualizado com sucesso');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SLA.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['slas']);
      toast.success('SLA excluído com sucesso');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sla_type: 'Resposta',
      partner_id: partnerId || '',
      partner_name: partnerName || '',
      contract_id: contractId || '',
      ticket_type: '',
      calendar_id: '',
      calendar_name: '',
      priority_low_hours: 0,
      priority_medium_hours: 0,
      priority_high_hours: 0,
      priority_emergency_hours: 0,
      active: true
    });
    setEditingSLA(null);
  };

  const handleOpenDialog = (sla = null) => {
    if (sla) {
      setEditingSLA(sla);
      setFormData({
        name: sla.name,
        sla_type: sla.sla_type,
        partner_id: sla.partner_id,
        partner_name: sla.partner_name,
        contract_id: sla.contract_id || contractId || '',
        ticket_type: sla.ticket_type || '',
        calendar_id: sla.calendar_id,
        calendar_name: sla.calendar_name,
        priority_low_hours: sla.priority_low_hours || 0,
        priority_medium_hours: sla.priority_medium_hours || 0,
        priority_high_hours: sla.priority_high_hours || 0,
        priority_emergency_hours: sla.priority_emergency_hours || 0,
        active: sla.active !== false
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSLA) {
      updateMutation.mutate({ id: editingSLA.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (sla) => {
    if (window.confirm('Tem certeza que deseja excluir este SLA?')) {
      deleteMutation.mutate(sla.id);
    }
  };

  const handleCalendarChange = (calendarId) => {
    const calendar = calendars.find(c => c.id === calendarId);
    setFormData({ ...formData, calendar_id: calendarId, calendar_name: calendar?.name || '' });
  };

  const toggleActive = (sla) => {
    updateMutation.mutate({ id: sla.id, data: { ...sla, active: !sla.active } });
  };

  const filteredSLAs = contractSLAs.filter(sla => {
    const typeMatch = filters.sla_type === 'all' || sla.sla_type === filters.sla_type;
    const ticketTypeMatch = filters.ticket_type === 'all' || !sla.ticket_type || sla.ticket_type === filters.ticket_type;
    const statusMatch = filters.status === 'all' ||
      (filters.status === 'active' && sla.active !== false) ||
      (filters.status === 'inactive' && sla.active === false);
    return typeMatch && ticketTypeMatch && statusMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">SLAs do Contrato</CardTitle>
            <Button onClick={() => handleOpenDialog()} className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
              <Plus className="w-4 h-4 mr-2" />
              Novo SLA
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de SLA</Label>
              <Select value={filters.sla_type} onValueChange={(v) => setFilters({ ...filters, sla_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Resposta">Resposta</SelectItem>
                  <SelectItem value="Solução">Solução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Chamado</Label>
              <Select value={filters.ticket_type} onValueChange={(v) => setFilters({ ...filters, ticket_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {ticketTypes.map(type => (
                    <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de SLAs */}
      {filteredSLAs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Clock size={40} className="mx-auto mb-3 text-gray-300" />
          <p>Nenhum SLA cadastrado para este contrato</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSLAs.map((sla) => (
            <Card key={sla.id} className={!sla.active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-[#2D1B69]" />
                      <CardTitle className="text-base">{sla.name}</CardTitle>
                    </div>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        <p><strong>Tipo:</strong> {sla.sla_type}</p>
                        {sla.ticket_type && <p><strong>Tipo chamado:</strong> {sla.ticket_type}</p>}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(sla)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(sla)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-gray-500">Baixa:</p><p className="font-semibold">{sla.priority_low_hours}h</p></div>
                    <div><p className="text-gray-500">Média:</p><p className="font-semibold">{sla.priority_medium_hours}h</p></div>
                    <div><p className="text-gray-500">Alta:</p><p className="font-semibold">{sla.priority_high_hours}h</p></div>
                    <div><p className="text-gray-500">Emergencial:</p><p className="font-semibold">{sla.priority_emergency_hours}h</p></div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Switch checked={sla.active !== false} onCheckedChange={() => toggleActive(sla)} />
                    <Label>{sla.active !== false ? 'Ativo' : 'Inativo'}</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog criar/editar SLA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSLA ? 'Editar SLA' : 'Novo SLA'}</DialogTitle>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de SLA *</Label>
                  <Select value={formData.sla_type} onValueChange={(v) => setFormData({ ...formData, sla_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Resposta">Resposta</SelectItem>
                      <SelectItem value="Solução">Solução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Chamado</Label>
                  <Select value={formData.ticket_type} onValueChange={(v) => setFormData({ ...formData, ticket_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Todos os tipos</SelectItem>
                      {ticketTypes.filter(t => t.active !== false).map(type => (
                        <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-base mb-3 block">Horas por Prioridade</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Baixa (horas)</Label>
                    <Input type="number" min="0" step="0.5"
                      value={formData.priority_low_hours}
                      onChange={(e) => setFormData({ ...formData, priority_low_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Média (horas)</Label>
                    <Input type="number" min="0" step="0.5"
                      value={formData.priority_medium_hours}
                      onChange={(e) => setFormData({ ...formData, priority_medium_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Alta (horas)</Label>
                    <Input type="number" min="0" step="0.5"
                      value={formData.priority_high_hours}
                      onChange={(e) => setFormData({ ...formData, priority_high_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Emergencial (horas)</Label>
                    <Input type="number" min="0" step="0.5"
                      value={formData.priority_emergency_hours}
                      onChange={(e) => setFormData({ ...formData, priority_emergency_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={formData.active} onCheckedChange={(checked) => setFormData({ ...formData, active: checked })} />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
                {editingSLA ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}