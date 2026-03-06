import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, Globe, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function CalendarPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: calendars = [], isLoading } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => base44.entities.WorkCalendar.list(),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkCalendar.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['calendars']);
      toast.success('Calendário excluído com sucesso');
    },
  });

  const handleDelete = (calendar) => {
    const linked = contracts.filter(c => c.calendar_id === calendar.id || c.calendar_name === calendar.name);
    if (linked.length > 0) {
      toast.error(`Este calendário está vinculado a ${linked.length} contrato(s) e não pode ser excluído. Apenas desativação é permitida.`);
      return;
    }
    if (window.confirm('Tem certeza que deseja excluir este calendário?')) {
      deleteMutation.mutate(calendar.id);
    }
  };

  const filteredCalendars = calendars.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getLinkedCount = (calendar) =>
    contracts.filter(c => c.calendar_id === calendar.id || c.calendar_name === calendar.name).length;

  const getActiveDays = (calendar) => {
    const dayMap = { monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom' };
    if (!calendar.work_hours) return '-';
    return Object.entries(calendar.work_hours)
      .filter(([, v]) => v?.enabled)
      .map(([k]) => dayMap[k])
      .join(', ') || '-';
  };

  if (isLoading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendários</h1>
          <p className="text-gray-600 mt-1">Gerencie horários de operação, fusos horários e feriados</p>
        </div>
        <Link to={createPageUrl('CalendarDetails')}>
          <Button className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Calendário
          </Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar calendário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {filteredCalendars.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CalendarIcon size={48} className="mx-auto mb-3 text-gray-300" />
          <p>Nenhum calendário encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCalendars.map((calendar) => {
            const linkedCount = getLinkedCount(calendar);
            return (
              <Card key={calendar.id} className={`transition-opacity ${!calendar.active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CalendarIcon className="w-5 h-5 text-[#2D1B69] shrink-0" />
                      <CardTitle className="text-base truncate">{calendar.name}</CardTitle>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Link to={createPageUrl(`CalendarDetails?id=${calendar.id}`)}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(calendar)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Badge variant="outline">{calendar.calendar_type || 'Colaborador'}</Badge>
                    <Badge className={calendar.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                      {calendar.active !== false ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  {calendar.timezone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Globe size={12} />
                      <span>{calendar.timezone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>{getActiveDays(calendar)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t">
                    <span>{calendar.holidays?.length || 0} feriado(s)</span>
                    {linkedCount > 0 ? (
                      <span className="text-orange-600 font-medium">{linkedCount} contrato(s) vinculado(s)</span>
                    ) : (
                      <span>Sem contratos vinculados</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}