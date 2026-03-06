import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function PartnerDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const partnerId = searchParams.get('id');
  
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    email: '',
    zip_code: '',
    country: 'Brasil',
    address: '',
    neighborhood: '',
    city: '',
    state: '',
    complement: '',
    manager: '',
    manager_id: '',
    linked_users: [],
    active: true
  });



  const { data: partner, isLoading: isLoadingPartner } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      if (!partnerId) return null;
      const partners = await base44.entities.Partner.filter({ id: partnerId });
      return partners[0] || null;
    },
    enabled: !!partnerId
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.SystemUser.list('-created_date')
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      return base44.entities.ServiceContract.filter({ partner_id: partnerId }, '-created_date');
    },
    enabled: !!partnerId
  });

  // Filtrar gestores entre os usuários
  const managerUsers = users.filter(u => u.is_manager && u.active !== false);

  useEffect(() => {
    if (partner) {
      setFormData({
        name: partner.name || '',
        cnpj: partner.cnpj || '',
        phone: partner.phone || '',
        email: partner.email || '',
        zip_code: partner.zip_code || '',
        country: partner.country || 'Brasil',
        address: partner.address || '',
        neighborhood: partner.neighborhood || '',
        city: partner.city || '',
        state: partner.state || '',
        complement: partner.complement || '',
        manager: partner.manager || '',
        manager_id: partner.manager_id || '',
        active: partner.active !== undefined ? partner.active : true
      });
    }
  }, [partner]);

  const savePartner = useMutation({
    mutationFn: async (data) => {
      if (partnerId) {
        return base44.entities.Partner.update(partnerId, data);
      } else {
        return base44.entities.Partner.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['partners']);
      queryClient.invalidateQueries(['partner', partnerId]);
      toast.success(partnerId ? 'Parceiro atualizado com sucesso!' : 'Parceiro criado com sucesso!');
      navigate(createPageUrl('Partners'));
    },
    onError: (error) => toast.error('Erro ao salvar parceiro: ' + error.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Nome do parceiro é obrigatório');
      return;
    }
    savePartner.mutate(formData);
  };



  if (isLoadingPartner && partnerId) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(createPageUrl('Partners'))}>
          <ArrowLeft size={16} className="mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {partnerId ? 'Editar Parceiro' : 'Novo Parceiro'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {partnerId ? 'Atualize os dados do parceiro' : 'Cadastre um novo parceiro'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados do Parceiro */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Parceiro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CEP</Label>
                <Input
                  value={formData.zip_code}
                  onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                />
              </div>
              <div>
                <Label>País</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bairro</Label>
                <Input
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                />
              </div>
              <div>
                <Label>Complemento</Label>
                <Input
                  value={formData.complement}
                  onChange={(e) => setFormData({...formData, complement: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Gestor do Parceiro</Label>
              <Select 
                value={formData.manager_id} 
                onValueChange={(v) => {
                  const manager = users.find(u => u.email === v);
                  setFormData({
                    ...formData,
                    manager_id: v,
                    manager: manager ? `${manager.first_name} ${manager.last_name}` : ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um gestor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Nenhum</SelectItem>
                  {managerUsers.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.first_name} {u.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({...formData, active: checked})}
              />
              <label htmlFor="active" className="text-sm cursor-pointer">
                Parceiro ativo
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Contratos Vinculados */}
        {partnerId && (
          <Card>
            <CardHeader>
              <CardTitle>Contratos Vinculados</CardTitle>
              <p className="text-sm text-gray-500">Contratos associados a este parceiro</p>
            </CardHeader>
            <CardContent>
              {contracts.length > 0 ? (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID do Contrato</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data Inicial</TableHead>
                        <TableHead>Data Final</TableHead>
                        <TableHead>Gestor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map((contract) => (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">{contract.contract_id}</TableCell>
                          <TableCell>{contract.description || '-'}</TableCell>
                          <TableCell>{contract.contract_type || '-'}</TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                contract.status === 'Ativo' ? 'bg-green-100 text-green-800' :
                                contract.status === 'Inativo' ? 'bg-gray-100 text-gray-800' :
                                contract.status === 'Suspenso' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }
                            >
                              {contract.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {contract.start_date ? new Date(contract.start_date).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell>
                            {contract.end_date ? new Date(contract.end_date).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell>{contract.manager_name || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(createPageUrl('ServiceContractDetails') + `?id=${contract.id}`)}
                            >
                              <Eye size={14} className="mr-1" />
                              Visualizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Este parceiro ainda não possui contratos vinculados.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(createPageUrl('Partners'))}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-[#2D1B69] hover:bg-[#2D1B69]/90" disabled={savePartner.isPending}>
            {savePartner.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
            <Save size={16} className="mr-2" />
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}