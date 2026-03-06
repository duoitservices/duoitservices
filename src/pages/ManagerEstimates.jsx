import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';

export default function ManagerEstimates() {
  const [selectedEstimate, setSelectedEstimate] = useState(null);
  const [reviewedMetrics, setReviewedMetrics] = useState([]);
  const [filters, setFilters] = useState({
    ticketNumber: '',
    partner: '',
    status: ''
  });
  const queryClient = useQueryClient();

  const { data: allEstimates, isLoading } = useQuery({
    queryKey: ['estimateReviews'],
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
    queryKey: ['tickets-for-estimates'],
    queryFn: () => base44.entities.Ticket.list(),
    initialData: []
  });

  const updateEstimateReview = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EstimateReview.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['estimateReviews']);
      queryClient.invalidateQueries(['tickets']);
      setSelectedEstimate(null);
      toast.success('Revisão enviada com sucesso!');
    }
  });

  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ticket.update(id, data)
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
      'Data de Revisão': est.manager_review_date ? format(new Date(est.manager_review_date), 'dd/MM/yyyy HH:mm') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estimativas');
    XLSX.writeFile(wb, `Estimativas_Gestor_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
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
      'em_revisao_gestor': 'bg-orange-600',
      'revisada_pelo_gestor': 'bg-purple-500',
      'aguardando_aprovacao_cliente': 'bg-yellow-500',
      'aprovada': 'bg-green-600',
      'reprovada': 'bg-red-600',
      'congelada': 'bg-gray-600'
    };
    return config[status] || 'bg-gray-500';
  };

  const handleOpenReview = (estimate) => {
    const ticket = tickets.find(t => t.id === estimate.ticket_id);
    
    // Se já existe revisão do gestor, usar ela. Senão, usar métricas do ticket
    let metricsToReview;
    
    if (estimate.manager_reviewed_metrics && estimate.manager_reviewed_metrics.length > 0) {
      // Já foi revisado - carregar dados da revisão
      metricsToReview = estimate.manager_reviewed_metrics;
    } else if (ticket?.estimate_metrics && ticket.estimate_metrics.length > 0) {
      // Primeira revisão - carregar métricas do ticket
      metricsToReview = ticket.estimate_metrics.map(m => ({
        activity: m.activity,
        funcional_hours: m.funcional_hours || 0,
        abap_hours: m.abap_hours || 0,
        funcional_hours_reviewed: m.funcional_hours || 0,
        abap_hours_reviewed: m.abap_hours || 0
      }));
    } else {
      // Fallback - sem dados
      metricsToReview = [];
    }
    
    setSelectedEstimate(estimate);
    setReviewedMetrics(metricsToReview);
  };

  const handleSendReview = async () => {
    const ticket = tickets.find(t => t.id === selectedEstimate.ticket_id);
    
    await updateEstimateReview.mutateAsync({
      id: selectedEstimate.id,
      data: {
        status: 'revisada_pelo_gestor',
        manager_review_date: new Date().toISOString(),
        manager_reviewed_metrics: reviewedMetrics
      }
    });

    await updateTicket.mutateAsync({
      id: selectedEstimate.ticket_id,
      data: {
        estimate_metrics_reviewed: reviewedMetrics
      }
    });
  };

  const handleMetricChange = (index, field, value) => {
    const updated = [...reviewedMetrics];
    updated[index][field] = parseFloat(value) || 0;
    setReviewedMetrics(updated);
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
        <h1 className="text-2xl font-bold text-gray-800">Estimativas para Revisão</h1>
        <p className="text-sm text-gray-600 mt-1">
          Revise e aprove estimativas enviadas pelos consultores
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
                    <SelectItem value="revisada_pelo_gestor">Revisada</SelectItem>
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
                    Nenhuma estimativa pendente de revisão
                  </TableCell>
                </TableRow>
              ) : (
                estimates.map((estimate) => (
                  <TableRow
                    key={estimate.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleOpenReview(estimate)}
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

      {/* Dialog de Revisão */}
      <Dialog open={!!selectedEstimate} onOpenChange={() => setSelectedEstimate(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar Estimativa - #{selectedEstimate?.ticket_number}</DialogTitle>
          </DialogHeader>

          {selectedEstimate && (
            <div className="space-y-6 pt-4">
              {/* Informações do Chamado */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3 text-sm text-gray-600">Informações do Chamado</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Número:</strong> #{selectedEstimate.ticket_number}</div>
                    <div><strong>Título:</strong> {selectedEstimate.ticket_title}</div>
                    <div><strong>Parceiro:</strong> {selectedEstimate.partner}</div>
                    <div>
                      <strong>Recurso Principal:</strong> {
                        (() => {
                          const ticket = tickets.find(t => t.id === selectedEstimate.ticket_id);
                          return ticket?.main_resource || 'Não atribuído';
                        })()
                      }
                    </div>
                    <div>
                      <strong>Demais Recursos:</strong> {
                        (() => {
                          const ticket = tickets.find(t => t.id === selectedEstimate.ticket_id);
                          return ticket?.other_resources?.join(', ') || 'Nenhum';
                        })()
                      }
                    </div>
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h3 className="font-semibold mb-3 text-sm text-gray-600">Datas</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Data do Chamado:</strong> {selectedEstimate.ticket_created_date ? format(new Date(selectedEstimate.ticket_created_date), 'dd/MM/yyyy HH:mm') : 'N/A'}</div>
                    <div><strong>Enviado para Revisão:</strong> {selectedEstimate.sent_date ? format(new Date(selectedEstimate.sent_date), 'dd/MM/yyyy HH:mm') : 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Detalhamento do Chamado */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-2">Detalhamento do Chamado</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {tickets.find(t => t.id === selectedEstimate.ticket_id)?.description}
                </p>
              </div>

              {/* Descrição da Solução */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold mb-2">Descrição da Solução (Estimativa Original)</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedEstimate.original_estimate?.solution_description}
                </p>
              </div>

              {/* Tabela de Métricas - Horas Originais + Campos para Revisão */}
              <div className="border rounded-lg p-4 bg-white">
                <h3 className="font-semibold mb-3 text-lg">Métrica de Horas</h3>
                <p className="text-sm text-gray-600 mb-4">Revise as horas estimadas e insira os valores revisados ao lado</p>
                
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border">
                    <thead>
                      <tr className="bg-purple-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold border" rowSpan="2">
                          Atividade
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold border" colSpan="2">
                          Funcional (Horas)
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold border" colSpan="2">
                          ABAP (Horas)
                        </th>
                      </tr>
                      <tr className="bg-purple-50">
                        <th className="px-3 py-2 text-center text-xs font-medium border w-28">Original</th>
                        <th className="px-3 py-2 text-center text-xs font-medium border w-32">Revisado pelo Gestor</th>
                        <th className="px-3 py-2 text-center text-xs font-medium border w-28">Original</th>
                        <th className="px-3 py-2 text-center text-xs font-medium border w-32">Revisado pelo Gestor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewedMetrics.map((metric, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm border font-medium">{metric.activity}</td>
                          <td className="px-3 py-3 text-center text-sm border text-gray-600">
                            {metric.funcional_hours?.toFixed(1) || '0.0'}h
                          </td>
                          <td className="px-3 py-3 text-center border">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={metric.funcional_hours_reviewed || 0}
                              onChange={(e) => handleMetricChange(index, 'funcional_hours_reviewed', e.target.value)}
                              className="w-24 text-center mx-auto"
                            />
                          </td>
                          <td className="px-3 py-3 text-center text-sm border text-gray-600">
                            {metric.abap_hours?.toFixed(1) || '0.0'}h
                          </td>
                          <td className="px-3 py-3 text-center border">
                            <Input
                              type="number"
                              step="0.5"
                              min="0"
                              value={metric.abap_hours_reviewed || 0}
                              onChange={(e) => handleMetricChange(index, 'abap_hours_reviewed', e.target.value)}
                              className="w-24 text-center mx-auto"
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-purple-100 font-semibold">
                        <td className="px-4 py-3 text-sm border">TOTAL</td>
                        <td className="px-3 py-3 text-center text-sm border">
                          {reviewedMetrics.reduce((sum, m) => sum + (m.funcional_hours || 0), 0).toFixed(1)}h
                        </td>
                        <td className="px-3 py-3 text-center text-sm border text-green-700">
                          {reviewedMetrics.reduce((sum, m) => sum + (m.funcional_hours_reviewed || 0), 0).toFixed(1)}h
                        </td>
                        <td className="px-3 py-3 text-center text-sm border">
                          {reviewedMetrics.reduce((sum, m) => sum + (m.abap_hours || 0), 0).toFixed(1)}h
                        </td>
                        <td className="px-3 py-3 text-center text-sm border text-blue-700">
                          {reviewedMetrics.reduce((sum, m) => sum + (m.abap_hours_reviewed || 0), 0).toFixed(1)}h
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedEstimate(null)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSendReview}
                  className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
                  disabled={updateEstimateReview.isPending}
                >
                  {updateEstimateReview.isPending ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : null}
                  Enviar Revisão
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}