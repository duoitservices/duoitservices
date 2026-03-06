import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FolderOpen, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  'Planejado': 'bg-blue-100 text-blue-800',
  'Em andamento': 'bg-green-100 text-green-800',
  'Pausado': 'bg-yellow-100 text-yellow-800',
  'Concluído': 'bg-gray-100 text-gray-800',
  'Cancelado': 'bg-red-100 text-red-800',
};

export default function ProjectsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const session = localStorage.getItem('app_user');
      if (!session) return null;
      const userData = JSON.parse(session);
      const users = await base44.entities.SystemUser.filter({ id: userData.id });
      return users[0] || null;
    }
  });

  const { data: allContracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list()
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date')
  });

  // Filtra projetos onde o usuário é gestor do contrato ou gestor do projeto
  const myProjects = projects.filter(p => {
    if (!currentUser) return false;
    const userEmail = currentUser.email?.toLowerCase().trim();

    // Gestor direto do projeto
    if (p.manager_email?.toLowerCase().trim() === userEmail) return true;

    // Gestor do contrato vinculado
    if (p.contract_id) {
      const contract = allContracts.find(c => c.id === p.contract_id);
      if (contract && contract.manager_email?.toLowerCase().trim() === userEmail) return true;
    }

    return false;
  });

  const filtered = myProjects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.partner_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#2D1B69]" size={36} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Lista de Projetos</h1>
          <p className="text-sm text-gray-500 mt-1">Projetos sob sua gestão</p>
        </div>
        <Button
          className="bg-[#2D1B69] hover:bg-[#2D1B69]/90 text-white"
          onClick={() => navigate(createPageUrl('NewProject'))}
        >
          <Plus size={16} className="mr-2" />
          Novo projeto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou parceiro..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                {['Planejado', 'Em andamento', 'Pausado', 'Concluído', 'Cancelado'].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FolderOpen size={48} className="mb-3 opacity-40" />
              <p className="text-lg font-medium">Nenhum projeto encontrado</p>
              <p className="text-sm mt-1">Crie um novo projeto para começar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Início Planejado</TableHead>
                  <TableHead>Término Planejado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recursos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => navigate(createPageUrl('NewProject') + `?id=${p.id}`)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.partner_name || '-'}</TableCell>
                    <TableCell>{p.contract_name || '-'}</TableCell>
                    <TableCell>{p.manager_name || '-'}</TableCell>
                    <TableCell>{p.planned_start_date ? format(new Date(p.planned_start_date), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell>{p.planned_end_date ? format(new Date(p.planned_end_date), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[p.status] || ''}>{p.status || 'Planejado'}</Badge>
                    </TableCell>
                    <TableCell>{(p.resources || []).length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}