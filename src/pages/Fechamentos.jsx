import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Eye, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Fechamentos() {
  const [filters, setFilters] = useState({
    partner: '',
    contract: '',
    ticketType: '',
    ticketNumber: '',
    resource: '',
    dateFrom: '',
    dateTo: ''
  });
  
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [adjustedHours, setAdjustedHours] = useState({}); // key: item.id, value: string input
  const [savedAdjustedHours, setSavedAdjustedHours] = useState({}); // key: item.id, value: number
  const queryClient = useQueryClient();

  // Buscar dados
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list()
  });

  const { data: timeEntries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list()
  });

  const { data: approvedEstimates = [] } = useQuery({
    queryKey: ['approvedEstimates'],
    queryFn: () => base44.entities.EstimateReview.filter({ status: 'aprovada' })
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list()
  });

  const { data: users = [] } = useQuery({
    queryKey: ['systemUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => base44.entities.Collaborator.list()
  });

  // Processar dados para a lista
  const processedData = useMemo(() => {
    if (!tickets.length) return [];

    const ticketsWithHours = [];

    // Mapear horas estimadas por ticket das estimativas aprovadas (somando todas as versões)
    const estimatedHoursByTicket = {};
    approvedEstimates.forEach(estimate => {
      if (estimate.ticket_id && estimate.manager_reviewed_metrics) {
        const totalHours = estimate.manager_reviewed_metrics.reduce((sum, metric) => {
          return sum + (metric.funcional_hours_reviewed || 0) + (metric.abap_hours_reviewed || 0);
        }, 0);
        
        if (!estimatedHoursByTicket[estimate.ticket_id]) {
          estimatedHoursByTicket[estimate.ticket_id] = 0;
        }
        estimatedHoursByTicket[estimate.ticket_id] += totalHours;
      }
    });

    // Filtrar tickets que tenham contract_id (atrelados a contratos)
    const ticketsWithContract = tickets.filter(ticket => ticket.contract_id);

    ticketsWithContract.forEach(ticket => {
      // Apontamentos deste chamado
      let ticketEntries = timeEntries.filter(e => e.ticket_id === ticket.id);

      // Aplicar filtros de data se houver apontamentos
      if (ticketEntries.length > 0) {
        if (filters.dateFrom) {
          ticketEntries = ticketEntries.filter(e => e.date >= filters.dateFrom);
        }
        if (filters.dateTo) {
          ticketEntries = ticketEntries.filter(e => e.date <= filters.dateTo);
        }
      }

      // Agrupar por recurso (main_resource + other_resources)
      const resources = [];
      if (ticket.main_resource) resources.push(ticket.main_resource);
      if (ticket.other_resources && ticket.other_resources.length > 0) {
        resources.push(...ticket.other_resources);
      }

      // Se não houver recursos definidos, ainda assim mostrar o chamado com total de horas
      if (resources.length === 0) {
        const totalHours = ticketEntries.reduce((sum, e) => sum + (e.total_hours || 0), 0); // positivos + negativos
        ticketsWithHours.push({
          id: `${ticket.id}-no-resource`,
          ticket_id: ticket.id,
          partner: ticket.partner || '',
          partner_id: ticket.partner_id || '',
          contract_name: ticket.contract_name || '',
          contract_id: ticket.contract_id || '',
          ticket_number: ticket.ticket_number,
          title: ticket.title,
          ticket_type: ticket.ticket_type || '',
          module: ticket.module || '',
          resource: '',
          resource_name: 'Sem recurso',
          resource_position: '',
          status: ticket.status,
          total_hours: totalHours,
          estimated_hours: estimatedHoursByTicket[ticket.id] || 0
        });
      } else {
        resources.forEach(resource => {
          // Encontrar o usuário pelo nome (resource é o nome completo: "First Last")
          const user = users.find(u => `${u.first_name} ${u.last_name}` === resource);
          const collaborator = collaborators.find(c => c.full_name === resource || c.email === user?.email);
          
          // Buscar apontamentos pelo email do usuário (positivos menos negativos)
          const userEmail = user?.email;
          const resourceEntries = ticketEntries.filter(e => e.user_email === userEmail);
          const totalHours = resourceEntries.reduce((sum, e) => {
            const h = e.total_hours || 0;
            return h < 0 ? sum + h : sum + h; // positivos + negativos (negativo já subtrai)
          }, 0);

          ticketsWithHours.push({
            id: `${ticket.id}-${resource}`,
            ticket_id: ticket.id,
            partner: ticket.partner || '',
            partner_id: ticket.partner_id || '',
            contract_name: ticket.contract_name || '',
            contract_id: ticket.contract_id || '',
            ticket_number: ticket.ticket_number,
            title: ticket.title,
            ticket_type: ticket.ticket_type || '',
            module: ticket.module || '',
            resource: userEmail || resource,
            resource_name: resource,
            resource_position: collaborator?.position || user?.position_name || '',
            status: ticket.status,
            total_hours: totalHours,
            estimated_hours: estimatedHoursByTicket[ticket.id] || 0
          });
        });
      }
    });

    return ticketsWithHours;
  }, [tickets, timeEntries, users, collaborators, filters.dateFrom, filters.dateTo, approvedEstimates]);

  // Obter listas únicas para os filtros
  const uniquePartners = useMemo(() => {
    const partners = [...new Set(processedData.map(item => item.partner))].filter(Boolean);
    return partners.sort();
  }, [processedData]);

  const uniqueContracts = useMemo(() => {
    const contracts = [...new Set(processedData.map(item => item.contract_name))].filter(Boolean);
    return contracts.sort();
  }, [processedData]);

  const uniqueTicketTypes = useMemo(() => {
    const types = [...new Set(processedData.map(item => item.ticket_type))].filter(Boolean);
    return types.sort();
  }, [processedData]);

  const uniqueResources = useMemo(() => {
    const resources = [...new Set(processedData.map(item => item.resource_name))].filter(Boolean);
    return resources.sort();
  }, [processedData]);

  // Aplicar filtros
  const filteredData = useMemo(() => {
    return processedData.filter(item => {
      if (filters.partner && filters.partner !== 'all' && item.partner !== filters.partner) return false;
      if (filters.contract && filters.contract !== 'all' && item.contract_name !== filters.contract) return false;
      if (filters.ticketType && filters.ticketType !== 'all' && item.ticket_type !== filters.ticketType) return false;
      if (filters.ticketNumber && !item.ticket_number.toString().includes(filters.ticketNumber)) return false;
      if (filters.resource && filters.resource !== 'all' && item.resource_name !== filters.resource) return false;
      return true;
    });
  }, [processedData, filters]);

  // Obter parceiro selecionado
  const selectedPartner = useMemo(() => {
    if (selectedTickets.length === 0) return null;
    const firstSelected = filteredData.find(item => selectedTickets.includes(item.id));
    return firstSelected?.partner_id;
  }, [selectedTickets, filteredData]);

  // Retorna as horas efetivas: ajustadas se salvas, senão apontadas
  const getEffectiveHours = (item) => {
    const saved = savedAdjustedHours[item.id];
    return (saved !== undefined && saved !== null && saved !== '') ? saved : item.total_hours;
  };

  // Calcular preview
  const previewData = useMemo(() => {
    const selected = filteredData.filter(item => selectedTickets.includes(item.id));
    if (selected.length === 0) return null;

    const contract = contracts.find(c => c.contract_id === selected[0].contract_id || c.id === selected[0].contract_id);
    const hourlyRate = contract?.normal_hour_rate || 0;

    // Agrupar por cargo
    const byPosition = {};
    selected.forEach(item => {
      const position = item.resource_position || 'Sem cargo';
      const hours = getEffectiveHours(item);
      if (!byPosition[position]) {
        byPosition[position] = { position, total_hours: 0 };
      }
      byPosition[position].total_hours += hours;
    });

    const summaryByPosition = Object.values(byPosition);
    const totalHours = summaryByPosition.reduce((sum, p) => sum + p.total_hours, 0);
    const totalValue = totalHours * hourlyRate;

    return {
      summaryByPosition,
      totalHours,
      totalValue,
      hourlyRate,
      partner: selected[0].partner,
      contract: selected[0].contract_name
    };
  }, [selectedTickets, filteredData, contracts, savedAdjustedHours]);

  // Mutation para criar fechamento
  const createClosureMutation = useMutation({
    mutationFn: async (data) => {
      const selected = filteredData.filter(item => selectedTickets.includes(item.id));
      const contract = contracts.find(c => c.contract_id === selected[0].contract_id || c.id === selected[0].contract_id);
      const hourlyRate = contract?.normal_hour_rate || 0;

      // Resumo por cargo usando horas efetivas (ajustadas ou apontadas)
      const byPosition = {};
      selected.forEach(item => {
        const position = item.resource_position || 'Sem cargo';
        const hours = getEffectiveHours(item);
        if (!byPosition[position]) {
          byPosition[position] = { position, total_hours: 0 };
        }
        byPosition[position].total_hours += hours;
      });
      const summaryByPosition = Object.values(byPosition).map(p => ({
        ...p,
        total_value: p.total_hours * hourlyRate
      }));

      // Resumo por consultor
      const byConsultant = {};
      selected.forEach(item => {
        const key = item.resource;
        const hours = getEffectiveHours(item);
        if (!byConsultant[key]) {
          byConsultant[key] = {
            consultant_email: item.resource,
            consultant_name: item.resource_name,
            position: item.resource_position || 'Sem cargo',
            total_hours: 0
          };
        }
        byConsultant[key].total_hours += hours;
      });
      const summaryByConsultant = Object.values(byConsultant);

      const totalHours = summaryByPosition.reduce((sum, p) => sum + p.total_hours, 0);
      const totalValue = totalHours * hourlyRate;

      return base44.entities.Closure.create({
        month: data.month,
        partner_id: selected[0].partner_id,
        partner_name: selected[0].partner,
        contract_id: selected[0].contract_id,
        contract_name: selected[0].contract_name,
        status: 'Aguardando revisão',
        total_hours: totalHours,
        total_value: totalValue,
        hourly_rate: hourlyRate,
        tickets: selected.map(item => ({
          ticket_id: item.ticket_id,
          ticket_number: item.ticket_number,
          ticket_title: item.title,
          ticket_type: item.ticket_type,
          module: item.module,
          resource: item.resource,
          resource_position: item.resource_position,
          status: item.status,
          total_hours: getEffectiveHours(item),
          estimated_hours: item.estimated_hours
        })),
        summary_by_position: summaryByPosition,
        summary_by_consultant: summaryByConsultant
      });
    },
    onSuccess: () => {
      toast.success('Fechamento gerado com sucesso!');
      queryClient.invalidateQueries(['closures']);
      setShowGenerateDialog(false);
      setSelectedTickets([]);
      setSelectedMonth('');
    },
    onError: () => {
      toast.error('Erro ao gerar fechamento');
    }
  });

  const handleToggleTicket = (ticketId) => {
    const ticket = filteredData.find(t => t.id === ticketId);
    
    if (selectedTickets.includes(ticketId)) {
      setSelectedTickets(selectedTickets.filter(id => id !== ticketId));
    } else {
      // Verificar se é do mesmo parceiro
      if (selectedPartner && ticket.partner_id !== selectedPartner) {
        toast.error('Selecione apenas chamados do mesmo parceiro');
        return;
      }
      setSelectedTickets([...selectedTickets, ticketId]);
    }
  };

  const handleToggleAll = () => {
    // Validar se parceiro E contrato estão filtrados
    if (!filters.partner || filters.partner === 'all' || !filters.contract || filters.contract === 'all') {
      toast.error('Por favor, filtre primeiro o Parceiro e o Contrato para marcar todas as linhas');
      return;
    }

    // Se já tem tickets selecionados, desmarcar todos
    if (selectedTickets.length > 0) {
      setSelectedTickets([]);
    } else {
      // Marcar todos os tickets filtrados
      const allIds = filteredData.map(item => item.id);
      setSelectedTickets(allIds);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(item => ({
      'Parceiro': item.partner,
      'Contrato': item.contract_name,
      'Chamado': item.ticket_number,
      'Título': item.title,
      'Tipo de Chamado': item.ticket_type,
      'Módulo': item.module,
      'Recurso': item.resource_name,
      'Cargo': item.resource_position,
      'Status': item.status,
      'Horas Apontadas': item.total_hours,
      ...(item.ticket_type === 'Melhoria' && {
        'Horas Estimadas': item.estimated_hours,
        'Horas Pendentes': Math.max(0, item.estimated_hours - item.total_hours)
      })
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');
    XLSX.writeFile(wb, `fechamento-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportado com sucesso!');
  };

  const handleGenerateClosure = () => {
    if (!selectedMonth) {
      toast.error('Selecione o mês do fechamento');
      return;
    }
    createClosureMutation.mutate({ month: selectedMonth });
  };

  if (loadingTickets || loadingEntries) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fechamento de Horas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label>Parceiro</Label>
              <Select value={filters.partner} onValueChange={(value) => setFilters({ ...filters, partner: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniquePartners.map(partner => (
                    <SelectItem key={partner} value={partner}>{partner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contrato</Label>
              <Select value={filters.contract} onValueChange={(value) => setFilters({ ...filters, contract: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueContracts.map(contract => (
                    <SelectItem key={contract} value={contract}>{contract}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de Chamado</Label>
              <Select value={filters.ticketType} onValueChange={(value) => setFilters({ ...filters, ticketType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueTicketTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chamado</Label>
              <Input
                value={filters.ticketNumber}
                onChange={(e) => setFilters({ ...filters, ticketNumber: e.target.value })}
                placeholder="Nº"
              />
            </div>
            <div>
              <Label>Recurso</Label>
              <Select value={filters.resource} onValueChange={(value) => setFilters({ ...filters, resource: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueResources.map(resource => (
                    <SelectItem key={resource} value={resource}>{resource}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data De</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Até</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
          </div>

          {/* Tabela */}
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <div className="flex flex-col items-center gap-1">
                      <Checkbox
                        checked={selectedTickets.length > 0 && selectedTickets.length === filteredData.length}
                        onCheckedChange={handleToggleAll}
                        disabled={!filters.partner || filters.partner === 'all' || !filters.contract || filters.contract === 'all'}
                        title={(!filters.partner || filters.partner === 'all' || !filters.contract || filters.contract === 'all') 
                          ? 'Filtre Parceiro e Contrato primeiro' 
                          : 'Marcar/Desmarcar todas'}
                      />
                      <span className="text-[10px] text-gray-500">Todas</span>
                    </div>
                  </TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hrs Apontadas</TableHead>
                  <TableHead>Hrs Ajustadas</TableHead>
                  <TableHead>Hrs Estimadas</TableHead>
                  <TableHead>Hrs Pendentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => {
                  const isDisabled = selectedPartner && item.partner_id !== selectedPartner;
                  const pendingHours = item.estimated_hours - item.total_hours;
                  
                  return (
                    <TableRow key={item.id} className={isDisabled ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTickets.includes(item.id)}
                          onCheckedChange={() => handleToggleTicket(item.id)}
                          disabled={isDisabled}
                        />
                      </TableCell>
                      <TableCell>{item.partner}</TableCell>
                      <TableCell>{item.contract_name}</TableCell>
                      <TableCell>
                        <Link 
                          to={createPageUrl('TicketDetails') + `?id=${item.ticket_id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {item.ticket_number}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{item.title}</TableCell>
                      <TableCell>{item.ticket_type}</TableCell>
                      <TableCell>{item.module}</TableCell>
                      <TableCell>{item.resource_name}</TableCell>
                      <TableCell>{item.resource_position}</TableCell>
                      <TableCell>{item.status}</TableCell>
                      <TableCell>{item.total_hours.toFixed(2)}h</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 min-w-[130px]">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 w-20 text-xs px-1"
                            placeholder="—"
                            value={adjustedHours[item.id] ?? ''}
                            onChange={(e) => setAdjustedHours(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const val = adjustedHours[item.id];
                              const num = val !== '' && val !== undefined ? parseFloat(val) : undefined;
                              setSavedAdjustedHours(prev => {
                                const next = { ...prev };
                                if (num !== undefined && !isNaN(num)) next[item.id] = num;
                                else delete next[item.id];
                                return next;
                              });
                              toast.success('Horas ajustadas salvas');
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                        {savedAdjustedHours[item.id] !== undefined && (
                          <span className="text-xs text-green-600 font-medium">{savedAdjustedHours[item.id].toFixed(2)}h</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.ticket_type === 'Melhoria' ? `${item.estimated_hours.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell>
                        {item.ticket_type === 'Melhoria' ? `${pendingHours.toFixed(2)}h` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Rodapé com botões */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              onClick={() => setShowPreview(true)}
              disabled={selectedTickets.length === 0}
              variant="outline"
            >
              <Eye className="mr-2 h-4 w-4" />
              Visualizar Fechamento
            </Button>
            <Button
              onClick={() => setShowGenerateDialog(true)}
              disabled={selectedTickets.length === 0}
            >
              <FileText className="mr-2 h-4 w-4" />
              Gerar Fechamento
            </Button>
            <Button onClick={handleExportExcel} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia do Fechamento</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Parceiro: <strong>{previewData.partner}</strong></p>
                <p className="text-sm text-gray-500">Contrato: <strong>{previewData.contract}</strong></p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Resumo por Cargo</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cargo</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.summaryByPosition.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.position}</TableCell>
                        <TableCell className="text-right">{item.total_hours.toFixed(2)}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total de Horas:</span>
                  <span>{previewData.totalHours.toFixed(2)}h</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>Valor Hora:</span>
                  <span>R$ {previewData.hourlyRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-green-600 mt-2">
                  <span>Total em Reais:</span>
                  <span>R$ {previewData.totalValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Gerar Fechamento */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mês do Fechamento</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
            <Button
              onClick={handleGenerateClosure}
              disabled={createClosureMutation.isPending || !selectedMonth}
              className="w-full"
            >
              {createClosureMutation.isPending ? (
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Gerar Fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}