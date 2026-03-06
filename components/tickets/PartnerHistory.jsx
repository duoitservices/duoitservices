import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

const statuses = ["Aguardando Atendimento", "Aguardando aprovação", "Aguardando teste", "Aguardando validação", "Em análise", "Em config. Desenv.", "Em estimativa", "Encaminhado para atendente", "Encaminhado para encerramento", "Encaminhado para solicitante", "Finalizado", "Paralisado"];

export default function PartnerHistory({ ticketType, module, partner, mainResource, currentTicketId }) {
  const [filters, setFilters] = useState({ ticketNumber: '', title: '', type: '', status: '' });

  const { data: relatedTickets = [], isLoading } = useQuery({
    queryKey: ['partnerHistory', ticketType, module, partner, mainResource],
    queryFn: async () => {
      const allTickets = await base44.entities.Ticket.list('-updated_date');
      return allTickets.filter(t =>
        t.id !== currentTicketId &&
        (ticketType ? t.ticket_type === ticketType : true) &&
        (module ? t.module === module : true) &&
        (partner ? t.partner === partner : true) &&
        (mainResource ? t.main_resource === mainResource : true)
      );
    },
    enabled: !!module
  });

  const filteredTickets = relatedTickets.filter(ticket => {
    const matchNumber = !filters.ticketNumber || ticket.ticket_number?.toString().includes(filters.ticketNumber);
    const matchTitle = !filters.title || ticket.title?.toLowerCase().includes(filters.title.toLowerCase());
    const matchType = !filters.type || ticket.ticket_type === filters.type;
    const matchStatus = !filters.status || ticket.status === filters.status;
    return matchNumber && matchTitle && matchType && matchStatus;
  });

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-[#2D1B69]" size={40} /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico do Parceiro</CardTitle>
        <p className="text-sm text-gray-500">Chamados com mesmo tipo, módulo, parceiro e recurso principal</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <Label className="text-xs">ID</Label>
            <Input placeholder="Número" value={filters.ticketNumber} onChange={(e) => setFilters({ ...filters, ticketNumber: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Título</Label>
            <Input placeholder="Buscar título" value={filters.title} onChange={(e) => setFilters({ ...filters, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                <SelectItem value="Requisição">Requisição</SelectItem>
                <SelectItem value="Incidente">Incidente</SelectItem>
                <SelectItem value="Problema">Problema</SelectItem>
                <SelectItem value="Mudança">Mudança</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredTickets.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Título</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Data Abertura</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Data Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <Link to={createPageUrl(`TicketDetails?id=${ticket.id}`)} className="text-[#2D1B69] hover:underline">#{ticket.ticket_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm">{ticket.title}</td>
                    <td className="px-4 py-3 text-sm"><Badge variant="outline">{ticket.ticket_type || '-'}</Badge></td>
                    <td className="px-4 py-3 text-sm"><Badge variant="secondary">{ticket.status}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ticket.opened_at ? format(new Date(ticket.opened_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{format(new Date(ticket.updated_date), 'dd/MM/yyyy HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Nenhum chamado relacionado encontrado</p>
        )}
      </CardContent>
    </Card>
  );
}