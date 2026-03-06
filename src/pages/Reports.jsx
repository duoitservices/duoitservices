import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [reportType, setReportType] = useState('incident');
  const [filters, setFilters] = useState({
    category: 'all',
    module: 'all',
    status: 'all',
    priority: 'all',
    dateFrom: '',
    dateTo: '',
    partner: '',
    ticketType: 'all'
  });

  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['allTickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date'),
  });

  const filteredTickets = useMemo(() => {
    return allTickets.filter(ticket => {
      if (filters.category !== 'all' && ticket.category !== filters.category) return false;
      if (filters.module !== 'all' && ticket.module !== filters.module) return false;
      if (filters.status !== 'all' && ticket.status !== filters.status) return false;
      if (filters.priority !== 'all' && ticket.priority !== filters.priority) return false;
      if (filters.ticketType !== 'all' && ticket.ticket_type !== filters.ticketType) return false;
      if (filters.partner && !ticket.partner?.toLowerCase().includes(filters.partner.toLowerCase())) return false;
      if (filters.dateFrom && new Date(ticket.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(ticket.created_date) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [allTickets, filters]);

  const exportToExcel = () => {
    const data = filteredTickets.map(t => ({
      'ID': t.ticket_number,
      'Título': t.title,
      'Tipo': t.ticket_type,
      'Categoria': t.category,
      'Módulo': t.module,
      'Status': t.status,
      'Prioridade': t.priority,
      'Parceiro': t.partner,
      'Recurso Principal': t.main_resource,
      'Gestor': t.manager,
      'Horas Estimadas': t.estimated_hours,
      'Horas Apontadas': t.logged_hours,
      'SLA Resposta': t.sla_response_met ? 'Sim' : 'Não',
      'SLA Solução': t.sla_solution_met ? 'Sim' : 'Não',
      'Data Abertura': t.opened_at ? format(new Date(t.opened_at), 'dd/MM/yyyy HH:mm') : '',
      'Data Fechamento': t.closed_at ? format(new Date(t.closed_at), 'dd/MM/yyyy HH:mm') : '',
      'Criado por': t.created_by
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio_${reportType}_${format(new Date(), 'ddMMyyyy_HHmm')}.xlsx`);
  };

  // Relatórios ITIL específicos
  const getReportData = () => {
    switch (reportType) {
      case 'incident':
        return {
          title: 'Relatório de Incidentes',
          description: 'Todos os incidentes registrados no sistema',
          data: filteredTickets.filter(t => t.category === 'Incidente')
        };
      case 'problem':
        return {
          title: 'Relatório de Problemas',
          description: 'Análise de problemas identificados',
          data: filteredTickets.filter(t => t.category === 'Problema')
        };
      case 'change':
        return {
          title: 'Relatório de Mudanças',
          description: 'Controle de mudanças realizadas',
          data: filteredTickets.filter(t => t.ticket_type === 'Mudança')
        };
      case 'sla':
        return {
          title: 'Relatório de SLA',
          description: 'Análise de cumprimento de SLAs',
          data: filteredTickets.filter(t => t.sla_response_met !== undefined || t.sla_solution_met !== undefined)
        };
      case 'workload':
        return {
          title: 'Relatório de Carga de Trabalho',
          description: 'Distribuição de chamados por recurso',
          data: filteredTickets
        };
      case 'resolution':
        return {
          title: 'Relatório de Resolução',
          description: 'Análise de tempo de resolução',
          data: filteredTickets.filter(t => t.closed_at)
        };
      default:
        return {
          title: 'Relatório Geral',
          description: 'Todos os chamados',
          data: filteredTickets
        };
    }
  };

  const reportData = getReportData();

  const resetFilters = () => {
    setFilters({
      category: 'all',
      module: 'all',
      status: 'all',
      priority: 'all',
      dateFrom: '',
      dateTo: '',
      partner: '',
      ticketType: 'all'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Relatórios ITIL</h1>
        <p className="text-gray-500 text-sm mt-1">Relatórios detalhados baseados em processos ITIL</p>
      </div>

      {/* Tipo de Relatório */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tipo de Relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="incident">Incidentes</SelectItem>
              <SelectItem value="problem">Problemas</SelectItem>
              <SelectItem value="change">Mudanças</SelectItem>
              <SelectItem value="sla">Cumprimento de SLA</SelectItem>
              <SelectItem value="workload">Carga de Trabalho</SelectItem>
              <SelectItem value="resolution">Tempo de Resolução</SelectItem>
              <SelectItem value="general">Geral</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Tipo de Chamado</Label>
              <Select value={filters.ticketType} onValueChange={(v) => setFilters({...filters, ticketType: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Requisição">Requisição</SelectItem>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Problema">Problema</SelectItem>
                  <SelectItem value="Mudança">Mudança</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={filters.category} onValueChange={(v) => setFilters({...filters, category: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Backlog">Backlog</SelectItem>
                  <SelectItem value="Dúvida">Dúvida</SelectItem>
                  <SelectItem value="Incidente">Incidente</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Melhoria">Melhoria</SelectItem>
                  <SelectItem value="Plantão">Plantão</SelectItem>
                  <SelectItem value="Problema">Problema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Módulo</Label>
              <Select value={filters.module} onValueChange={(v) => setFilters({...filters, module: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Compras e Suprimentos">Compras e Suprimentos</SelectItem>
                  <SelectItem value="Desenvolvimento ABAP">Desenvolvimento ABAP</SelectItem>
                  <SelectItem value="Finanças">Finanças</SelectItem>
                  <SelectItem value="Gestão de Armazém">Gestão de Armazém</SelectItem>
                  <SelectItem value="Gestão de Ativos">Gestão de Ativos</SelectItem>
                  <SelectItem value="Gestão de Projetos">Gestão de Projetos</SelectItem>
                  <SelectItem value="Infraestrutura e Manutenção">Infraestrutura e Manutenção</SelectItem>
                  <SelectItem value="Integração">Integração</SelectItem>
                  <SelectItem value="Manufatura">Manufatura</SelectItem>
                  <SelectItem value="Vendas e Distribuição">Vendas e Distribuição</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aguardando Atendimento">Aguardando Atendimento</SelectItem>
                  <SelectItem value="Em análise">Em análise</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                  <SelectItem value="Paralisado">Paralisado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={filters.priority} onValueChange={(v) => setFilters({...filters, priority: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Emergencial">Emergencial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Parceiro</Label>
              <Input
                placeholder="Nome do parceiro"
                value={filters.partner}
                onChange={(e) => setFilters({...filters, partner: e.target.value})}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={resetFilters}>
              Limpar Filtros
            </Button>
            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
              <Download size={16} className="mr-2" />
              Exportar para Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relatório */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{reportData.title}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">{reportData.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="text-[#2D1B69]" size={24} />
              <span className="text-2xl font-bold text-[#2D1B69]">{reportData.data.length}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-gray-50">ID</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Título</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Tipo</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Categoria</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Status</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Prioridade</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Parceiro</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Recurso</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">H. Estimadas</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">H. Apontadas</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">SLA Resp.</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">SLA Sol.</TableHead>
                  <TableHead className="sticky top-0 bg-gray-50">Data Abertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.data.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">#{ticket.ticket_number}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.title}</TableCell>
                    <TableCell>{ticket.ticket_type || '-'}</TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{ticket.status}</TableCell>
                    <TableCell>{ticket.priority}</TableCell>
                    <TableCell>{ticket.partner || '-'}</TableCell>
                    <TableCell>{ticket.main_resource || '-'}</TableCell>
                    <TableCell>{ticket.estimated_hours || 0}h</TableCell>
                    <TableCell>{ticket.logged_hours || 0}h</TableCell>
                    <TableCell>
                      {ticket.sla_response_met === true ? '✓' : ticket.sla_response_met === false ? '✗' : '-'}
                    </TableCell>
                    <TableCell>
                      {ticket.sla_solution_met === true ? '✓' : ticket.sla_solution_met === false ? '✗' : '-'}
                    </TableCell>
                    <TableCell>
                      {ticket.opened_at ? format(new Date(ticket.opened_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}