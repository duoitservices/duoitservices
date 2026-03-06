import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ClosureDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const closureId = urlParams.get('id');

  const { data: closure, isLoading } = useQuery({
    queryKey: ['closure', closureId],
    queryFn: async () => {
      const closures = await base44.entities.Closure.filter({ id: closureId });
      return closures[0];
    },
    enabled: !!closureId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  if (!closure) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-gray-500">Fechamento não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Aguardando revisão': 'bg-yellow-100 text-yellow-800',
      'Aguardando aprovação': 'bg-blue-100 text-blue-800',
      'Aprovado': 'bg-green-100 text-green-800',
      'Rejeitado': 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={colors[status] || ''}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Button variant="outline" onClick={() => navigate(createPageUrl('ClosuresList'))}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Detalhes do Fechamento</CardTitle>
            {getStatusBadge(closure.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Informações gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Mês</p>
              <p className="font-semibold">{closure.month}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Parceiro</p>
              <p className="font-semibold">{closure.partner_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Contrato</p>
              <p className="font-semibold">{closure.contract_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor Hora</p>
              <p className="font-semibold">R$ {closure.hourly_rate?.toFixed(2) || '0.00'}</p>
            </div>
          </div>

          {/* Resumo por consultor */}
          <div>
            <h3 className="font-semibold mb-3">Resumo por Consultor</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closure.summary_by_consultant?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.consultant_name}</TableCell>
                    <TableCell>{item.position}</TableCell>
                    <TableCell className="text-right">{item.total_hours.toFixed(2)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Resumo por cargo */}
          <div>
            <h3 className="font-semibold mb-3">Resumo por Cargo</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closure.summary_by_position?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.position}</TableCell>
                    <TableCell className="text-right">{item.total_hours.toFixed(2)}h</TableCell>
                    <TableCell className="text-right">R$ {item.total_value.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totais */}
          <div className="border-t pt-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total de Horas:</span>
              <span>{closure.total_hours.toFixed(2)}h</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-green-600 mt-2">
              <span>Total em Reais:</span>
              <span>R$ {closure.total_value.toFixed(2)}</span>
            </div>
          </div>

          {/* Lista de chamados */}
          <div>
            <h3 className="font-semibold mb-3">Chamados Incluídos</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chamado</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closure.tickets?.map((ticket, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{ticket.ticket_number}</TableCell>
                    <TableCell className="max-w-xs truncate">{ticket.ticket_title}</TableCell>
                    <TableCell>{ticket.ticket_type}</TableCell>
                    <TableCell>{ticket.module}</TableCell>
                    <TableCell>{ticket.resource}</TableCell>
                    <TableCell>{ticket.resource_position}</TableCell>
                    <TableCell>{ticket.status}</TableCell>
                    <TableCell className="text-right">{ticket.total_hours.toFixed(2)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {closure.rejection_reason && (
            <div className="border border-red-200 bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Motivo da Rejeição</h3>
              <p className="text-red-700">{closure.rejection_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}