import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Save, CalendarIcon, Clock, Globe, Building2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const daysOfWeek = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const timezones = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { value: 'America/New_York', label: 'Nova York (UTC-5)' },
  { value: 'Europe/London', label: 'Londres (UTC+0)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (UTC+0)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
];

const defaultDayConfig = (enabled) => ({
  enabled,
  start_time: '08:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
  end_time: '17:00',
  hours: enabled ? 8 : 4,
});

const buildDefaultWorkHours = () =>
  daysOfWeek.reduce((acc, day) => {
    const isWeekday = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day.key);
    return { ...acc, [day.key]: defaultDayConfig(isWeekday) };
  }, {});

export default function CalendarDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const calendarId = urlParams.get('id');
  const isNew = !calendarId;

  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    calendar_type: 'SLA',
    timezone: 'America/Sao_Paulo',
    work_hours: buildDefaultWorkHours(),
    holidays: [],
    active: true,
  });

  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', holiday_type: 'Nacional', hours: 0 });

  const { data: calendar, isLoading } = useQuery({
    queryKey: ['calendar', calendarId],
    queryFn: () => base44.entities.WorkCalendar.filter({ id: calendarId }).then(r => r[0]),
    enabled: !!calendarId,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list(),
  });

  const linkedContracts = contracts.filter(c => c.calendar_id === calendarId || c.calendar_name === calendar?.name);

  useEffect(() => {
    if (calendar) {
      setFormData({
        name: calendar.name || '',
        calendar_type: calendar.calendar_type || 'SLA',
        timezone: calendar.timezone || 'America/Sao_Paulo',
        work_hours: calendar.work_hours || buildDefaultWorkHours(),
        holidays: calendar.holidays || [],
        active: calendar.active !== false,
      });
    }
  }, [calendar]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkCalendar.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries(['calendars']);
      toast.success('Calendário criado com sucesso');
      window.location.href = createPageUrl(`CalendarDetails?id=${created.id}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkCalendar.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendars']);
      queryClient.invalidateQueries(['calendar', calendarId]);
      toast.success('Calendário salvo com sucesso');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkCalendar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendars']);
      toast.success('Calendário excluído');
      window.location.href = createPageUrl('Calendar');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Nome do calendário é obrigatório');
      return;
    }
    if (isNew) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: calendarId, data: formData });
    }
  };

  const handleDelete = () => {
    if (linkedContracts.length > 0) {
      toast.error('Este calendário está vinculado a contratos e não pode ser excluído. Apenas desativação é permitida.');
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este calendário?')) {
      deleteMutation.mutate(calendarId);
    }
  };

  const updateWorkHours = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      work_hours: {
        ...prev.work_hours,
        [day]: { ...prev.work_hours[day], [field]: value },
      },
    }));
  };

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name) {
      toast.error('Preencha a data e o nome do feriado');
      return;
    }
    setFormData(prev => ({
      ...prev,
      holidays: [...prev.holidays, { ...newHoliday }],
    }));
    setNewHoliday({ date: '', name: '', holiday_type: 'Nacional', hours: 0 });
  };

  const removeHoliday = (index) => {
    setFormData(prev => ({
      ...prev,
      holidays: prev.holidays.filter((_, i) => i !== index),
    }));
  };

  const holidayTypeColors = {
    Nacional: 'bg-blue-100 text-blue-800',
    Estadual: 'bg-purple-100 text-purple-800',
    Municipal: 'bg-green-100 text-green-800',
    Empresa: 'bg-orange-100 text-orange-800',
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl('Calendar')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            {isNew ? 'Novo Calendário' : formData.name || 'Editar Calendário'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {isNew ? 'Cadastre um novo calendário de operação' : 'Edite as informações do calendário'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="border-red-300 text-red-600 hover:bg-red-50"
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={16} className="mr-2" />
              Excluir
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save size={16} className="mr-2" />
            {isNew ? 'Criar Calendário' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="general">
              <Globe size={15} className="mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="hours">
              <Clock size={15} className="mr-2" />
              Jornada de Trabalho
            </TabsTrigger>
            <TabsTrigger value="holidays">
              <CalendarIcon size={15} className="mr-2" />
              Feriados
            </TabsTrigger>
            {!isNew && (
              <TabsTrigger value="contracts">
                <FileText size={15} className="mr-2" />
                Contratos Vinculados ({linkedContracts.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* ABA GERAL */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="name">Nome do Calendário *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Horário Comercial Padrão, Suporte 24x7..."
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label>Tipo de Calendário *</Label>
                    <Select
                      value={formData.calendar_type}
                      onValueChange={(v) => setFormData({ ...formData, calendar_type: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SLA">SLA</SelectItem>
                        <SelectItem value="Colaborador">Colaborador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fuso Horário (Timezone)</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <div className="flex items-center gap-3 mt-3">
                      <Switch
                        checked={formData.active}
                        onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                      />
                      <span className={`text-sm font-medium ${formData.active ? 'text-green-700' : 'text-gray-500'}`}>
                        {formData.active ? 'Ativo' : 'Inativo'}
                      </span>
                      {!formData.active && linkedContracts.length > 0 && (
                        <span className="text-xs text-orange-600">
                          ({linkedContracts.length} contrato(s) vinculado(s))
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA JORNADA */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dias de Operação e Jornada de Trabalho</CardTitle>
                <p className="text-sm text-gray-500">
                  Defina os dias úteis e os horários de início, almoço e fim de cada jornada.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {daysOfWeek.map((day) => {
                  const dayData = formData.work_hours[day.key] || defaultDayConfig(false);
                  return (
                    <div key={day.key} className={`border rounded-lg p-4 transition-colors ${dayData.enabled ? 'bg-white border-[#2D1B69]/20' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={dayData.enabled}
                            onCheckedChange={(checked) => updateWorkHours(day.key, 'enabled', checked)}
                          />
                          <Label className={`font-semibold ${dayData.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                            {day.label}
                          </Label>
                        </div>
                        {dayData.enabled && (
                          <Badge variant="outline" className="text-xs">
                            {(() => {
                              // Calcular total de horas automaticamente
                              const start = dayData.start_time?.split(':').map(Number);
                              const end = dayData.end_time?.split(':').map(Number);
                              const lunchStart = dayData.lunch_start?.split(':').map(Number);
                              const lunchEnd = dayData.lunch_end?.split(':').map(Number);
                              if (start && end) {
                                const totalMin = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
                                const lunchMin = (lunchStart && lunchEnd)
                                  ? (lunchEnd[0] * 60 + lunchEnd[1]) - (lunchStart[0] * 60 + lunchStart[1])
                                  : 0;
                                const netMin = Math.max(0, totalMin - lunchMin);
                                return `${(netMin / 60).toFixed(1)}h`;
                              }
                              return `${dayData.hours || 0}h`;
                            })()}
                          </Badge>
                        )}
                      </div>
                      {dayData.enabled && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                          <div>
                            <Label className="text-xs text-gray-500">Início</Label>
                            <Input
                              type="time"
                              value={dayData.start_time || '08:00'}
                              onChange={(e) => updateWorkHours(day.key, 'start_time', e.target.value)}
                              className="mt-1 h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Início Almoço</Label>
                            <Input
                              type="time"
                              value={dayData.lunch_start || '12:00'}
                              onChange={(e) => updateWorkHours(day.key, 'lunch_start', e.target.value)}
                              className="mt-1 h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Fim Almoço</Label>
                            <Input
                              type="time"
                              value={dayData.lunch_end || '13:00'}
                              onChange={(e) => updateWorkHours(day.key, 'lunch_end', e.target.value)}
                              className="mt-1 h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Fim</Label>
                            <Input
                              type="time"
                              value={dayData.end_time || '17:00'}
                              onChange={(e) => updateWorkHours(day.key, 'end_time', e.target.value)}
                              className="mt-1 h-9"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA FERIADOS */}
          <TabsContent value="holidays">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Feriados e Dias Não Úteis</CardTitle>
                <p className="text-sm text-gray-500">
                  Cadastre feriados nacionais, estaduais, municipais ou dias não úteis específicos da empresa.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Formulário adicionar feriado */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold mb-3">Adicionar Feriado / Dia Não Útil</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <Label className="text-xs">Data *</Label>
                      <Input
                        type="date"
                        value={newHoliday.date}
                        onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Nome *</Label>
                      <Input
                        placeholder="Ex: Natal, Dia do Trabalho..."
                        value={newHoliday.name}
                        onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={newHoliday.holiday_type}
                        onValueChange={(v) => setNewHoliday({ ...newHoliday, holiday_type: v })}
                      >
                        <SelectTrigger className="mt-1 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Nacional">Nacional</SelectItem>
                          <SelectItem value="Estadual">Estadual</SelectItem>
                          <SelectItem value="Municipal">Municipal</SelectItem>
                          <SelectItem value="Empresa">Empresa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button type="button" onClick={addHoliday} className="w-full h-9 bg-[#2D1B69] hover:bg-[#2D1B69]/90">
                        <Plus size={16} className="mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lista de feriados */}
                {formData.holidays.length === 0 ? (
                  <p className="text-center text-gray-500 py-6">Nenhum feriado cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {[...formData.holidays]
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((holiday, index) => (
                        <div key={index} className="flex items-center justify-between border rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="text-center min-w-[50px]">
                              <p className="text-lg font-bold text-[#2D1B69] leading-none">
                                {holiday.date.split('-')[2]}
                              </p>
                              <p className="text-xs text-gray-500 uppercase">
                                {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{holiday.name}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                              </p>
                            </div>
                            <Badge className={`text-xs ${holidayTypeColors[holiday.holiday_type] || 'bg-gray-100 text-gray-700'}`}>
                              {holiday.holiday_type || 'Nacional'}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeHoliday(formData.holidays.indexOf(holiday))}
                          >
                            <Trash2 size={15} className="text-red-500" />
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA CONTRATOS VINCULADOS */}
          {!isNew && (
            <TabsContent value="contracts">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 size={18} />
                    Contratos Vinculados
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Contratos que utilizam este calendário.
                    {linkedContracts.length > 0 && (
                      <span className="text-orange-600 ml-1 font-medium">
                        Este calendário não pode ser excluído enquanto houver contratos vinculados.
                      </span>
                    )}
                  </p>
                </CardHeader>
                <CardContent>
                  {linkedContracts.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">Nenhum contrato vinculado</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedContracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between border rounded-lg p-3 bg-gray-50">
                          <div>
                            <p className="font-medium text-sm">{contract.name}</p>
                            <p className="text-xs text-gray-500">{contract.partner_name} — {contract.status}</p>
                          </div>
                          <Link to={createPageUrl(`ServiceContractDetails?id=${contract.id}`)}>
                            <Button variant="ghost" size="sm" className="text-[#2D1B69]">
                              Ver Contrato
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </form>
    </div>
  );
}