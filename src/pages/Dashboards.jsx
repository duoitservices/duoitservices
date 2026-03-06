import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { Loader2, Ticket, Clock, CheckCircle2, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

const COLORS = ['#2D1B69', '#4338ca', '#f97316', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4'];

const categories = ["Backlog", "Dúvida", "Incidente", "Manutenção", "Melhoria", "Plantão", "Problema"];
const modules = ["Compras e Suprimentos", "Desenvolvimento ABAP", "Finanças", "Gestão de Armazém", "Gestão de Ativos", "Gestão de Projetos", "Infraestrutura e Manutenção", "Integração", "Manufatura", "Vendas e Distribuição"];
const priorities = ["Baixa", "Média", "Alta", "Emergencial"];

export default function Dashboards() {
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('30');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['allTickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date'),
  });

  const filteredTickets = tickets.filter(ticket => {
    if (filterCategory !== 'all' && ticket.category !== filterCategory) return false;
    if (filterModule !== 'all' && ticket.module !== filterModule) return false;
    if (filterPriority !== 'all' && ticket.priority !== filterPriority) return false;
    
    const ticketDate = new Date(ticket.created_date);
    const periodStart = subDays(new Date(), parseInt(filterPeriod));
    if (ticketDate < periodStart) return false;
    
    return true;
  });

  // Calculate metrics
  const totalTickets = filteredTickets.length;
  const openTickets = filteredTickets.filter(t => t.status !== 'Finalizado').length;
  const closedTickets = filteredTickets.filter(t => t.status === 'Finalizado').length;
  const avgResolutionTime = filteredTickets
    .filter(t => t.closed_at && t.opened_at)
    .reduce((acc, t) => {
      const hours = (new Date(t.closed_at) - new Date(t.opened_at)) / (1000 * 60 * 60);
      return acc + hours;
    }, 0) / (closedTickets || 1);

  const slaResponseMet = filteredTickets.filter(t => t.sla_response_met === true).length;
  const slaSolutionMet = filteredTickets.filter(t => t.sla_solution_met === true).length;

  // Charts data
  const categoryData = categories.map(cat => ({
    name: cat,
    value: filteredTickets.filter(t => t.category === cat).length
  })).filter(d => d.value > 0);

  const moduleData = modules.map(mod => ({
    name: mod.length > 15 ? mod.substring(0, 15) + '...' : mod,
    fullName: mod,
    value: filteredTickets.filter(t => t.module === mod).length
  })).filter(d => d.value > 0);

  const statusData = [
    { name: 'Abertos', value: openTickets, color: '#f97316' },
    { name: 'Finalizados', value: closedTickets, color: '#22c55e' }
  ];

  const priorityData = priorities.map((p, idx) => ({
    name: p,
    value: filteredTickets.filter(t => t.priority === p).length,
    color: COLORS[idx]
  })).filter(d => d.value > 0);

  // Trend data (last 7 days)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'dd/MM');
    const count = filteredTickets.filter(t => {
      const tDate = new Date(t.created_date);
      return format(tDate, 'dd/MM') === dateStr;
    }).length;
    return { date: dateStr, chamados: count };
  });

  // SLA compliance
  const slaData = [
    { name: 'SLA Resposta', cumprido: slaResponseMet, total: filteredTickets.filter(t => t.sla_response_met !== undefined).length },
    { name: 'SLA Solução', cumprido: slaSolutionMet, total: filteredTickets.filter(t => t.sla_solution_met !== undefined).length }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboards - Área do Gestor</h1>
        <p className="text-gray-500 text-sm mt-1">Análise completa e métricas dos chamados</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-40">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Período</label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Categoria</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Módulo</label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Prioridade</label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-[#2D1B69] to-[#4338ca] text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Total de Chamados</p>
                <p className="text-3xl font-bold mt-1">{totalTickets}</p>
              </div>
              <Ticket size={40} className="text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Chamados Abertos</p>
                <p className="text-3xl font-bold mt-1">{openTickets}</p>
              </div>
              <Clock size={40} className="text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Chamados Finalizados</p>
                <p className="text-3xl font-bold mt-1">{closedTickets}</p>
              </div>
              <CheckCircle2 size={40} className="text-white/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Tempo Médio Resolução</p>
                <p className="text-3xl font-bold mt-1">{avgResolutionTime.toFixed(1)}h</p>
              </div>
              <TrendingUp size={40} className="text-white/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Módulo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, name, props) => [value, props.payload.fullName]} />
                <Bar dataKey="value" fill="#2D1B69" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Chamados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#22c55e', '#eab308', '#f97316', '#ef4444'][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conformidade SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-4">
              {slaData.map((sla, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{sla.name}</span>
                    <span className="text-sm text-gray-500">
                      {sla.cumprido}/{sla.total} ({sla.total > 0 ? ((sla.cumprido / sla.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#2D1B69] to-[#4338ca] rounded-full"
                      style={{ width: `${sla.total > 0 ? (sla.cumprido / sla.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tendência de Abertura (Últimos 7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="chamados" 
                stroke="#2D1B69" 
                fill="url(#colorGradient)" 
                strokeWidth={2}
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D1B69" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2D1B69" stopOpacity={0}/>
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}