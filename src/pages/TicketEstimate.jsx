import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function TicketEstimate() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get('id');
  const [estimateData, setEstimateData] = useState({
    solution_description: '',
    metrics: []
  });
  const [newMetric, setNewMetric] = useState({ activity: '', hours: '', resource: '' });

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => base44.entities.Ticket.filter({ id: ticketId }).then(t => t[0]),
    enabled: !!ticketId
  });

  const { data: estimateReview } = useQuery({
    queryKey: ['estimateReview', ticketId],
    queryFn: () => base44.entities.EstimateReview.filter({ 
      ticket_id: ticketId,
      status: { $in: ['rascunho', 'em_revisao_gestor', 'revisada_pelo_gestor', 'aguardando_aprovacao_cliente', 'congelada'] }
    }).then(r => r[0]),
    enabled: !!ticketId
  });

  // Carregar dados da estimativa
  React.useEffect(() => {
    if (ticket) {
      if (!estimateReview) {
        // Sem estimativa ativa, limpar para nova
        setEstimateData({
          solution_description: '',
          metrics: []
        });
      } else {
        // Carregar dados da estimativa ativa
        setEstimateData({
          solution_description: ticket.estimate_solution_description || '',
          metrics: ticket.estimate_metrics || []
        });
      }
    }
  }, [ticket, estimateReview]);

  const updateTicket = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Ticket.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['ticket', ticketId]);
      queryClient.invalidateQueries(['estimateReview', ticketId]);
    }
  });

  const createEstimateReview = useMutation({
    mutationFn: (data) => base44.entities.EstimateReview.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['estimateReview', ticketId]);
    }
  });

  const updateEstimateReview = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EstimateReview.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['estimateReview', ticketId]);
    }
  });

  const createMessage = useMutation({
    mutationFn: (data) => base44.entities.TicketMessage.create(data)
  });

  const handleAddMetric = () => {
    if (!newMetric.activity || !newMetric.hours || !newMetric.resource) {
      toast.error('Preencha todos os campos da métrica');
      return;
    }

    const hours = parseFloat(newMetric.hours);
    const existingMetricIndex = estimateData.metrics.findIndex(m => m.activity === newMetric.activity);

    if (existingMetricIndex !== -1) {
      // Atividade já existe - somar horas na coluna correspondente
      const updatedMetrics = [...estimateData.metrics];
      if (newMetric.resource === 'Funcional') {
        updatedMetrics[existingMetricIndex].funcional_hours += hours;
      } else {
        updatedMetrics[existingMetricIndex].abap_hours += hours;
      }
      setEstimateData({ ...estimateData, metrics: updatedMetrics });
    } else {
      // Nova atividade
      const newMetricObj = {
        activity: newMetric.activity,
        funcional_hours: newMetric.resource === 'Funcional' ? hours : 0,
        abap_hours: newMetric.resource === 'ABAP' ? hours : 0
      };
      setEstimateData({
        ...estimateData,
        metrics: [...estimateData.metrics, newMetricObj]
      });
    }
    
    setNewMetric({ activity: '', hours: '', resource: '' });
  };

  const handleRemoveMetric = (index) => {
    setEstimateData({
      ...estimateData,
      metrics: estimateData.metrics.filter((_, i) => i !== index)
    });
  };

  const handleSave = async () => {
    await updateTicket.mutateAsync({
      id: ticketId,
      data: {
        estimate_solution_description: estimateData.solution_description,
        estimate_metrics: estimateData.metrics
      }
    });

    // Criar ou atualizar EstimateReview com status "rascunho"
    const reviewData = {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      ticket_title: ticket.title,
      partner: ticket.partner,
      partner_id: ticket.partner_id,
      main_resource: ticket.main_resource,
      other_resources: ticket.other_resources,
      ticket_created_date: ticket.created_date,
      status: 'rascunho',
      original_estimate: {
        solution_description: estimateData.solution_description,
        metrics: estimateData.metrics
      }
    };

    if (estimateReview && estimateReview.status === 'rascunho') {
      // Se já existe um rascunho, atualizar
      await updateEstimateReview.mutateAsync({ id: estimateReview.id, data: reviewData });
    } else if (!estimateReview) {
      // Se não existe nenhuma estimativa, criar nova
      await createEstimateReview.mutateAsync(reviewData);
    } else {
      // Se existe mas não é rascunho, só salvar no ticket (não mexer no EstimateReview)
    }

    toast.success('Estimativa salva como rascunho');
  };

  const handleSendForReview = async () => {
    if (!estimateData.solution_description || estimateData.metrics.length === 0) {
      toast.error('Preencha a solução e adicione métricas antes de enviar');
      return;
    }

    // Salvar dados no ticket primeiro
    await updateTicket.mutateAsync({
      id: ticketId,
      data: {
        estimate_solution_description: estimateData.solution_description,
        estimate_metrics: estimateData.metrics,
        status: 'Em estimativa'
      }
    });

    await createMessage.mutateAsync({
      ticket_id: ticketId,
      content: 'Demanda sendo estimada, aguarde nova interação.',
      is_private: false,
      author_email: 'sistema',
      author_name: 'Sistema'
    });

    const reviewData = {
      ticket_id: ticketId,
      ticket_number: ticket.ticket_number,
      ticket_title: ticket.title,
      partner: ticket.partner,
      partner_id: ticket.partner_id,
      main_resource: ticket.main_resource,
      other_resources: ticket.other_resources,
      ticket_created_date: ticket.created_date,
      status: 'em_revisao_gestor',
      sent_date: new Date().toISOString(),
      original_estimate: {
        solution_description: estimateData.solution_description,
        metrics: estimateData.metrics
      }
    };

    if (estimateReview) {
      await updateEstimateReview.mutateAsync({ id: estimateReview.id, data: reviewData });
    } else {
      await createEstimateReview.mutateAsync(reviewData);
    }

    toast.success('Estimativa enviada para revisão do gestor!');
  };

  const handleSendToPartner = async () => {
    if (!estimateData.solution_description?.trim()) {
      toast.error('Preencha a descrição da solução');
      return;
    }

    await updateTicket.mutateAsync({ 
      id: ticket.id, 
      data: { status: 'Aguardando aprovação' }
    });

    await createMessage.mutateAsync({
      ticket_id: ticketId,
      content: 'Estimativa enviada para aprovação',
      is_private: false,
      author_email: 'sistema',
      author_name: 'Sistema'
    });

    await updateEstimateReview.mutateAsync({ 
      id: estimateReview.id, 
      data: { status: 'aguardando_aprovacao_cliente' }
    });

    toast.success('Estimativa enviada ao parceiro!');
  };

  const totalEstimatedHours = estimateData.metrics.reduce((sum, m) => 
    sum + (m.funcional_hours || 0) + (m.abap_hours || 0), 0
  );
  const totalFuncionalHours = estimateData.metrics.reduce((sum, m) => sum + (m.funcional_hours || 0), 0);
  const totalAbapHours = estimateData.metrics.reduce((sum, m) => sum + (m.abap_hours || 0), 0);

  if (isLoading || !ticket) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  // Determinar se a página está em modo visualização
  const isReadOnly = estimateReview?.status === 'em_revisao_gestor' || 
                     estimateReview?.status === 'congelada' ||
                     estimateReview?.status === 'aguardando_aprovacao_cliente';
  
  const metricsLocked = estimateReview?.status === 'revisada_pelo_gestor';

  const getStatusText = () => {
    if (!estimateReview) return 'Nova estimativa';
    switch (estimateReview.status) {
      case 'rascunho': return 'Rascunho';
      case 'em_revisao_gestor': return 'Em revisão pelo gestor';
      case 'revisada_pelo_gestor': return 'Aguardando envio ao parceiro';
      case 'aguardando_aprovacao_cliente': return 'Aguardando aprovação do parceiro';
      case 'congelada': return 'Estimativa congelada';
      default: return 'Nova estimativa';
    }
  };

  const getStatusColor = () => {
    if (!estimateReview) return 'bg-green-600';
    switch (estimateReview.status) {
      case 'rascunho': return 'bg-yellow-600';
      case 'em_revisao_gestor': return 'bg-blue-600';
      case 'revisada_pelo_gestor': return 'bg-purple-600';
      case 'aguardando_aprovacao_cliente': return 'bg-orange-600';
      case 'congelada': return 'bg-gray-600';
      default: return 'bg-green-600';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl(`TicketDetails?id=${ticketId}&tab=messages`)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft size={20} />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">Estimativa</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Chamado #{ticket.ticket_number} - {ticket.title}
            </p>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              variant="outline"
              disabled={updateTicket.isPending}
            >
              {updateTicket.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
              Salvar Estimativa
            </Button>
            {estimateReview?.status !== 'revisada_pelo_gestor' && (
              <Button
                onClick={handleSendForReview}
                className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
                disabled={createEstimateReview.isPending || updateTicket.isPending}
              >
                {createEstimateReview.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Send size={16} className="mr-2" />}
                Enviar para revisão
              </Button>
            )}
            {estimateReview?.status === 'revisada_pelo_gestor' && (
              <Button
                onClick={handleSendToPartner}
                className="bg-green-600 hover:bg-green-700"
                disabled={updateTicket.isPending}
              >
                {updateTicket.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Send size={16} className="mr-2" />}
                Aceitar e enviar ao Parceiro
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Form 1 - Detalhamento do chamado */}
        <Card className="border-l-4 border-l-gray-400">
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento do chamado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-md p-4 border">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Form 2 - Descrição detalhada da solução */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-lg">Descrição detalhada da solução</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={estimateData.solution_description}
              onChange={(e) => setEstimateData({ ...estimateData, solution_description: e.target.value })}
              placeholder="Descreva a solução proposta em detalhes..."
              rows={12}
              className="text-sm"
              disabled={isReadOnly}
            />
            <p className="text-xs text-gray-500 mt-2">
              Descreva a solução técnica, arquitetura, tecnologias envolvidas, passos de implementação, etc.
            </p>
          </CardContent>
        </Card>

        {/* Form 3 - Métrica */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle className="text-lg">Métrica de Horas</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Adicionar nova métrica */}
            {!metricsLocked && !isReadOnly && (
              <div className="grid grid-cols-12 gap-3 mb-6">
              <div className="col-span-5">
                <Label className="text-sm">Atividade</Label>
                <Select 
                  value={newMetric.activity} 
                  onValueChange={(value) => setNewMetric({ ...newMetric, activity: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a atividade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Análise">Análise</SelectItem>
                    <SelectItem value="Especificação">Especificação</SelectItem>
                    <SelectItem value="Desenvolvimento">Desenvolvimento</SelectItem>
                    <SelectItem value="Testes">Testes</SelectItem>
                    <SelectItem value="Documentação/Manual">Documentação/Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-sm">Horas</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newMetric.hours}
                  onChange={(e) => setNewMetric({ ...newMetric, hours: e.target.value })}
                  placeholder="0.0"
                  className="mt-1"
                />
              </div>
              <div className="col-span-4">
                <Label className="text-sm">Recurso</Label>
                <Select 
                  value={newMetric.resource} 
                  onValueChange={(value) => setNewMetric({ ...newMetric, resource: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o recurso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABAP">ABAP</SelectItem>
                    <SelectItem value="Funcional">Funcional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex items-end">
                <Button
                  onClick={handleAddMetric}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
            )}

            {/* Lista de métricas */}
            {estimateData.metrics.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Atividade</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Funcional (Horas)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">ABAP (Horas)</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-20">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {estimateData.metrics.map((metric, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{metric.activity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          <span className="text-green-700">
                            {metric.funcional_hours ? metric.funcional_hours.toFixed(1) : '0.0'}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          <span className="text-blue-700">
                            {metric.abap_hours ? metric.abap_hours.toFixed(1) : '0.0'}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!metricsLocked && !isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMetric(index)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-purple-100 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-800">Total Estimado</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        <span className="text-green-800">{totalFuncionalHours.toFixed(1)}h</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        <span className="text-blue-800">{totalAbapHours.toFixed(1)}h</span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-600">
                        Total: {totalEstimatedHours.toFixed(1)}h
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-sm text-gray-500">Nenhuma métrica adicionada ainda</p>
                <p className="text-xs text-gray-400 mt-1">Adicione atividades e horas estimadas acima</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Métricas Revisadas pelo Gestor */}
        {ticket.estimate_metrics_reviewed && ticket.estimate_metrics_reviewed.length > 0 && (
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle className="text-lg">Métrica de Horas – Revisadas pelo Gestor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Atividade</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Funcional (Horas Revisadas)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">ABAP (Horas Revisadas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ticket.estimate_metrics_reviewed.map((metric, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{metric.activity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          <span className="text-green-700">
                            {metric.funcional_hours_reviewed?.toFixed(1) || '0.0'}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                          <span className="text-blue-700">
                            {metric.abap_hours_reviewed?.toFixed(1) || '0.0'}h
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-orange-100 font-semibold">
                      <td className="px-4 py-3 text-sm text-gray-800">Total Revisado</td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        <span className="text-green-800">
                          {ticket.estimate_metrics_reviewed.reduce((sum, m) => sum + (m.funcional_hours_reviewed || 0), 0).toFixed(1)}h
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 text-right">
                        <span className="text-blue-800">
                          {ticket.estimate_metrics_reviewed.reduce((sum, m) => sum + (m.abap_hours_reviewed || 0), 0).toFixed(1)}h
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              

            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}