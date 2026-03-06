import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Save, Loader2, Plus, X, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['Planejado', 'Em andamento', 'Pausado', 'Concluído', 'Cancelado'];

export default function NewProject() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('id');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    partner_id: '',
    partner_name: '',
    contract_id: '',
    contract_name: '',
    manager_email: '',
    manager_name: '',
    planned_start_date: '',
    planned_end_date: '',
    status: 'Planejado',
    resources: []
  });

  const [resourceDialog, setResourceDialog] = useState(false);
  const [selectedResources, setSelectedResources] = useState([]);
  const [resourceSearch, setResourceSearch] = useState('');

  // Load existing project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => base44.entities.Project.filter({ id: projectId }),
    enabled: !!projectId,
    select: d => d[0]
  });

  useEffect(() => {
    if (project) setFormData(project);
  }, [project]);

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list()
  });

  const { data: allContracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.ServiceContract.list()
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['systemUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  // Managers: users with is_manager flag
  const managers = allUsers.filter(u => u.is_manager === true && u.active !== false);

  // Helper: contract is operational (Ativo + end_date not passed)
  const isContractOperational = (c) => {
    if (c.status !== 'Ativo') return false;
    if (!c.end_date) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const endDate = new Date(c.end_date); endDate.setHours(0, 0, 0, 0);
    return endDate >= today;
  };

  // Contracts filtered by selected partner (only operational ones)
  const partnerContracts = formData.partner_id
    ? allContracts.filter(c => c.partner_id === formData.partner_id && isContractOperational(c))
    : [];

  // Available resources (all active users not already added)
  const availableResources = allUsers.filter(u =>
    u.active !== false &&
    !formData.resources.some(r => r.user_email === u.email) &&
    (!resourceSearch ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(resourceSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(resourceSearch.toLowerCase()))
  );

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (projectId) return base44.entities.Project.update(projectId, data);
      return base44.entities.Project.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['projects']);
      toast.success(projectId ? 'Projeto atualizado!' : 'Projeto criado!');
      navigate(createPageUrl('ProjectsList'));
    },
    onError: (err) => toast.error(err.message || 'Erro ao salvar projeto')
  });

  const handleSave = () => {
    if (!formData.name) return toast.error('Nome do projeto é obrigatório');
    // Validate contract is still operational
    if (formData.contract_id) {
      const contract = allContracts.find(c => c.id === formData.contract_id);
      if (contract && !isContractOperational(contract)) {
        return toast.error('O contrato selecionado está suspenso ou expirado. Selecione um contrato ativo.', { duration: 6000 });
      }
    }
    saveMutation.mutate(formData);
  };

  const handleAddResources = () => {
    const newResources = selectedResources.map(userId => {
      const user = allUsers.find(u => u.id === userId);
      return { user_email: user.email, user_name: `${user.first_name} ${user.last_name}` };
    });
    setFormData(prev => ({ ...prev, resources: [...prev.resources, ...newResources] }));
    setResourceDialog(false);
    setSelectedResources([]);
    setResourceSearch('');
  };

  const handleRemoveResource = (email) => {
    setFormData(prev => ({ ...prev, resources: prev.resources.filter(r => r.user_email !== email) }));
  };

  if (projectLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#2D1B69]" size={36} />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('ProjectsList'))}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {projectId ? 'Editar Projeto' : 'Novo Projeto'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {projectId ? 'Edite as informações do projeto' : 'Preencha os dados para criar um novo projeto'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('ProjectsList'))}>
            Cancelar
          </Button>
          <Button
            className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Form 1 - Informações do Projeto */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Projeto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nome e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do projeto *</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do projeto"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição do projeto"
              rows={3}
            />
          </div>

          {/* Parceiro e Contrato */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parceiro</Label>
              <Select
                value={formData.partner_id}
                onValueChange={v => {
                  const p = partners.find(x => x.id === v);
                  setFormData({ ...formData, partner_id: v, partner_name: p?.name || '', contract_id: '', contract_name: '' });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                <SelectContent>
                  {partners.filter(p => p.active !== false).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select
                value={formData.contract_id}
                onValueChange={v => {
                  const c = partnerContracts.find(x => x.id === v);
                  setFormData({ ...formData, contract_id: v, contract_name: c?.name || '' });
                }}
                disabled={!formData.partner_id}
              >
                <SelectTrigger><SelectValue placeholder={formData.partner_id ? "Selecione o contrato" : "Selecione o parceiro primeiro"} /></SelectTrigger>
                <SelectContent>
                  {partnerContracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gestor do Projeto */}
          <div className="space-y-2">
            <Label>Gestor do projeto</Label>
            <Select
              value={formData.manager_email}
              onValueChange={v => {
                const u = managers.find(x => x.email === v);
                setFormData({ ...formData, manager_email: v, manager_name: u ? `${u.first_name} ${u.last_name}` : '' });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o gestor" /></SelectTrigger>
              <SelectContent>
                {managers.map(u => (
                  <SelectItem key={u.id} value={u.email}>{u.first_name} {u.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data planejada para início</Label>
              <Input
                type="date"
                value={formData.planned_start_date}
                onChange={e => setFormData({ ...formData, planned_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data planejada para término</Label>
              <Input
                type="date"
                value={formData.planned_end_date}
                onChange={e => setFormData({ ...formData, planned_end_date: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recursos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recursos do Projeto</span>
            <Button size="sm" onClick={() => setResourceDialog(true)}>
              <Plus size={16} className="mr-2" />
              Adicionar recurso
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {formData.resources.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-gray-400">
              <Users size={36} className="mb-2 opacity-40" />
              <p>Nenhum recurso adicionado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.resources.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell>{r.user_email}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveResource(r.user_email)}>
                        <X size={14} className="text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Recursos */}
      <Dialog open={resourceDialog} onOpenChange={setResourceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Recursos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={resourceSearch}
                onChange={e => setResourceSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {availableResources.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Checkbox
                    checked={selectedResources.includes(u.id)}
                    onCheckedChange={checked => {
                      setSelectedResources(prev =>
                        checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                      );
                    }}
                  />
                  <div>
                    <p className="font-medium">{u.first_name} {u.last_name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                  </div>
                </div>
              ))}
              {availableResources.length === 0 && (
                <p className="text-center text-gray-400 py-6">Nenhum usuário disponível</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setResourceDialog(false); setSelectedResources([]); setResourceSearch(''); }}>
                Cancelar
              </Button>
              <Button onClick={handleAddResources} disabled={selectedResources.length === 0}>
                Adicionar ({selectedResources.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}