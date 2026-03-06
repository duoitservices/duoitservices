import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, X, Clock, Filter, Loader2, Search, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { AuthContext } from '../components/auth/AuthContext';

export default function HourApproval() {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPartner, setFilterPartner] = useState('all');
  const [filterContract, setFilterContract] = useState('all');
  const [filterCollaborator, setFilterCollaborator] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  // Buscar SystemUser logado para obter o email do gestor
  const { data: loggedSystemUser } = useQuery({
    queryKey: ['loggedSystemUser', currentUser?.email],
    queryFn: async () => {
      const users = await base44.entities.SystemUser.filter({ email: currentUser.email });
      return users[0] || null;
    },
    enabled: !!currentUser?.email
  });

  // Buscar todos os SystemUsers para mapear gestor de cada um
  const { data: allSystemUsers = [] } = useQuery({
    queryKey: ['allSystemUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  // TimeEntries onde o gestor do apontador = usuário logado
  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: ['timeEntriesForApproval', loggedSystemUser?.email],
    queryFn: async () => {
      if (!loggedSystemUser) return [];
      // Usuários cujo manager_email é o usuário logado
      const managedUsers = allSystemUsers.filter(
        u => u.manager_email === loggedSystemUser.email && u.active !== false
      );
      if (managedUsers.length === 0) return [];
      const managedEmails = managedUsers.map(u => u.email);
      const allEntries = await base44.entities.TimeEntry.list('-date');
      // Apenas positivos (excluir estornos)
      return allEntries.filter(e => managedEmails.includes(e.user_email) && (e.total_hours || 0) > 0);
    },
    enabled: !!loggedSystemUser && allSystemUsers.length > 0
  });

  // Helper: pegar nome do gestor de um user_email
  const getManagerName = (userEmail) => {
    const su = allSystemUsers.find(u => u.email === userEmail);
    return su?.manager_name || su?.manager_email || '-';
  };

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.TimeEntry.update(id, { approved: true, rejected: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeEntriesForApproval']);
      toast.success('Apontamento aprovado!');
    },
    onError: () => toast.error('Erro ao aprovar apontamento')
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.TimeEntry.update(id, { approved: false, rejected: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['timeEntriesForApproval']);
      toast.success('Apontamento reprovado!');
    },
    onError: () => toast.error('Erro ao reprovar apontamento')
  });

  const bulkApprove = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await base44.entities.TimeEntry.update(id, { approved: true, rejected: false });
    }
    queryClient.invalidateQueries(['timeEntriesForApproval']);
    toast.success(`${selectedIds.length} apontamento(s) aprovado(s)!`);
    setSelectedIds([]);
  };

  const bulkReject = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await base44.entities.TimeEntry.update(id, { approved: false, rejected: true });
    }
    queryClient.invalidateQueries(['timeEntriesForApproval']);
    toast.success(`${selectedIds.length} apontamento(s) reprovado(s)!`);
    setSelectedIds([]);
  };

  // Unique values for dropdown filters
  const uniquePartners = [...new Set(timeEntries.map(e => e.partner).filter(Boolean))].sort();
  const uniqueContracts = [...new Set(timeEntries.map(e => e.ticket_title ? null : null).filter(Boolean))]; // placeholder
  const uniqueCollaborators = [...new Set(timeEntries.map(e => e.user_name).filter(Boolean))].sort();

  // Get contract name from ticket - we'll use a map from timeEntries
  const contractNames = [...new Set(
    timeEntries.map(e => {
      // Try to get contract info - stored on ticket, not directly on entry
      return e.contract_name || null;
    }).filter(Boolean)
  )].sort();

  const filteredEntries = timeEntries.filter(entry => {
    if (filterStatus === 'pending' && (entry.approved || entry.rejected)) return false;
    if (filterStatus === 'approved' && !entry.approved) return false;
    if (filterStatus === 'rejected' && !entry.rejected) return false;
    if (filterPartner !== 'all' && entry.partner !== filterPartner) return false;
    if (filterContract !== 'all' && entry.contract_name !== filterContract) return false;
    if (filterCollaborator !== 'all' && entry.user_name !== filterCollaborator) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        entry.ticket_number?.toString().includes(term) ||
        entry.user_name?.toLowerCase().includes(term) ||
        entry.description?.toLowerCase().includes(term) ||
        entry.partner?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const exportToExcel = () => {
    const headers = ['Data', 'Chamado', 'Contrato', 'Colaborador', 'Parceiro', 'Descrição', 'Hora Inicial', 'Hora Final', 'Total Horas', 'Status'];
    const rows = filteredEntries.map(entry => [
      format(parseISO(entry.date), 'dd/MM/yyyy'),
      entry.ticket_number,
      entry.contract_name || '-',
      entry.user_name || '-',
      entry.partner || '-',
      entry.description || '-',
      entry.start_time,
      entry.end_time,
      entry.total_hours?.toFixed(2),
      entry.approved ? 'Aprovado' : entry.rejected ? 'Reprovado' : 'Pendente'
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell || ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gestao_horas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const allSelected = filteredEntries.length > 0 && filteredEntries.every(e => selectedIds.includes(e.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => e.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const getStatusBadge = (entry) => {
    if (entry.approved) return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>;
    if (entry.rejected) return <Badge className="bg-red-100 text-red-800">Reprovado</Badge>;
    return <Badge className="bg-orange-100 text-orange-800">Pendente</Badge>;
  };

  const totalPending = timeEntries.filter(e => !e.approved && !e.rejected).length;
  const totalPendingHours = timeEntries.filter(e => !e.approved && !e.rejected).reduce((s, e) => s + (e.total_hours || 0), 0);

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
        <h1 className="text-2xl font-bold text-gray-800">Gestão de Horas</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie os apontamentos da sua equipe</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Horas Pendentes</p>
                <p className="text-2xl font-bold text-orange-600">{totalPendingHours.toFixed(1)}h</p>
              </div>
              <Clock size={32} className="text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Apontamentos Pendentes</p>
                <p className="text-2xl font-bold text-[#2D1B69]">{totalPending}</p>
              </div>
              <Filter size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total de Apontamentos</p>
                <p className="text-2xl font-bold text-[#2D1B69]">{timeEntries.length}</p>
              </div>
              <Clock size={32} className="text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col md:flex-row gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Buscar por chamado, colaborador, parceiro ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="rejected">Reprovados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os parceiros</SelectItem>
                {uniquePartners.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterContract} onValueChange={setFilterContract}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Contrato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os contratos</SelectItem>
                {contractNames.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCollaborator} onValueChange={setFilterCollaborator}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {uniqueCollaborators.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToExcel}>
              <Download size={16} className="mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">{selectedIds.length} selecionado(s)</span>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={bulkApprove}>
            <Check size={14} className="mr-1" /> Aprovar selecionados
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={bulkReject}>
            <X size={14} className="mr-1" /> Reprovar selecionados
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Apontamentos de Horas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEntries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className={selectedIds.includes(entry.id) ? 'bg-blue-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(entry.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="font-mono text-[#2D1B69]">#{entry.ticket_number}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[120px] truncate">{entry.contract_name || '-'}</TableCell>
                    <TableCell className="font-medium">{entry.user_name || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{getManagerName(entry.user_email)}</TableCell>
                    <TableCell className="text-sm">{entry.partner || '-'}</TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm text-gray-600">{entry.description || '-'}</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{entry.start_time} - {entry.end_time}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-semibold">{entry.total_hours?.toFixed(2)}h</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(entry)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!entry.approved && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-3"
                            onClick={() => approveMutation.mutate(entry.id)}
                            disabled={approveMutation.isPending}
                          >
                            <Check size={13} className="mr-1" /> Aprovar
                          </Button>
                        )}
                        {!entry.rejected && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 text-xs px-3"
                            onClick={() => rejectMutation.mutate(entry.id)}
                            disabled={rejectMutation.isPending}
                          >
                            <X size={13} className="mr-1" /> Reprovar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Nenhum apontamento encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}