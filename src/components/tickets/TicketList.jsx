import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, Columns, ChevronLeft, ChevronRight, Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const allColumns = [
  { key: 'ticket_number', label: 'ID' },
  { key: 'title', label: 'Título' },
  { key: 'ticket_type', label: 'Tipo de Chamado' },
  { key: 'module', label: 'Módulo' },
  { key: 'partner', label: 'Parceiro' },
  { key: 'status', label: 'Status' },
  { key: 'created_date', label: 'Data de criação' },
  { key: 'response_time', label: 'Tempo de resposta' },
  { key: 'solution_time', label: 'Tempo de solução' },
  { key: 'sla_response', label: 'SLA de Resposta' },
  { key: 'sla_solution', label: 'SLA de Solução' },
  { key: 'updated_date', label: 'Data de atualização' },
  { key: 'main_resource', label: 'Recurso principal' },
  { key: 'other_resources', label: 'Demais recursos' },
  { key: 'manager', label: 'Gestor' },
  { key: 'logged_hours', label: 'Horas apontadas' },
  { key: 'estimated_hours', label: 'Horas estimadas' },
];

const getSLAColor = (percentage) => {
  if (percentage <= 70) return 'bg-green-500';
  if (percentage <= 85) return 'bg-yellow-500';
  if (percentage <= 96) return 'bg-orange-500';
  return 'bg-red-500';
};

const calculateSLAPercentage = (deadline, opened) => {
  if (!deadline || !opened) return 0;
  const now = new Date();
  const openedDate = new Date(opened);
  const deadlineDate = new Date(deadline);
  const total = deadlineDate - openedDate;
  const elapsed = now - openedDate;
  const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return Math.round(percentage);
};

const SLABar = ({ percentage }) => (
  <div className="w-full">
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={cn("h-full rounded-full transition-all", getSLAColor(percentage))}
        style={{ width: `${percentage}%` }}
      />
    </div>
  </div>
);

export default function TicketList({ 
  tickets = [], 
  visibleColumns = [], 
  setVisibleColumns, 
  rowsPerPage = 10, 
  setRowsPerPage,
  currentPage = 1,
  setCurrentPage,
  columnOrder = [],
  setColumnOrder 
}) {
  const totalPages = Math.ceil(tickets.length / rowsPerPage);
  const paginatedTickets = tickets.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleColumnToggle = (columnKey) => {
    if (visibleColumns.includes(columnKey)) {
      setVisibleColumns(visibleColumns.filter(c => c !== columnKey));
    } else {
      setVisibleColumns([...visibleColumns, columnKey]);
    }
  };

  const moveColumnUp = (index) => {
    if (index === 0) return;
    const items = Array.from(columnOrder);
    [items[index], items[index - 1]] = [items[index - 1], items[index]];
    setColumnOrder(items);
  };

  const moveColumnDown = (index) => {
    if (index === columnOrder.length - 1) return;
    const items = Array.from(columnOrder);
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    setColumnOrder(items);
  };

  const getOrderedColumns = () => {
    return columnOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(col => col && visibleColumns.includes(col.key));
  };

  const exportToExcel = () => {
    const headers = ['ID', 'Título', 'Categoria', 'Módulo', 'Parceiro', 'Data de criação', 'Data de atualização', 'Recurso principal', 'Demais recursos', 'Gestor', 'Horas apontadas', 'Horas estimadas', 'Status', 'Prioridade'];
    const rows = tickets.map(ticket => [
      ticket.ticket_number,
      ticket.title,
      ticket.category,
      ticket.module,
      ticket.partner,
      ticket.created_date ? format(new Date(ticket.created_date), 'dd/MM/yyyy HH:mm') : '',
      ticket.updated_date ? format(new Date(ticket.updated_date), 'dd/MM/yyyy HH:mm') : '',
      ticket.main_resource,
      ticket.other_resources?.join(', '),
      ticket.manager,
      ticket.logged_hours,
      ticket.estimated_hours,
      ticket.status,
      ticket.priority,
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'chamados.csv';
    link.click();
  };

  const renderCell = (ticket, columnKey) => {
    switch (columnKey) {
      case 'ticket_number':
        return <span className="font-mono text-[#2D1B69] font-semibold">#{ticket.ticket_number}</span>;
      case 'title':
        return <span className="font-medium text-gray-800 max-w-xs truncate block">{ticket.title}</span>;
      case 'created_date':
      case 'updated_date':
        return ticket[columnKey] ? format(new Date(ticket[columnKey]), 'dd/MM/yyyy HH:mm') : '-';
      case 'response_time':
        return ticket.sla_response_hours ? `${ticket.sla_response_hours}h` : '-';
      case 'solution_time':
        return ticket.sla_solution_hours ? `${ticket.sla_solution_hours}h` : '-';
      case 'sla_response':
        return <SLABar percentage={calculateSLAPercentage(ticket.sla_response_deadline, ticket.opened_at)} />;
      case 'sla_solution':
        return <SLABar percentage={calculateSLAPercentage(ticket.sla_solution_deadline, ticket.opened_at)} />;
      case 'other_resources':
        return ticket.other_resources?.join(', ') || '-';
      case 'logged_hours':
      case 'estimated_hours':
        return ticket[columnKey] ? `${ticket[columnKey]}h` : '-';
      default:
        return ticket[columnKey] || '-';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {tickets.length} chamado(s) encontrado(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/5"
          >
            <Download size={16} className="mr-2" />
            Exportar Excel
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-[#2D1B69] text-[#2D1B69] hover:bg-[#2D1B69]/5">
                <Columns size={16} className="mr-2" />
                Colunas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Colunas visíveis</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {columnOrder.map((columnKey, index) => {
                    const column = allColumns.find(c => c.key === columnKey);
                    if (!column) return null;
                    return (
                      <div
                        key={columnKey}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                      >
                        <Checkbox
                          checked={visibleColumns.includes(columnKey)}
                          onCheckedChange={() => handleColumnToggle(columnKey)}
                        />
                        <span className="text-sm flex-1">{column.label}</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveColumnUp(index)}
                            disabled={index === 0}
                          >
                            <ChevronUp size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveColumnDown(index)}
                            disabled={index === columnOrder.length - 1}
                          >
                            <ChevronDown size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1 ml-4 border rounded-lg p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRowsPerPage(Math.max(10, rowsPerPage - 10))}
              disabled={rowsPerPage <= 10}
            >
              <Minus size={14} />
            </Button>
            <span className="text-sm px-2 min-w-[60px] text-center">{rowsPerPage} linhas</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRowsPerPage(rowsPerPage + 10)}
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              {getOrderedColumns().map(col => (
                <TableHead key={col.key} className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTickets.map(ticket => (
              <TableRow 
                key={ticket.id} 
                className="hover:bg-[#2D1B69]/5 cursor-pointer transition-colors"
                onClick={() => window.location.href = createPageUrl(`TicketDetails?id=${ticket.id}`)}
              >
                {getOrderedColumns().map(col => (
                  <TableCell key={col.key} className="text-sm py-3">
                    {renderCell(ticket, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {paginatedTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center py-12 text-gray-500">
                  Nenhum chamado encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Página {currentPage} de {totalPages || 1}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}