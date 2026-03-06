import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Plus, Pencil, Trash2, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export default function ServiceContracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    contractId: '',
    description: '',
    partnerId: '',
    contractType: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['serviceContracts'],
    queryFn: () => base44.entities.ServiceContract.list('-created_date')
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list()
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list()
  });

  const canDeleteContract = (contract) => {
    const hasPartner = contract.partner_id;
    const hasTickets = tickets.some(t => t.contract_id === contract.id);
    const hasTasks = tasks.some(t => t.contract_id === contract.id);
    const hasUsers = contract.linked_users && contract.linked_users.length > 0;
    
    return !hasPartner && !hasTickets && !hasTasks && !hasUsers;
  };

  const deleteContract = useMutation({
    mutationFn: async (contractId) => {
      return base44.entities.ServiceContract.delete(contractId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['serviceContracts']);
      toast.success('Contrato excluído com sucesso!');
    },
    onError: (error) => toast.error(error.message || 'Erro ao excluir contrato')
  });

  const filteredContracts = contracts.filter(contract => {
    const matchId = !filters.contractId || contract.contract_id?.toLowerCase().includes(filters.contractId.toLowerCase());
    const matchDesc = !filters.description || contract.description?.toLowerCase().includes(filters.description.toLowerCase());
    const matchPartner = !filters.partnerId || contract.partner_id === filters.partnerId;
    const matchType = !filters.contractType || contract.contract_type === filters.contractType;
    const matchStatus = !filters.status || contract.status === filters.status;
    const matchStartDate = !filters.startDate || contract.start_date === filters.startDate;
    const matchEndDate = !filters.endDate || contract.end_date === filters.endDate;
    
    return matchId && matchDesc && matchPartner && matchType && matchStatus && matchStartDate && matchEndDate;
  });

  const exportToExcel = () => {
    const dataToExport = filteredContracts.map(c => ({
      'ID Contrato': c.contract_id || '',
      'Descrição': c.description || '',
      'Tipo': c.contract_type || '',
      'Parceiro': c.partner_name || '',
      'Status': c.status || '',
      'Data Inicial': c.start_date || '',
      'Data Final': c.end_date || '',
      'Baseline Horas': c.baseline_hours || 0,
      'Horas Consumidas': c.consumed_hours || 0
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contratos');
    XLSX.writeFile(wb, `contratos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exportação concluída!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Contratos de Serviço</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie os contratos de serviço</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={exportToExcel}
            disabled={filteredContracts.length === 0}
          >
            <Download size={16} className="mr-2" />
            Exportar para Excel
          </Button>
          <Button 
            className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
            onClick={() => navigate(createPageUrl('ServiceContractDetails'))}
          >
            <Plus size={16} className="mr-2" />
            Novo Contrato
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="ID do Contrato"
              value={filters.contractId}
              onChange={(e) => setFilters({...filters, contractId: e.target.value})}
            />
            <Input
              placeholder="Descrição"
              value={filters.description}
              onChange={(e) => setFilters({...filters, description: e.target.value})}
            />
            <Select value={filters.partnerId} onValueChange={(v) => setFilters({...filters, partnerId: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Parceiro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos os parceiros</SelectItem>
                {partners.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Tipo de contrato"
              value={filters.contractType}
              onChange={(e) => setFilters({...filters, contractType: e.target.value})}
            />
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos os status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Em aprovação">Em aprovação</SelectItem>
                <SelectItem value="Encerrado">Encerrado</SelectItem>
                <SelectItem value="Suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Data inicial"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
            <Input
              type="date"
              placeholder="Data final"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
            <Button 
              variant="outline" 
              onClick={() => setFilters({
                contractId: '',
                description: '',
                partnerId: '',
                contractType: '',
                status: '',
                startDate: '',
                endDate: ''
              })}
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Contratos */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Contrato</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Inicial</TableHead>
                  <TableHead>Data Final</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      Nenhum contrato encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contract_id || '-'}</TableCell>
                      <TableCell>{contract.description || '-'}</TableCell>
                      <TableCell>{contract.contract_type || '-'}</TableCell>
                      <TableCell>{contract.partner_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={contract.status === 'Ativo' ? "default" : "secondary"}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="Visualizar"
                            onClick={() => navigate(createPageUrl(`ServiceContractDetails?id=${contract.id}&view=true`))}
                          >
                            <Eye size={14} className="text-blue-500" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Editar"
                            onClick={() => navigate(createPageUrl(`ServiceContractDetails?id=${contract.id}`))}
                          >
                            <Pencil size={14} />
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    disabled={!canDeleteContract(contract)}
                                    onClick={() => {
                                      if (confirm('Deseja excluir este contrato?')) {
                                        deleteContract.mutate(contract.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} className="text-red-500" />
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canDeleteContract(contract) && (
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Não é possível a exclusão deste contrato, uma vez que ele possui vínculos. Para a não utilização do contrato, desative-o em seu cadastro.
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}