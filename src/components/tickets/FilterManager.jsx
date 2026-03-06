import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Globe, Lock, Save, X } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function FilterManager({ open, onClose, savedFilters, onRefresh }) {
  const [editingFilter, setEditingFilter] = useState(null);
  const [editName, setEditName] = useState('');
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(authUser => {
      if (authUser?.email) {
        base44.entities.SystemUser.filter({ email: authUser.email }).then(users => {
          if (users.length > 0) setUser(users[0]);
        });
      }
    }).catch(err => {
      console.error('Error fetching user:', err);
    });
  }, []);

  const handleEdit = (filter) => {
    setEditingFilter(filter);
    setEditName(filter.name);
  };

  const handleSaveEdit = async () => {
    if (editingFilter && editName.trim()) {
      await base44.entities.SavedFilter.update(editingFilter.id, {
        name: editName
      });
      setEditingFilter(null);
      setEditName('');
      onRefresh();
    }
  };

  const handleTogglePublic = async (filter) => {
    await base44.entities.SavedFilter.update(filter.id, {
      is_public: !filter.is_public
    });
    onRefresh();
  };

  const handleDelete = async (filterId) => {
    if (confirm('Tem certeza que deseja excluir este filtro?')) {
      await base44.entities.SavedFilter.delete(filterId);
      onRefresh();
    }
  };

  const canEdit = (filter) => user && filter.created_by === user.email;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800">
            Gerenciar Filtros Salvos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {savedFilters.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum filtro salvo encontrado</p>
          ) : (
            savedFilters.map((filter) => (
              <Card key={filter.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {editingFilter?.id === filter.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Save size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFilter(null);
                            setEditName('');
                          }}
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <h3 className="font-semibold text-gray-800">{filter.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            Por: {filter.created_by}
                          </span>
                          <div className="flex items-center gap-1">
                            {filter.is_public ? (
                              <>
                                <Globe size={14} className="text-green-600" />
                                <span className="text-xs text-green-600 font-medium">Público</span>
                              </>
                            ) : (
                              <>
                                <Lock size={14} className="text-gray-500" />
                                <span className="text-xs text-gray-500">Privado</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {canEdit(filter) && editingFilter?.id !== filter.id && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        <Label htmlFor={`public-${filter.id}`} className="text-xs cursor-pointer">
                          {filter.is_public ? 'Público' : 'Privado'}
                        </Label>
                        <Switch
                          id={`public-${filter.id}`}
                          checked={filter.is_public}
                          onCheckedChange={() => handleTogglePublic(filter)}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(filter)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(filter.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}