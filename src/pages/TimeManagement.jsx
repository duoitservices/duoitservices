import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Loader2, ChevronLeft, ChevronRight, Trash2, List, Calendar as CalendarIcon, DollarSign, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { AuthContext } from '../components/auth/AuthContext';

const MONTHS = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' }
];

export default function TimeManagement() {
  const { currentUser, loading: authLoading } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [deletingIds, setDeletingIds] = useState([]);
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [filterTicket, setFilterTicket] = useState('');
  const [filterPartner, setFilterPartner] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [viewMode, setViewMode] = useState('list'); // list, monthly, weekly
  const [showValues, setShowValues] = useState(true);

  console.log('[TimeManagement] Current user from context:', currentUser);

  const { data: timeEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['timeEntries', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) {
        console.log('[TimeManagement] No currentUser email, returning empty array');
        return [];
      }
      console.log('[TimeManagement] Fetching time entries for email:', currentUser.email);
      const entries = await base44.entities.TimeEntry.filter({ user_email: currentUser.email }, 'date');
      console.log('[TimeManagement] Found time entries:', entries.length);
      return entries;
    },
    enabled: !!currentUser?.email && !authLoading
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: () => base44.entities.Collaborator.list()
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list()
  });

  const userCollaborator = collaborators.find(c => c.email === currentUser?.email);
  // Usar calendário do SystemUser (cadastrado em Usuários), com fallback para o do Collaborator
  const calendarId = currentUser?.calendar_id || userCollaborator?.calendar_id;
  const userCalendar = calendars.find(c => c.id === calendarId);
  const hourlyRate = currentUser?.hourly_rate || userCollaborator?.hourly_rate || 0;
  const ignoreHolidays = userCollaborator?.ignore_holidays || false;

  console.log('[TimeManagement] User collaborator:', userCollaborator);
  console.log('[TimeManagement] Time entries count:', timeEntries.length);

  // Check if date is holiday
  const isHoliday = (date) => {
    if (!userCalendar?.holidays || ignoreHolidays) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    return userCalendar.holidays.find(h => h.date === dateStr);
  };

  // Get expected hours for a day
  const getExpectedHoursForDay = (date) => {
    if (!userCalendar?.work_hours) return 0;
    
    const dayOfWeek = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    const dayConfig = userCalendar.work_hours[dayName];
    if (!dayConfig?.enabled) return 0;
    
    const scheduledHours = dayConfig.hours || 0;

    // Descontar feriados (se não for ignorar feriados)
    if (!ignoreHolidays) {
      const holiday = isHoliday(date);
      if (holiday) {
        // holiday.hours = horas descontadas; se 0 ou não informado, dia inteiro
        const discount = holiday.hours != null ? holiday.hours : scheduledHours;
        return Math.max(0, scheduledHours - discount);
      }
    }
    
    return scheduledHours;
  };

  // Calculate business hours in the month
  const calculateBusinessHours = () => {
    if (!userCalendar?.work_hours) return 0;
    
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    let totalHours = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      totalHours += getExpectedHoursForDay(date);
    }

    return totalHours;
  };

  const businessHours = calculateBusinessHours();

  // Filter entries for selected month/year
  const monthStart = new Date(selectedYear, selectedMonth, 1);
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

  const filteredEntries = timeEntries.filter(entry => {
    // Exibir apenas horas positivas
    if ((entry.total_hours || 0) <= 0) return false;
    const entryDate = parseISO(entry.date);
    if (entryDate < monthStart || entryDate > monthEnd) return false;
    if (filterTicket && !String(entry.ticket_number).includes(filterTicket)) return false;
    if (filterPartner !== 'all' && entry.partner !== filterPartner) return false;
    if (filterDate && entry.date !== filterDate) return false;
    if (filterStatus !== 'all') {
      const isApproved = entry.approved === true;
      if (filterStatus === 'approved' && !isApproved) return false;
      if (filterStatus === 'not_approved' && isApproved) return false;
    }
    return true;
  });

  const sortedEntries = [...filteredEntries]
    .filter(e => !deletingIds.includes(e.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const uniqueDays = new Set(filteredEntries.map(e => e.date)).size;
  // Somente horas positivas
  const positiveEntries = filteredEntries.filter(e => (e.total_hours || 0) > 0);
  const totalHours = positiveEntries.reduce((acc, e) => acc + (e.total_hours || 0), 0);
  const approvedHours = positiveEntries.filter(e => e.approved).reduce((acc, e) => acc + (e.total_hours || 0), 0);
  const pendingHours = positiveEntries.filter(e => !e.approved && !e.rejected).reduce((acc, e) => acc + (e.total_hours || 0), 0);
  // Total a receber = horas aprovadas * taxa/hora do usuário
  const totalValue = approvedHours * hourlyRate;



  const isOutsideWorkingHours = (entry) => {
    if (!userCalendar?.work_hours) return false;
    
    const entryDate = parseISO(entry.date);
    const dayOfWeek = entryDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    const dayConfig = userCalendar.work_hours[dayName];
    if (!dayConfig?.enabled) return true;
    
    return false;
  };

  const handleDeleteEntry = async (entry) => {
    if (!confirm('Tem certeza que deseja excluir este apontamento?')) return;
    
    // Remove imediatamente da UI
    setDeletingIds(prev => [...prev, entry.id]);

    try {
      await base44.entities.TimeEntry.delete(entry.id);
      
      const ticket = await base44.entities.Ticket.filter({ id: entry.ticket_id }).then(t => t[0]);
      if (ticket) {
        const newLoggedHours = Math.max(0, (ticket.logged_hours || 0) - entry.total_hours);
        await base44.entities.Ticket.update(entry.ticket_id, { logged_hours: newLoggedHours });

        const negativeHours = -entry.total_hours;
        const authorName = `${currentUser?.first_name} ${currentUser?.last_name}`;

        // Criar TimeEntry negativo para refletir o desconto
        await base44.entities.TimeEntry.create({
          ticket_id: entry.ticket_id,
          ticket_number: entry.ticket_number,
          ticket_title: entry.ticket_title,
          partner: entry.partner,
          date: entry.date,
          start_time: entry.start_time,
          end_time: entry.end_time,
          total_hours: negativeHours,
          user_email: entry.user_email,
          user_name: entry.user_name,
          approved: false,
          description: `Estorno: apontamento excluído por ${authorName}`
        });

        // Criar mensagem marcada como apontamento (is_time_entry: true) para aparecer em "Consumo de horas"
        const messageContent = `Apontamento excluído referente ao dia ${format(parseISO(entry.date), 'dd/MM/yyyy')} — Desconto de ${entry.total_hours.toFixed(2)}h aplicado`;
        await base44.entities.TicketMessage.create({
          ticket_id: entry.ticket_id,
          content: messageContent,
          is_private: true,
          is_time_entry: true,
          time_entry_data: {
            date: entry.date,
            start_time: entry.start_time,
            end_time: entry.end_time,
            total_hours: negativeHours
          },
          author_name: authorName,
          author_email: currentUser?.email
        });
      }
      
      await refetch();
      toast.success('Apontamento excluído com sucesso');
    } catch (error) {
      setDeletingIds(prev => prev.filter(id => id !== entry.id));
      toast.error('Erro ao excluir apontamento');
    }
  };

  const exportToExcel = () => {
    const headers = ['Data', 'Chamado', 'Título', 'Parceiro', 'Hora Inicial', 'Hora Final', 'Total Horas', 'Status'];
    const rows = filteredEntries.map(entry => [
      format(parseISO(entry.date), 'dd/MM/yyyy'),
      entry.ticket_number,
      entry.ticket_title,
      entry.partner,
      entry.start_time,
      entry.end_time,
      entry.total_hours?.toFixed(2),
      entry.approved ? 'Aprovado' : 'Não Aprovado'
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `apontamentos_${MONTHS[selectedMonth].label}_${selectedYear}.csv`;
    link.click();
  };

  // Get hours for a specific day
  const getHoursForDay = (date) => {
    const dayEntries = filteredEntries.filter(entry => 
      isSameDay(parseISO(entry.date), date)
    );

    const totalWorked = dayEntries.reduce((acc, e) => acc + (e.total_hours || 0), 0);
    const approvedHours = dayEntries.filter(e => e.approved).reduce((acc, e) => acc + (e.total_hours || 0), 0);
    const notApprovedHours = totalWorked - approvedHours;
    
    const normalHours = Math.min(totalWorked, 8);
    const overtimeHours = Math.max(0, totalWorked - 8);
    
    const expectedHours = getExpectedHoursForDay(date);
    const pendingHours = Math.max(0, expectedHours - totalWorked);

    return { 
      normalHours, 
      overtimeHours, 
      pendingHours,
      approvedHours,
      notApprovedHours,
      total: totalWorked 
    };
  };

  if (authLoading || isLoading) {
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Calendar & Stats */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 flex flex-col gap-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4">Meus Apontamentos</h2>
        </div>

        {/* Year Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedYear(prev => prev - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-bold text-gray-800">{selectedYear}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedYear(prev => prev + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Month Grid */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map(month => (
                <button
                  key={month.value}
                  onClick={() => setSelectedMonth(month.value)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    selectedMonth === month.value
                      ? "bg-[#2D1B69] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {month.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mini Stats */}
        <div className="space-y-2">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Horas Estimadas do mês</p>
              <p className="text-xl font-bold text-gray-800">{businessHours.toFixed(0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Dias Lançados</p>
              <p className="text-xl font-bold text-gray-800">{uniqueDays}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Horas Trabalhadas</p>
              <p className="text-xl font-bold text-gray-800">{totalHours.toFixed(2)}h</p>
            </CardContent>
          </Card>

        </div>

        {/* Action Buttons */}
        <div className="space-y-2 mt-4">
          <Button
            onClick={exportToExcel}
            className="w-full bg-[#2D1B69] hover:bg-[#2D1B69]/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Baixar Relatório de Horas
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {}}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar via Planilha
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          Última atualização: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </p>
      </div>

      {/* Right Stats Column */}
      <div className="w-60 bg-gray-50 border-l border-gray-200 p-4 flex flex-col gap-3 overflow-y-auto">
        <h3 className="text-sm font-semibold text-gray-700">Resumo</h3>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 mb-1">Horas Pendentes</p>
            <p className="text-xl font-bold text-orange-600">{pendingHours.toFixed(2)}h</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-gray-500 mb-1">Horas Aprovadas</p>
            <p className="text-xl font-bold text-green-600">{approvedHours.toFixed(2)}h</p>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowValues(!showValues)}
          className="w-full"
        >
          {showValues ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showValues ? 'Ocultar' : 'Exibir'} Valores
        </Button>

        {showValues && (
          <Card className="bg-gradient-to-br from-[#2D1B69] to-[#4338ca] text-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/80">Total a Receber</p>
                <DollarSign className="w-4 h-4 text-white/40" />
              </div>
              <p className="text-lg font-bold">R$ {totalValue.toFixed(2)}</p>
              <p className="text-[10px] text-white/70 mt-1">{approvedHours.toFixed(1)}h × R$ {hourlyRate.toFixed(2)}/h</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* View Mode Switcher */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              onClick={() => setViewMode('monthly')}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Mensal
            </Button>
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              onClick={() => setViewMode('weekly')}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Semanal
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        {viewMode === 'list' && (
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-xs">Data Lançamento</Label>
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">ID Chamado</Label>
                <Input
                  placeholder="Filtrar por chamado"
                  value={filterTicket}
                  onChange={(e) => setFilterTicket(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs">Parceiro</Label>
                <Select value={filterPartner} onValueChange={setFilterPartner}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {partners
                      .filter(p => p.active !== false)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="not_approved">Não Aprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'list' && (
            <div className="border rounded-lg bg-white">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50 z-10">
                  <TableRow>
                    <TableHead className="w-32">Data</TableHead>
                    <TableHead className="w-24">Chamado</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-32">Parceiro</TableHead>
                    <TableHead className="w-28">Hora Inicial</TableHead>
                    <TableHead className="w-28">Hora Final</TableHead>
                    <TableHead className="w-28">Total</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map(entry => (
                    <TableRow 
                      key={entry.id} 
                      className={cn(
                        "hover:bg-gray-50",
                        isOutsideWorkingHours(entry) && "bg-yellow-50"
                      )}
                    >
                      <TableCell>{format(parseISO(entry.date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-mono text-[#2D1B69]">#{entry.ticket_number}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate">{entry.ticket_title}</div>
                        {entry.description && (
                          <div className="text-xs text-gray-500 truncate">{entry.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{entry.partner || '-'}</TableCell>
                      <TableCell>{entry.start_time}</TableCell>
                      <TableCell>{entry.end_time}</TableCell>
                      <TableCell className="font-medium">{entry.total_hours?.toFixed(2)}h</TableCell>
                      <TableCell>
                        {entry.approved ? (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Aprovado</span>
                        ) : entry.rejected ? (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">Reprovado</span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">Pendente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!entry.approved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                        Nenhum apontamento encontrado para {MONTHS[selectedMonth].label} de {selectedYear}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {viewMode === 'monthly' && (
            <MonthlyView 
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              getHoursForDay={getHoursForDay}
              isHoliday={isHoliday}
              filteredEntries={filteredEntries}
            />
          )}

          {viewMode === 'weekly' && (
            <WeeklyView 
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              getHoursForDay={getHoursForDay}
              isHoliday={isHoliday}
              filteredEntries={filteredEntries}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Monthly Calendar View Component
function MonthlyView({ selectedYear, selectedMonth, getHoursForDay, isHoliday, filteredEntries }) {
  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: monthEnd });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = day >= monthStart && day <= monthEnd;
            if (!isCurrentMonth && day < monthStart) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            if (!isCurrentMonth) return null;

            const { normalHours, overtimeHours, pendingHours, approvedHours, notApprovedHours, total } = getHoursForDay(day);
            const hasEntries = total > 0;
            const isToday = isSameDay(day, new Date());
            const holiday = isHoliday(day);

            const dayEntries = filteredEntries.filter(entry => 
              isSameDay(parseISO(entry.date), day)
            );

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "aspect-square border rounded-lg p-2 flex flex-col overflow-hidden",
                  isToday && "border-[#2D1B69] border-2",
                  holiday && "bg-red-50",
                  !holiday && !hasEntries && "bg-gray-50",
                  !holiday && hasEntries && "bg-white"
                )}
              >
                <div className="text-sm font-semibold text-gray-800 mb-1">
                  {format(day, 'd')}
                </div>
                {holiday && (
                  <div className="text-xs text-red-600 font-medium">Feriado</div>
                )}
                {hasEntries && (
                  <div className="flex-1 flex flex-col space-y-1 overflow-hidden">
                    <div className="flex flex-wrap gap-1">
                      {normalHours > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          {normalHours.toFixed(1)}h
                        </span>
                      )}
                      {overtimeHours > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-700">
                          +{overtimeHours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[9px] text-gray-500">
                      Aprov: {approvedHours.toFixed(1)}h
                    </div>
                    
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayEntries.map(entry => (
                        <div key={entry.id} className="text-[9px] text-gray-700 truncate">
                          <span className="font-mono font-semibold">#{entry.ticket_number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Weekly View Component - Timeline com horas do dia
function WeeklyView({ selectedYear, selectedMonth, getHoursForDay, isHoliday, filteredEntries }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Gerar array de horas (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Semana de {format(weekStart, 'dd/MM/yyyy')}
        </h3>
        
        <div className="grid grid-cols-8 gap-2">
          {/* Header com dias da semana */}
          <div className="text-xs font-semibold text-gray-500 text-right pr-2">Hora</div>
          {weekDays.map(day => {
            const isToday = isSameDay(day, new Date());
            const holiday = isHoliday(day);
            
            return (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "text-center py-2 rounded-t-lg",
                  isToday && "bg-[#2D1B69] text-white",
                  !isToday && "text-gray-700"
                )}
              >
                <div className="text-xs">{format(day, 'EEE', { locale: ptBR })}</div>
                <div className="text-lg font-bold">{format(day, 'd')}</div>
                {holiday && <div className="text-[9px] text-red-600">Feriado</div>}
              </div>
            );
          })}
          
          {/* Grid de horas */}
          {hours.map(hour => (
            <React.Fragment key={hour}>
              <div className="text-xs text-gray-500 text-right pr-2 py-1">
                {String(hour).padStart(2, '0')}:00
              </div>
              
              {weekDays.map(day => {
                const dayEntries = filteredEntries.filter(entry => {
                  if (!isSameDay(parseISO(entry.date), day)) return false;
                  
                  // Verificar se o apontamento está nesta hora
                  const startHour = parseInt(entry.start_time?.split(':')[0] || '0');
                  const endHour = parseInt(entry.end_time?.split(':')[0] || '0');
                  
                  return hour >= startHour && hour <= endHour;
                });
                
                const { normalHours, overtimeHours, total } = getHoursForDay(day);
                const hasAnyEntries = total > 0;
                const hasEntriesInHour = dayEntries.length > 0;
                const isOvertime = overtimeHours > 0 && hour >= 8;
                
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={cn(
                      "border-r border-b border-gray-200 py-1 px-1 min-h-[30px]",
                      hasEntriesInHour && !isOvertime && "bg-green-100",
                      hasEntriesInHour && isOvertime && "bg-yellow-100",
                      !hasEntriesInHour && hasAnyEntries && "bg-gray-50"
                    )}
                  >
                    {hasEntriesInHour && (
                      <div className="space-y-0.5">
                        {dayEntries.map(entry => (
                          <div 
                            key={entry.id} 
                            className="text-[9px] truncate font-medium"
                            title={`#${entry.ticket_number} - ${entry.ticket_title}`}
                          >
                            #{entry.ticket_number}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}