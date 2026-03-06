import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

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

export default function TimeEntry() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.TimeEntry.filter({ user_email: user.email }, 'date');
    },
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
  const userCalendar = calendars.find(c => c.id === userCollaborator?.calendar_id) || calendars[0];
  const hourlyRate = userCollaborator?.hourly_rate || 0;
  const ignoreHolidays = userCollaborator?.ignore_holidays || false;

  // Get days in month
  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get calendar start (Monday)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: monthEnd });

  // Filter entries for selected month
  const monthEntries = timeEntries.filter(entry => {
    const entryDate = parseISO(entry.date);
    return entryDate >= monthStart && entryDate <= monthEnd;
  });

  // Check if date is holiday
  const isHoliday = (date) => {
    if (!userCalendar?.holidays || ignoreHolidays) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return userCalendar.holidays.some(h => h.date === dateStr);
  };

  // Get expected hours for a day
  const getExpectedHoursForDay = (date) => {
    if (!userCalendar?.work_hours) return 8;
    
    if (isHoliday(date)) return 0; // Holidays = 0 expected hours
    
    const dayOfWeek = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    const dayConfig = userCalendar.work_hours[dayName];
    if (!dayConfig?.enabled) return 0;
    
    const [startHour, startMin] = (dayConfig.start || '08:00').split(':').map(Number);
    const [endHour, endMin] = (dayConfig.end || '18:00').split(':').map(Number);
    return (endHour + endMin / 60) - (startHour + startMin / 60);
  };

  // Calculate hours per day
  const getHoursForDay = (date) => {
    const dayEntries = monthEntries.filter(entry => 
      isSameDay(parseISO(entry.date), date)
    );

    const totalWorked = dayEntries.reduce((acc, e) => acc + (e.total_hours || 0), 0);
    const approvedHours = dayEntries.filter(e => e.approved).reduce((acc, e) => acc + (e.total_hours || 0), 0);
    const notApprovedHours = totalWorked - approvedHours;
    
    const maxNormal = 8;
    const normalHours = Math.min(totalWorked, maxNormal);
    const overtimeHours = Math.max(0, totalWorked - maxNormal);
    
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

  // Calculate business hours in the month (considering holidays)
  const calculateBusinessHours = () => {
    if (!userCalendar?.work_hours) return 0;
    
    let totalHours = 0;
    daysInMonth.forEach(date => {
      const expectedHours = getExpectedHoursForDay(date);
      totalHours += expectedHours;
    });

    return totalHours;
  };

  const businessHours = calculateBusinessHours();

  // Calculate totals
  let totalNormalHours = 0;
  let totalOvertimeHours = 0;
  
  daysInMonth.forEach(day => {
    const { normalHours, overtimeHours } = getHoursForDay(day);
    totalNormalHours += normalHours;
    totalOvertimeHours += overtimeHours;
  });

  const totalHours = totalNormalHours + totalOvertimeHours;
  const approvedHours = monthEntries.filter(e => e.approved).reduce((acc, e) => acc + (e.total_hours || 0), 0);
  const pendingHours = totalHours - approvedHours;

  const normalValue = totalNormalHours * hourlyRate;
  const overtimeValue = totalOvertimeHours * hourlyRate;
  const totalValue = normalValue + overtimeValue;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header with Month Filter */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800">Acompanhamento Mensal</h1>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedYear(prev => prev - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-bold text-gray-800 min-w-[80px] text-center">{selectedYear}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedYear(prev => prev + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">
            <Card>
              <CardContent className="p-6">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Days before month starts */}
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

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "aspect-square border rounded-lg p-2 flex flex-col",
                          isToday && "border-[#2D1B69] border-2",
                          holiday && "bg-red-50",
                          !holiday && !hasEntries && "bg-gray-50",
                          !holiday && hasEntries && overtimeHours === 0 && "bg-white",
                          !holiday && hasEntries && overtimeHours > 0 && "bg-yellow-50"
                        )}
                      >
                        <div className="text-sm font-semibold text-gray-800 mb-1">
                          {format(day, 'd')}
                        </div>
                        {holiday && (
                          <div className="text-xs text-red-600 font-medium">Feriado</div>
                        )}
                        {hasEntries && (
                          <div className="flex-1 flex flex-col justify-between text-xs space-y-1">
                            <div className="space-y-0.5">
                              {normalHours > 0 && (
                                <div className="text-gray-700 font-medium">
                                  N: {normalHours.toFixed(1)}h
                                </div>
                              )}
                              {overtimeHours > 0 && (
                                <div className="text-orange-600 font-medium">
                                  E: {overtimeHours.toFixed(1)}h
                                </div>
                              )}
                              {pendingHours > 0 && (
                                <div className="text-red-500 font-medium">
                                  P: {pendingHours.toFixed(1)}h
                                </div>
                              )}
                            </div>
                            <div className="pt-1 border-t border-gray-200 space-y-0.5">
                              {approvedHours > 0 && (
                                <div className="text-green-600 text-[10px]">
                                  ✓ {approvedHours.toFixed(1)}h
                                </div>
                              )}
                              {notApprovedHours > 0 && (
                                <div className="text-red-600 text-[10px]">
                                  ✗ {notApprovedHours.toFixed(1)}h
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Sidebar - Stats */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 p-6 overflow-y-auto space-y-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Resumo do Mês</h2>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Total de Horas</p>
              <p className="text-xl font-bold text-gray-800">{totalHours.toFixed(2)}h</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Horas Aprovadas</p>
              <p className="text-xl font-bold text-green-600">{approvedHours.toFixed(2)}h</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-gray-500 mb-1">Horas Pendentes</p>
              <p className="text-xl font-bold text-orange-600">{pendingHours.toFixed(2)}h</p>
            </CardContent>
          </Card>

          {/* Values */}
          <div className="pt-4 space-y-3">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 mb-1">Horas Normais</p>
                  <p className="text-lg font-bold">R$ {normalValue.toFixed(2)}</p>
                  <p className="text-[10px] text-white/70 mt-1">{totalNormalHours.toFixed(1)}h</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/30" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 mb-1">Horas Excedentes</p>
                  <p className="text-lg font-bold">R$ {overtimeValue.toFixed(2)}</p>
                  <p className="text-[10px] text-white/70 mt-1">{totalOvertimeHours.toFixed(1)}h</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/30" />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#2D1B69] to-[#4338ca] text-white">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 mb-1">Total a Receber</p>
                  <p className="text-lg font-bold">R$ {totalValue.toFixed(2)}</p>
                  <p className="text-[10px] text-white/70 mt-1">{totalHours.toFixed(1)}h</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/30" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}