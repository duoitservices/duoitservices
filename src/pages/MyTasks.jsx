import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Filter, Calendar as CalendarIcon, Settings, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { AuthContext } from '../components/auth/AuthContext';
import * as XLSX from 'xlsx';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const allColumns = [
  { id: 'task_number', label: 'ID Tarefa' },
  { id: 'title', label: 'Título' },
  { id: 'ticket_number', label: 'Chamado' },
  { id: 'module', label: 'Módulo' },
  { id: 'ticket_type', label: 'Tipo' },
  { id: 'status', label: 'Status' },
  { id: 'assigned_to_name', label: 'Responsável' },
  { id: 'created_date', label: 'Criado em' }
];

export default function MyTasks() {
  const { currentUser, loading: authLoading } = useContext(AuthContext);
  const [searchTaskIds, setSearchTaskIds] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchTicket, setSearchTicket] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    searchTaskIds: '',
    searchTitle: '',
    searchTicket: '',
    filterModule: 'all',
    filterCategory: 'all',
    filterStatus: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(allColumns.map(c => c.id));
  const [columnOrder, setColumnOrder] = useState(allColumns.map(c => c.id));

  console.log('[MyTasks] Current user from context:', currentUser);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['myTasks', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) {
        console.log('[MyTasks] No currentUser, returning empty array');
        return [];
      }
      
      const assignedToName = `${currentUser.first_name} ${currentUser.last_name}`;
      console.log('[MyTasks] Looking for tasks assigned to:', assignedToName);
      
      const allTasks = await base44.entities.Task.list('-created_date');
      console.log('[MyTasks] Total tasks:', allTasks.length);
      
      // Filtrar tarefas atribuídas ao usuário logado
      const filteredTasks = allTasks.filter(task => 
        task.assigned_to_name === assignedToName
      );
      
      console.log('[MyTasks] Filtered tasks for user:', filteredTasks.length);
      
      return filteredTasks;
    },
    enabled: !!currentUser && !authLoading
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: () => base44.entities.Module.list('name')
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const handleSearch = () => {
    setAppliedFilters({
      searchTaskIds,
      searchTitle,
      searchTicket,
      filterModule,
      filterCategory,
      filterStatus,
      dateFrom,
      dateTo
    });
  };

  const handleClearFilters = () => {
    setSearchTaskIds('');
    setSearchTitle('');
    setSearchTicket('');
    setFilterModule('all');
    setFilterCategory('all');
    setFilterStatus('all');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({
      searchTaskIds: '',
      searchTitle: '',
      searchTicket: '',
      filterModule: 'all',
      filterCategory: 'all',
      filterStatus: 'all',
      dateFrom: '',
      dateTo: ''
    });
  };

  const filteredTasks = tasks.filter(task => {
    // Busca por IDs separados por vírgula
    let matchTaskIds = true;
    if (appliedFilters.searchTaskIds) {
      const ids = appliedFilters.searchTaskIds.split(',').map(id => id.trim().toLowerCase());
      matchTaskIds = ids.some(id => task.task_number?.toLowerCase().includes(id));
    }

    const matchTitle = !appliedFilters.searchTitle || 
      task.title?.toLowerCase().includes(appliedFilters.searchTitle.toLowerCase());
    
    const matchTicket = !appliedFilters.searchTicket || 
      task.ticket_number?.toString().includes(appliedFilters.searchTicket);
    
    const matchModule = appliedFilters.filterModule === 'all' || task.module === appliedFilters.filterModule;
    const matchCategory = appliedFilters.filterCategory === 'all' || task.category === appliedFilters.filterCategory;
    const matchStatus = appliedFilters.filterStatus === 'all' || task.status === appliedFilters.filterStatus;
    
    let matchDate = true;
    if (appliedFilters.dateFrom || appliedFilters.dateTo) {
      const taskDate = new Date(task.created_date);
      if (appliedFilters.dateFrom) matchDate = matchDate && taskDate >= new Date(appliedFilters.dateFrom);
      if (appliedFilters.dateTo) matchDate = matchDate && taskDate <= new Date(appliedFilters.dateTo + 'T23:59:59');
    }
    
    return matchTaskIds && matchTitle && matchTicket && matchModule && matchCategory && matchStatus && matchDate;
  });

  const handleExportToExcel = () => {
    const exportData = filteredTasks.map(task => ({
      'ID Tarefa': task.task_number,
      'Título': task.title,
      'Chamado': task.ticket_number,
      'Módulo': task.module,
      'Tipo': task.ticket_type,
      'Status': task.status,
      'Responsável': task.assigned_to_name || '-',
      'Criado em': new Date(task.created_date).toLocaleDateString('pt-BR')
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tarefas');
    XLSX.writeFile(wb, `minhas_tarefas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleToggleColumn = (columnId) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setColumnOrder(items);
  };

  const getOrderedColumns = () => {
    return columnOrder
      .map(id => allColumns.find(col => col.id === id))
      .filter(col => visibleColumns.includes(col.id));
  };

  const getStatusColor = (status) => {
    const colors = {
      'Finalizado': 'bg-green-100 text-green-800',
      'Em análise': 'bg-blue-100 text-blue-800',
      'Aguardando Atendimento': 'bg-yellow-100 text-yellow-800',
      'Paralisado': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Minhas Tarefas</h1>
          <p className="text-gray-500 text-sm mt-1">Tarefas criadas por você ou atribuídas a você</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowColumnSettings(true)}
            className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/5"
          >
            <Settings size={16} className="mr-2" />
            Ajustar Colunas
          </Button>
          <Button
            onClick={handleExportToExcel}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download size={16} className="mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <Label>ID da Tarefa (separar por vírgula)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="TK0001, TK0002..."
                  value={searchTaskIds}
                  onChange={(e) => setSearchTaskIds(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Título</Label>
              <Input
                placeholder="Buscar por título..."
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
              />
            </div>

            <div>
              <Label>Chamado</Label>
              <Input
                placeholder="Número do chamado..."
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
              />
            </div>

            <div>
              <Label>Módulo</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {modules.map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Aguardando Atendimento">Aguardando Atendimento</SelectItem>
                  <SelectItem value="Em análise">Em análise</SelectItem>
                  <SelectItem value="Em config. Desenv.">Em config. Desenv.</SelectItem>
                  <SelectItem value="Finalizado">Finalizado</SelectItem>
                  <SelectItem value="Paralisado">Paralisado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <Label>Data Final</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-1">
              <Button
                onClick={handleSearch}
                className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
              >
                <Search size={16} className="mr-2" />
                Buscar
              </Button>
              <Button
                variant="outline"
                onClick={handleClearFilters}
              >
                Limpar filtro
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Tarefas */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {getOrderedColumns().map(col => (
                <TableHead key={col.id}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow 
                key={task.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => window.location.href = createPageUrl(`TaskDetails?id=${task.id}`)}
              >
                {getOrderedColumns().map(col => {
                  if (col.id === 'task_number') {
                    return <TableCell key={col.id} className="font-mono text-sm">{task.task_number}</TableCell>;
                  }
                  if (col.id === 'title') {
                    return <TableCell key={col.id} className="font-medium max-w-xs truncate">{task.title}</TableCell>;
                  }
                  if (col.id === 'ticket_number') {
                    return (
                      <TableCell key={col.id} onClick={(e) => e.stopPropagation()}>
                        <Link 
                          to={createPageUrl(`TicketDetails?id=${task.ticket_id}`)}
                          className="text-blue-600 hover:underline"
                        >
                          #{task.ticket_number}
                        </Link>
                      </TableCell>
                    );
                  }
                  if (col.id === 'status') {
                    return (
                      <TableCell key={col.id}>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                    );
                  }
                  if (col.id === 'created_date') {
                    return <TableCell key={col.id}>{new Date(task.created_date).toLocaleDateString('pt-BR')}</TableCell>;
                  }
                  return <TableCell key={col.id}>{task[col.id] || '-'}</TableCell>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredTasks.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500">Nenhuma tarefa encontrada</p>
          </div>
        )}
      </Card>

      {/* Dialog de Ajuste de Colunas */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Colunas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Selecione as colunas a exibir e arraste para reordenar:</p>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {columnOrder.map((columnId, index) => {
                      const column = allColumns.find(c => c.id === columnId);
                      return (
                        <Draggable key={columnId} draggableId={columnId} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100"
                            >
                              <Checkbox
                                checked={visibleColumns.includes(columnId)}
                                onCheckedChange={() => handleToggleColumn(columnId)}
                              />
                              <span className="text-sm">{column.label}</span>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <Button 
              onClick={() => setShowColumnSettings(false)}
              className="w-full bg-[#2D1B69] hover:bg-[#2D1B69]/90"
            >
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}