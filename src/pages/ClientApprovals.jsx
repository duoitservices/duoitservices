import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, RefreshCw, Snowflake, Sun, Download, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ClientApprovals() {
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [filters, setFilters] = useState({
    ticketNumber: '',
    partner: '',
    status: ''
  });
  const queryClient = useQueryClient();

  const { data: allEstimates, isLoading } = useQuery({
    queryKey: ['clientEstimates'],
    queryFn: () => base44.entities.EstimateReview.list('-sent_date'),
    initialData: []
  });

  const estimates = allEstimates.filter(est => {
    const matchNumber = !filters.ticketNumber || est.ticket_number?.toString().includes(filters.ticketNumber);
    const matchPartner = !filters.partner || est.partner?.toLowerCase().includes(filters.partner.toLowerCase());
    const matchStatus = !filters.status || est.status === filters.status;
    return matchNumber && matchPartner && matchStatus;
  });

  const { data: tickets } = useQuery({
    queryKey: ['tickets-for-client'],
    queryFn: () => base44.entities.Ticket.list(),
    initialData: []
  });

  const updateEstimateReview = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EstimateReview.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['clientEstimates']);
      queryClient.invalidateQueries(['tickets']);
      setSelectedEstimate(null);
    }
  });

  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ticket.update(id, data)
  });

  const createMessage = useMutation({
    mutationFn: (data) => base44.entities.TicketMessage.create(data)
  });

  const exportToExcel = () => {
    const data = estimates.map(est => ({
      'Número': est.ticket_number,
      'Descrição': est.ticket_title,
      'Parceiro': est.partner,
      'Recurso Principal': est.main_resource || '-',
      'Demais Recursos': est.other_resources?.join(', ') || '-',
      'Status': getStatusLabel(est.status),
      'Data do Chamado': est.ticket_created_date ? format(new Date(est.ticket_created_date), 'dd/MM/yyyy') : '-',
      'Data de Envio': est.sent_date ? format(new Date(est.sent_date), 'dd/MM/yyyy HH:mm') : '-',
      'Data de Decisão': est.client_decision_date ? format(new Date(est.client_decision_date), 'dd/MM/yyyy HH:mm') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimativas');
    XLSX.writeFile(wb, `Estimativas_Aprovacoes_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Exportado com sucesso!');
  };

  const getStatusLabel = (status) => {
    const labels = {
      'rascunho': 'Rascunho',
      'em_revisao_gestor': 'Em Revisão',
      'revisada_pelo_gestor': 'Revisada',
      'aguardando_aprovacao_cliente': 'Aguardando Aprovação',
      'aprovada': 'Aprovada',
      'reprovada': 'Reprovada',
      'congelada': 'Congelada'
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status) => {
    const config = {
      'rascunho': 'bg-gray-500',
      'em_revisao_gestor': 'bg-blue-500',
      'revisada_pelo_gestor': 'bg-purple-500',
      'aguardando_aprovacao_cliente': 'bg-yellow-500',
      'aprovada': 'bg-green-600',
      'reprovada': 'bg-red-600',
      'congelada': 'bg-gray-600'
    };
    return config[status] || 'bg-gray-500';
  };

  const handleDecision = async (decision) => {
    try {
      const ticket = tickets.find(t => t.id === selectedEstimate.ticket_id);

      if (decision === 'aprovar') {
        let currentUser;
        try {
          currentUser = await base44.auth.me();
        } catch (error) {
          console.error('Erro ao obter usuário:', error);
          currentUser = { email: 'sistema', full_name: 'Sistema' };
        }
      
      await updateEstimateReview.mutateAsync({
        id: selectedEstimate.id,
        data: {
          status: 'aprovada',
          client_decision: 'aprovar',
          client_decision_date: new Date().toISOString()
        }
      });

      await updateTicket.mutateAsync({
        id: selectedEstimate.ticket_id,
        data: { 
          status: 'Encaminhado para atendente',
          estimate_solution_description: '',
          estimate_metrics: [],
          estimate_metrics_reviewed: []
        }
      });

      await createMessage.mutateAsync({
        ticket_id: selectedEstimate.ticket_id,
        content: 'Estimativa aprovada',
        author_email: currentUser?.email || 'sistema',
        author_name: currentUser?.full_name || 'Sistema'
      });

      toast.success('Estimativa aprovada com sucesso!');
      queryClient.invalidateQueries(['approvedEstimates', selectedEstimate.ticket_id]);
      queryClient.invalidateQueries(['estimateReview', selectedEstimate.ticket_id]);
      } else if (decision === 'reprovar') {
        let currentUser;
        try {
          currentUser = await base44.auth.me();
        } catch (error) {
          console.error('Erro ao obter usuário:', error);
          currentUser = { email: 'sistema', full_name: 'Sistema' };
        }
      
      await updateEstimateReview.mutateAsync({
        id: selectedEstimate.id,
        data: {
          status: 'reprovada',
          client_decision: 'reprovar',
          client_decision_date: new Date().toISOString()
        }
      });

      await updateTicket.mutateAsync({
        id: selectedEstimate.ticket_id,
        data: { 
          status: 'Aguardando Atendimento',
          estimate_solution_description: '',
          estimate_metrics: [],
          estimate_metrics_reviewed: []
        }
      });

      await createMessage.mutateAsync({
        ticket_id: selectedEstimate.ticket_id,
        content: 'Estimativa reprovada',
        author_email: currentUser?.email || 'sistema',
        author_name: currentUser?.full_name || 'Sistema'
      });

      toast.success('Estimativa reprovada');
      queryClient.invalidateQueries(['estimateReview', selectedEstimate.ticket_id]);
      } else if (decision === 'revisar') {
      await updateEstimateReview.mutateAsync({
        id: selectedEstimate.id,
        data: {
          status: 'em_revisao_gestor',
          client_decision: 'revisar',
          client_decision_date: new Date().toISOString()
        }
      });

      toast.success('Estimativa retornada para revisão do gestor');
      } else if (decision === 'congelar') {
      await updateEstimateReview.mutateAsync({
        id: selectedEstimate.id,
        data: {
          status: 'congelada',
          client_decision: 'congelar',
          client_decision_date: new Date().toISOString()
        }
      });

      await updateTicket.mutateAsync({
        id: selectedEstimate.ticket_id,
        data: { status: 'Paralisado' }
      });

      const currentUser = await base44.auth.me();
      
      await createMessage.mutateAsync({
        ticket_id: selectedEstimate.ticket_id,
        content: 'Estimativa congelada, aguardar nova interação do cliente',
        author_email: currentUser?.email || 'sistema',
        author_name: currentUser?.full_name || 'Sistema'
      });

      toast.success('Estimativa congelada');
      } else if (decision === 'descongelar') {
        let currentUser;
        try {
          currentUser = await base44.auth.me();
        } catch (error) {
          console.error('Erro ao obter usuário:', error);
          currentUser = { email: 'sistema', full_name: 'Sistema' };
        }
      
      await updateEstimateReview.mutateAsync({
        id: selectedEstimate.id,
        data: {
          status: 'aguardando_aprovacao_cliente'
        }
      });

      await updateTicket.mutateAsync({
        id: selectedEstimate.ticket_id,
        data: { status: 'Aguardando aprovação' }
      });

      await createMessage.mutateAsync({
        ticket_id: selectedEstimate.ticket_id,
        content: 'Estimativa descongelada, aguarde nova interação do cliente',
        author_email: currentUser?.email || 'sistema',
        author_name: currentUser?.full_name || 'Sistema'
      });

      toast.success('Estimativa descongelada');
      }
    } catch (error) {
      console.error('Erro ao processar decisão:', error);
      toast.error('Erro ao processar decisão: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Aprovações de Estimativas</h1>
        <p className="text-sm text-gray-600 mt-1">
          Revise e aprove estimativas recebidas
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex items-end gap-3">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Número</label>
                <Input
                  placeholder="Filtrar por número"
                  value={filters.ticketNumber}
                  onChange={(e) => setFilters({...filters, ticketNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Parceiro</label>
                <Input
                  placeholder="Filtrar por parceiro"
                  value={filters.partner}
                  onChange={(e) => setFilters({...filters, partner: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Status</label>
                <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="em_revisao_gestor">Em Revisão</SelectItem>
                    <SelectItem value="aguardando_aprovacao_cliente">Aguardando Aprovação</SelectItem>
                    <SelectItem value="aprovada">Aprovada</SelectItem>
                    <SelectItem value="reprovada">Reprovada</SelectItem>
                    <SelectItem value="congelada">Congelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => setFilters({ ticketNumber: '', partner: '', status: '' })} variant="outline">
              Limpar
            </Button>
            <Button onClick={exportToExcel} variant="outline">
              <Download size={16} className="mr-2" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Recurso Principal</TableHead>
                <TableHead>Demais Recursos</TableHead>
                <TableHead>Data do Chamado</TableHead>
                <TableHead>Data de Envio</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nenhuma estimativa pendente de aprovação
                  </TableCell>
                </TableRow>
              ) : (
                estimates.map((estimate) => (
                  <TableRow
                    key={estimate.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedEstimate(estimate)}
                  >
                    <TableCell className="font-medium">#{estimate.ticket_number}</TableCell>
                    <TableCell>{estimate.ticket_title}</TableCell>
                    <TableCell>{estimate.partner}</TableCell>
                    <TableCell>{estimate.main_resource || '-'}</TableCell>
                    <TableCell>{estimate.other_resources?.join(', ') || '-'}</TableCell>
                    <TableCell>
                      {estimate.ticket_created_date 
                        ? format(new Date(estimate.ticket_created_date), 'dd/MM/yyyy') 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {estimate.sent_date 
                        ? format(new Date(estimate.sent_date), 'dd/MM/yyyy HH:mm') 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusBadge(estimate.status)} text-white`}>
                        {getStatusLabel(estimate.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de Aprovação */}
      <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aprovação de Estimativa - #{selectedEstimate?.ticket_number}</DialogTitle>
          </DialogHeader>

          {selectedEstimate && (
            <div className="space-y-6 pt-4">
              {/* Detalhamento do Chamado */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-2">Detalhamento do Chamado</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {tickets.find(t => t.id === selectedEstimate.ticket_id)?.description}
                </p>
              </div>

              {/* Descrição da Solução */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold mb-2">Descrição da Solução</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedEstimate.original_estimate?.solution_description}
                </p>
              </div>

              {/* Tabela de Métricas Revisadas */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Métricas Revisadas pelo Gestor</h3>
                <table className="w-full border">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Atividade</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Funcional (Horas)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">ABAP (Horas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedEstimate.manager_reviewed_metrics?.map((metric, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-sm">{metric.activity}</td>
                        <td className="px-4 py-3 text-right text-sm text-green-700 font-medium">
                          {metric.funcional_hours_reviewed?.toFixed(1) || '0.0'}h
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-blue-700 font-medium">
                          {metric.abap_hours_reviewed?.toFixed(1) || '0.0'}h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-4">
                {selectedEstimate.status === 'congelada' ? (
                  <Button
                    onClick={() => handleDecision('descongelar')}
                    className="bg-orange-600 hover:bg-orange-700"
                    disabled={updateEstimateReview.isPending}
                  >
                    <Sun size={16} className="mr-2" />
                    Descongelar
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleDecision('congelar')}
                      disabled={updateEstimateReview.isPending}
                    >
                      <Snowflake size={16} className="mr-2" />
                      Congelar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDecision('revisar')}
                      disabled={updateEstimateReview.isPending}
                    >
                      <RefreshCw size={16} className="mr-2" />
                      Revisar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDecision('reprovar')}
                      disabled={updateEstimateReview.isPending}
                    >
                      <X size={16} className="mr-2" />
                      Reprovar
                    </Button>
                    <Button
                      onClick={() => handleDecision('aprovar')}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={updateEstimateReview.isPending}
                    >
                      <Check size={16} className="mr-2" />
                      Aprovar
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}