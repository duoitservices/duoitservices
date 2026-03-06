import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { UserCircle, Edit2, Key, Loader2 } from 'lucide-react';
import { useAuth } from './auth/useAuth';

export default function UserProfile({ open, onClose }) {
  const { currentUser, loading, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: ''
  });

  // Debug logs
  useEffect(() => {
    console.log('📋 [UserProfile] Component mounted/updated');
    console.log('📋 [UserProfile] open:', open);
    console.log('📋 [UserProfile] currentUser:', currentUser);
    console.log('📋 [UserProfile] loading:', loading);
  }, [open, currentUser, loading]);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        first_name: currentUser.first_name || '',
        last_name: currentUser.last_name || '',
        phone: currentUser.phone || ''
      });
    }
  }, [currentUser]);

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('Nome e sobrenome são obrigatórios');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUser(currentUser.id, formData);
      
      if (result.success) {
        toast.success('Perfil atualizado com sucesso!');
        setIsEditing(false);
      } else {
        toast.error('Erro ao atualizar perfil');
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentUser) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Cabeçalho */}
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2D1B69] to-blue-500 flex items-center justify-center">
              <UserCircle size={40} className="text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold mb-1">
                {currentUser.first_name} {currentUser.last_name}
              </DialogTitle>
              <Badge className="bg-[#2D1B69] hover:bg-[#2D1B69]/90">
                {currentUser.position_name || 'Sem cargo'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Formulário */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">E-mail</Label>
              <Input
                id="email"
                value={currentUser.email}
                disabled
                className="mt-1.5 bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">E-mail não pode ser alterado</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name" className="text-gray-700 dark:text-gray-300">Nome *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="last_name" className="text-gray-700 dark:text-gray-300">Sobrenome *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="mt-1.5"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <Label className="text-gray-700 dark:text-gray-300">Cargo</Label>
              <Input
                value={currentUser.position_name || 'Não definido'}
                disabled
                className="mt-1.5 bg-gray-100 dark:bg-gray-800"
              />
            </div>

            {currentUser.manager_name && (
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Gestor</Label>
                <Input
                  value={currentUser.manager_name}
                  disabled
                  className="mt-1.5 bg-gray-100 dark:bg-gray-800"
                />
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowPasswordModal(true)}
            className="gap-2"
          >
            <Key size={16} />
            Alterar Senha
          </Button>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      first_name: currentUser.first_name || '',
                      last_name: currentUser.last_name || '',
                      phone: currentUser.phone || '',
                    });
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-gradient-to-r from-[#2D1B69] to-blue-600 hover:from-[#2D1B69]/90 hover:to-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-gradient-to-r from-[#2D1B69] to-blue-600 hover:from-[#2D1B69]/90 hover:to-blue-700"
                >
                  <Edit2 size={16} className="mr-2" />
                  Editar Perfil
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Modal de Alteração de Senha (placeholder para futura implementação) */}
      {showPasswordModal && (
        <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Alterar Senha</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Funcionalidade em desenvolvimento. Em breve você poderá alterar sua senha.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowPasswordModal(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}