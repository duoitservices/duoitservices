import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, Save, X, CalendarIcon, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";

const ticketTypes = ["Backlog", "Dúvida", "Incidente", "Manutenção", "Melhoria", "Plantão", "Problema"];
const modules = ["Compras e Suprimentos", "Desenvolvimento ABAP", "Finanças", "Gestão de Armazém", "Gestão de Ativos", "Gestão de Projetos", "Infraestrutura e Manutenção", "Integração", "Manufatura", "Vendas e Distribuição"];
const statuses = ["Aguardando Atendimento", "Aguardando aprovação", "Aguardando teste", "Aguardando validação", "Em análise", "Em config. Desenv.", "Em estimativa", "Encaminhado para atendente", "Encaminhado para encerramento", "Encaminhado para solicitante", "Finalizado", "Paralisado"];
const priorities = ["Baixa", "Média", "Alta", "Emergencial"];

export default function TicketFilters({ filters, setFilters, onSaveFilter, savedFilters, onApplySavedFilter, onManageFilters }) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [tempFilters, setTempFilters] = useState(filters);

  const handleFilterChange = (key, value) => {
    setTempFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setFilters(tempFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      id: '',
      title: '',
      ticket_type: '',
      module: '',
      status: [],
      priority: '',
      partner: '',
      dateFrom: null,
      dateTo: null
    };
    setTempFilters(clearedFilters);
    setFilters(clearedFilters);
  };

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      onSaveFilter(filterName, tempFilters);
      setFilterName('');
      setShowSaveDialog(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-[#2D1B69]" />
          <h2 className="font-semibold text-gray-800">Filtros</h2>
        </div>
        <div className="flex gap-2">
          {savedFilters?.length > 0 && (
            <Select onValueChange={(value) => {
              const savedFilter = JSON.parse(value);
              setTempFilters(savedFilter);
              onApplySavedFilter(savedFilter);
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtros salvos" />
              </SelectTrigger>
              <SelectContent>
                {savedFilters.map((sf, idx) => (
                  <SelectItem key={idx} value={JSON.stringify(sf.filters)}>
                    {sf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {showSaveDialog && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg flex gap-2 items-center">
          <Input
            placeholder="Nome do filtro"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSaveFilter} size="sm" className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
            Salvar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>
            Cancelar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">ID (separar por vírgula)</label>
          <Input
            placeholder="Ex: 1, 2, 3"
            value={tempFilters.id}
            onChange={(e) => handleFilterChange('id', e.target.value)}
            className="h-9"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Título</label>
          <Input
            placeholder="Buscar por título"
            value={tempFilters.title}
            onChange={(e) => handleFilterChange('title', e.target.value)}
            className="h-9"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Tipo de Chamado</label>
          <Select value={tempFilters.ticket_type || ''} onValueChange={(v) => handleFilterChange('ticket_type', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ticketTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Módulo</label>
          <Select value={tempFilters.module} onValueChange={(v) => handleFilterChange('module', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {modules.map(mod => (
                <SelectItem key={mod} value={mod}>{mod}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Status (múltipla seleção)</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                {tempFilters.status?.length > 0 
                  ? `${tempFilters.status.length} selecionado(s)` 
                  : "Selecione"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-80 overflow-auto">
              <div className="space-y-2">
                {statuses.map(st => (
                  <div key={st} className="flex items-center space-x-2">
                    <Checkbox
                      checked={tempFilters.status?.includes(st)}
                      onCheckedChange={(checked) => {
                        const currentStatus = tempFilters.status || [];
                        if (checked) {
                          handleFilterChange('status', [...currentStatus, st]);
                        } else {
                          handleFilterChange('status', currentStatus.filter(s => s !== st));
                        }
                      }}
                    />
                    <label className="text-sm cursor-pointer">{st}</label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Prioridade</label>
          <Select value={tempFilters.priority} onValueChange={(v) => handleFilterChange('priority', v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {priorities.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Parceiro</label>
          <Input
            placeholder="Buscar parceiro"
            value={tempFilters.partner}
            onChange={(e) => handleFilterChange('partner', e.target.value)}
            className="h-9"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Data criação (de)</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !tempFilters.dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {tempFilters.dateFrom ? format(tempFilters.dateFrom, 'dd/MM/yyyy') : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={tempFilters.dateFrom} onSelect={(d) => handleFilterChange('dateFrom', d)} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Data criação (até)</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !tempFilters.dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {tempFilters.dateTo ? format(tempFilters.dateTo, 'dd/MM/yyyy') : 'Selecionar'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={tempFilters.dateTo} onSelect={(d) => handleFilterChange('dateTo', d)} locale={ptBR} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-end gap-2">
          <Button 
            onClick={handleSearch}
            className="h-9 bg-gradient-to-r from-[#2D1B69] to-[#4338ca] hover:from-[#3d2b79] hover:to-[#5348da] text-white"
          >
            <Search size={16} className="mr-2" />
            Buscar
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearFilters}
            className="h-9"
          >
            Limpar filtro
          </Button>
        </div>
      </div>
    </div>
  );
}