import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Trash2, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ClosuresList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState({ open: false, closureId: null });

  const { data: closures = [], isLoading } = useQuery({
    queryKey: ['closures'],
    queryFn: () => base44.entities.Closure.list('-created_date')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Closure.delete(id),
    onSuccess: () => {
      toast.success('Fechamento excluído com sucesso!');
      queryClient.invalidateQueries(['closures']);
      setDeleteDialog({ open: false, closureId: null });
    },
    onError: () => {
      toast.error('Erro ao excluir fechamento');
    }
  });

  const sendToPartnerMutation = useMutation({
    mutationFn: async (closure) => {
      // Buscar o parceiro para pegar o gestor
      const partners = await base44.entities.Partner.filter({ id: closure.partner_id });
      const partner = partners[0];

      if (!partner || !partner.manager) {
        throw new Error('Gestor do parceiro não encontrado');
      }

      // Atualizar o fechamento
      await base44.entities.Closure.update(closure.id, {
        status: 'Aguardando aprovação',
        sent_to_partner_at: new Date().toISOString(),
        sent_by: (await base44.auth.me()).email
      });

      // Enviar e-mail para o gestor
      await base44.integrations.Core.SendEmail({
        to: partner.manager,
        subject: `Fechamento de Horas - ${closure.month}`,
        body: `
Prezado(a) gestor(a),

Um novo fechamento de horas está disponível para aprovação:

Mês: ${closure.month}
Contrato: ${closure.contract_name}
Total de Horas: ${closure.total_hours.toFixed(2)}h
Valor Total: R$ ${closure.total_value.toFixed(2)}

Por favor, acesse o sistema para revisar e aprovar o fechamento.

Atenciosamente,
DuoIT Services
        `
      });
    },
    onSuccess: () => {
      toast.success('Fechamento enviado ao parceiro!');
      queryClient.invalidateQueries(['closures']);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao enviar fechamento');
    }
  });

  const handleDelete = (closure) => {
    if (closure.status === 'Aguardando aprovação' || closure.status === 'Aprovado') {
      toast.error('Não é possível excluir fechamentos em aprovação ou aprovados');
      return;
    }
    setDeleteDialog({ open: true, closureId: closure.id });
  };

  const confirmDelete = () => {
    if (deleteDialog.closureId) {
      deleteMutation.mutate(deleteDialog.closureId);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'Aguardando revisão': 'default',
      'Aguardando aprovação': 'secondary',
      'Aprovado': 'default',
      'Rejeitado': 'destructive'
    };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Fechamentos Gerados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Total Horas</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closures.map((closure) => (
                <TableRow key={closure.id}>
                  <TableCell>{closure.month}</TableCell>
                  <TableCell>{closure.partner_name}</TableCell>
                  <TableCell>{closure.contract_name}</TableCell>
                  <TableCell>{closure.total_hours.toFixed(2)}h</TableCell>
                  <TableCell>R$ {closure.total_value.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(closure.status)}</TableCell>
                  <TableCell>
                    {format(new Date(closure.created_date), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(createPageUrl('ClosureDetails') + `?id=${closure.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {closure.status === 'Aguardando revisão' && (
                        <Button
                          size="sm"
                          onClick={() => sendToPartnerMutation.mutate(closure)}
                          disabled={sendToPartnerMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(closure)}
                        disabled={closure.status === 'Aguardando aprovação' || closure.status === 'Aprovado'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {closures.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nenhum fechamento gerado ainda
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja excluir este fechamento? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, closureId: null })}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}