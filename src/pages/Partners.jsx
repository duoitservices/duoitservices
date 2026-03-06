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
import { Loader2, Plus, Pencil, Trash2, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function Partners() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  
  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list('-created_date')
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => base44.entities.Ticket.list()
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list()
  });

  const canDeletePartner = (partner) => {
    const hasTickets = tickets.some(t => t.partner_id === partner.id);
    const hasTasks = tasks.some(t => t.partner_id === partner.id);
    const hasUsers = partner.linked_users && partner.linked_users.length > 0;
    
    return !hasTickets && !hasTasks && !hasUsers;
  };

  const deletePartner = useMutation({
    mutationFn: async (partnerId) => {
      return base44.entities.Partner.delete(partnerId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partners']);
      toast.success('Parceiro excluído com sucesso!');
    },
    onError: (error) => toast.error(error.message || 'Erro ao excluir parceiro')
  });

  const filteredPartners = partners.filter(partner => {
    const searchMatch = !searchTerm || 
      partner.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const managerMatch = !managerFilter || partner.manager_id === managerFilter;
    
    return searchMatch && managerMatch;
  });

  // Lista única de gestores
  const uniqueManagers = [...new Set(partners.filter(p => p.manager_id).map(p => ({
    id: p.manager_id,
    name: p.manager
  })))].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

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
          <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Parceiros</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os parceiros cadastrados</p>
        </div>
        <Button 
          className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
          onClick={() => navigate(createPageUrl('PartnerDetails'))}
        >
          <Plus size={16} className="mr-2" />
          Novo Parceiro
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Buscar parceiro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-64">
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por gestor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos os gestores</SelectItem>
                  {uniqueManagers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Parceiros */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.cnpj || '-'}</TableCell>
                    <TableCell>{partner.email || '-'}</TableCell>
                    <TableCell>{partner.phone || '-'}</TableCell>
                    <TableCell>{partner.city || '-'}</TableCell>
                    <TableCell>{partner.manager || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={partner.active ? "default" : "secondary"}>
                        {partner.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => navigate(createPageUrl(`PartnerDetails?id=${partner.id}`))}
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
                                  disabled={!canDeletePartner(partner)}
                                  onClick={() => {
                                    if (confirm('Deseja excluir este parceiro?')) {
                                      deletePartner.mutate(partner.id);
                                    }
                                  }}
                                >
                                  <Trash2 size={14} className="text-red-500" />
                                </Button>
                              </div>
                            </TooltipTrigger>
                            {!canDeletePartner(partner) && (
                              <TooltipContent>
                                <p className="max-w-xs">
                                  Não é possível a exclusão deste parceiro, uma vez que ele possui chamado, tarefa e usuários vinculados. Para a não utilização do parceiro, desative-o em seu cadastro.
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}