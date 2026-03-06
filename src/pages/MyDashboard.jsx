import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3, PieChart, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, PieChart as RePieChart, Pie, LineChart, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils";

const COLORS = ['#2D1B69', '#4338ca', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e0e7ff', '#818cf8'];

export default function MyDashboard() {
  const [filters, setFilters] = useState({
    category: 'all',
    module: 'all',
    status: 'all',
    priority: 'all',
    dateFrom: '',
    dateTo: '',
    partner: ''
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['myTickets'],
    queryFn: async () => {
      const tickets = await base44.entities.Ticket.list('-created_date');
      const user = await base44.auth.me();
      return tickets.filter(ticket => 
        ticket.main_resource === user.email || 
        ticket.other_resources?.includes(user.email)
      );
    },
  });

  const filteredTickets = useMemo(() => {
    return allTickets.filter(ticket => {
      if (filters.category !== 'all' && ticket.category !== filters.category) return false;
      if (filters.module !== 'all' && ticket.module !== filters.module) return false;
      if (filters.status !== 'all' && ticket.status !== filters.status) return false;
      if (filters.priority !== 'all' && ticket.priority !== filters.priority) return false;
      if (filters.partner && !ticket.partner?.toLowerCase().includes(filters.partner.toLowerCase())) return false;
      if (filters.dateFrom && new Date(ticket.created_date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(ticket.created_date) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [allTickets, filters]);

  // Métricas ITIL
  const metrics = useMemo(() => {
    const total = filteredTickets.length;
    const byStatus = filteredTickets.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    
    const byCategory = filteredTickets.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});
    
    const byPriority = filteredTickets.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    
    const byModule = filteredTickets.reduce((acc, t) => {
      acc[t.module] = (acc[t.module] || 0) + 1;
      return acc;
    }, {});

    const slaResponse = filteredTickets.filter(t => t.sla_response_met === true).length;
    const slaSolution = filteredTickets.filter(t => t.sla_solution_met === true).length;
    const closedTickets = filteredTickets.filter(t => t.status === 'Finalizado').length;
    
    const totalLoggedHours = filteredTickets.reduce((sum, t) => sum + (t.logged_hours || 0), 0);
    const totalEstimatedHours = filteredTickets.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    return {
      total,
      byStatus: Object.entries(byStatus).map(([name, value]) => ({ name, value })),
      byCategory: Object.entries(byCategory).map(([name, value]) => ({ name, value })),
      byPriority: Object.entries(byPriority).map(([name, value]) => ({ name, value })),
      byModule: Object.entries(byModule).map(([name, value]) => ({ name, value })),
      slaResponseRate: total > 0 ? ((slaResponse / total) * 100).toFixed(1) : 0,
      slaSolutionRate: total > 0 ? ((slaSolution / total) * 100).toFixed(1) : 0,
      closedRate: total > 0 ? ((closedTickets / total) * 100).toFixed(1) : 0,
      totalLoggedHours: totalLoggedHours.toFixed(2),
      totalEstimatedHours: totalEstimatedHours.toFixed(2),
      efficiency: totalEstimatedHours > 0 ? ((totalLoggedHours / totalEstimatedHours) * 100).toFixed(1) : 0
    };
  }, [filteredTickets]);

  const resetFilters = () => {
    setFilters({
      category: 'all',
      module: 'all',
      status: 'all',
      priority: 'all',
      dateFrom: '',
      dateTo: '',
      partner: ''
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
        <h1 className="text-2xl font-bold text-gray-800">Meu Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Análise completa dos seus chamados atribuídos</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total de Chamados</p>
                <p className="text-3xl font-bold mt-2">{metrics.total}</p>
              </div>
              <BarChart3 size={40} className="opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Taxa de Fechamento</p>
                <p className="text-3xl font-bold mt-2">{metrics.closedRate}%</p>
              </div>
              <TrendingUp size={40} className="opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">SLA Resposta</p>
                <p className="text-3xl font-bold mt-2">{metrics.slaResponseRate}%</p>
              </div>
              <Clock size={40} className="opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">SLA Solução</p>
                <p className="text-3xl font-bold mt-2">{metrics.slaSolutionRate}%</p>
              </div>
              <AlertCircle size={40} className="opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Horas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Horas Estimadas</p>
            <p className="text-2xl font-bold text-[#2D1B69] mt-2">{metrics.totalEstimatedHours}h</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Horas Apontadas</p>
            <p className="text-2xl font-bold text-[#2D1B69] mt-2">{metrics.totalLoggedHours}h</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Eficiência</p>
            <p className={cn("text-2xl font-bold mt-2", 
              parseFloat(metrics.efficiency) <= 100 ? "text-green-600" : "text-red-600"
            )}>{metrics.efficiency}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.byStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2D1B69" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={metrics.byCategory}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={metrics.byPriority}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {metrics.byPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.byModule}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} fontSize={10} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4338ca" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}