import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  User,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

const statuses = ["Aguardando Atendimento", "Aguardando aprovação", "Aguardando teste", "Aguardando validação", "Em análise", "Em config. Desenv.", "Em estimativa", "Encaminhado para atendente", "Encaminhado para encerramento", "Encaminhado para solicitante", "Finalizado", "Paralisado"];
const attachmentTypes = ["Evidência do erro", "Evidência do teste", "Detalhamento", "Especificação"];

export default function TaskDetails() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('id');

  const [messageContent, setMessageContent] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [attachmentType, setAttachmentType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pastedImages, setPastedImages] = useState([]);
  const [viewImage, setViewImage] = useState(null);
  const messagesPerPage = 10;

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => base44.entities.Task.filter({ id: taskId }).then(t => t[0]),
    enabled: !!taskId
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['taskMessages', taskId],
    queryFn: () => base44.entities.TaskMessage.filter({ task_id: taskId }, 'created_date'),
    enabled: !!taskId
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const sessionData = localStorage.getItem('app_user');
      if (!sessionData) return null;
      const session = JSON.parse(sessionData);
      const users = await base44.entities.SystemUser.filter({ id: session.id });
      if (users.length > 0) {
        return users[0];
      }
      return null;
    }
  });

  const { data: userSession } = useQuery({
    queryKey: ['userSession'],
    queryFn: async () => {
      const session = localStorage.getItem('smartcare_session');
      if (session) {
        const sessionData = JSON.parse(session);
        const users = await base44.entities.SystemUser.filter({ email: sessionData.email });
        if (users.length > 0) {
          return users[0];
        }
      }
      return null;
    }
  });

  const { data: taskCreator } = useQuery({
    queryKey: ['taskCreator', task?.created_by],
    queryFn: async () => {
      if (!task?.created_by) return null;
      const users = await base44.entities.SystemUser.filter({ email: task.created_by });
      if (users.length > 0) {
        const user = users[0];
        return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      }
      return task.created_by;
    },
    enabled: !!task?.created_by
  });

  const { data: assignedCollaborator } = useQuery({
    queryKey: ['assignedCollaborator', task?.assigned_to],
    queryFn: async () => {
      if (!task?.assigned_to) return null;
      const collab = await base44.entities.Collaborator.filter({ id: task.assigned_to });
      return collab[0] || null;
    },
    enabled: !!task?.assigned_to
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['collaborators'],
    queryFn: async () => {
      const users = await base44.entities.SystemUser.list('first_name');
      return users.filter(u => u.is_collaborator && u.active !== false);
    }
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.SystemUser.list()
  });

  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState('');

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['task', taskId]);
      queryClient.invalidateQueries(['assignedCollaborator']);
      toast.success('Tarefa atualizada!');
      setIsEditingAssignment(false);
    }
  });

  const handleAssignCollaborator = async (assignedName) => {
    if (!assignedName) return;
    
    const collaborator = collaborators.find(c => `${c.first_name} ${c.last_name}` === assignedName);
    
    // Atualizar tarefa com novo status
    await updateTask.mutateAsync({
      id: taskId,
      data: {
        assigned_to: collaborator?.id || '',
        assigned_to_name: assignedName,
        status: 'Encaminhado para atendente'
      }
    });
    
    // Postar mensagem sobre a atribuição
    const assignmentMessage = task.assigned_to 
      ? `Tarefa reatribuída para: ${assignedName}`
      : `Tarefa atribuída para: ${assignedName}`;
    
    const messageAuthor = userSession || currentUser;
    await createMessage.mutateAsync({
      task_id: taskId,
      content: assignmentMessage,
      author_name: messageAuthor ? `${messageAuthor.first_name} ${messageAuthor.last_name}` : 'Usuário',
      author_email: messageAuthor?.email
    });
    
    setSelectedCollaborator('');
    setIsEditingAssignment(false);
  };

  const createMessage = useMutation({
    mutationFn: (data) => base44.entities.TaskMessage.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['taskMessages', taskId]);
      setMessageContent('');
      toast.success('Mensagem enviada!');
    }
  });

  const handleStatusChange = async (newStatus) => {
    // Verificar se está tentando finalizar sem colaborador atribuído
    if (newStatus === 'Finalizado' && !task.assigned_to) {
      toast.error('Atribua um colaborador antes de finalizar a tarefa');
      return;
    }
    
    await updateTask.mutateAsync({ id: taskId, data: { status: newStatus } });
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;
    
    // Update status if changed
    if (newStatus && newStatus !== task.status) {
      await handleStatusChange(newStatus);
    }
    
    // Post message
    const messageAuthor = userSession || currentUser;
    await createMessage.mutateAsync({
      task_id: taskId,
      content: messageContent,
      author_name: messageAuthor ? `${messageAuthor.first_name} ${messageAuthor.last_name}` : 'Usuário',
      author_email: messageAuthor?.email
    });
    
    setNewStatus('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleFileAttach = async () => {
    if (!selectedFile) return;
    if (!attachmentType) {
      toast.error('Selecione o tipo do anexo');
      return;
    }

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      // Add link to message content
      const fileLink = `\n[📎 ${selectedFile.name}](${file_url})`;
      setMessageContent(prev => prev + fileLink);
      
      setSelectedFile(null);
      setAttachmentType('');
      toast.success('Anexo adicionado!');
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        
        setIsUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
          
          setPastedImages(prev => [...prev, file_url]);
          const imageLink = `\n[IMG:${file_url}]`;
          setMessageContent(prev => prev + imageLink);
          
          toast.success('Imagem anexada!');
        } catch (error) {
          toast.error('Erro ao anexar imagem');
        } finally {
          setIsUploading(false);
        }
        break;
      }
    }
  };

  const handleSendMessageWithImage = async () => {
    await handleSendMessage();
    setPastedImages([]);
  };

  if (taskLoading || !task) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      'Finalizado': 'bg-green-100 text-green-800',
      'Em análise': 'bg-blue-100 text-blue-800',
      'Aguardando Atendimento': 'bg-yellow-100 text-yellow-800',
      'Paralisado': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 w-full min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={createPageUrl(`TicketDetails?id=${task.ticket_id}&tab=tasks`)}>
          <Button variant="ghost" size="icon">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-[#2D1B69]">{task.task_number}</span>
            {task.title}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="outline">{task.module}</Badge>
            <Badge variant="outline">{task.ticket_type}</Badge>
            <Badge className={getStatusColor(task.status)}>
              {task.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap break-words">{task.description || 'Sem descrição'}</p>
            </CardContent>
          </Card>

          {/* Messages */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              {/* Pagination Top */}
              {messages.length > messagesPerPage && (() => {
                const totalPages = Math.ceil(messages.length / messagesPerPage);
                const startMsg = (currentPage - 1) * messagesPerPage + 1;
                const endMsg = Math.min(currentPage * messagesPerPage, messages.length);
                
                return (
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <div>
                      Página {currentPage} de {totalPages} - Mostrando {startMsg} de {messages.length} mensagens
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-3"
                      >
                        &lt; Anterior
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn("h-8 w-8", currentPage === pageNum && "bg-blue-600 hover:bg-blue-700")}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 px-3"
                      >
                        Próxima &gt;
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Messages List */}
              <div className="space-y-4 mb-6">
                {[...messages]
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .slice((currentPage - 1) * messagesPerPage, currentPage * messagesPerPage)
                  .map((msg) => (
                  <div key={msg.id} className="p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                      <User size={14} />
                      <span className="font-medium">Consultor:</span>
                      <span>{task.assigned_to_name || 'Não atribuído'}</span>
                      <span className="text-gray-400">|</span>
                      <User size={14} />
                      <span className="font-medium">Postado por:</span>
                      <span>{msg.author_name}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(msg.created_date), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {msg.content.split('\n').map((line, i) => {
                        const imgMatch = line.match(/\[IMG:(.*?)\]/);
                        if (imgMatch) {
                          return (
                            <img 
                              key={i}
                              src={imgMatch[1]} 
                              alt="Imagem anexada"
                              className="max-w-[200px] rounded-lg cursor-pointer border hover:opacity-80 transition-opacity my-2"
                              onClick={() => setViewImage(imgMatch[1])}
                            />
                          );
                        }
                        const linkMatch = line.match(/\[(.*?)\]\((.*?)\)/);
                        if (linkMatch) {
                          return (
                            <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">
                              {linkMatch[1]}
                            </a>
                          );
                        }
                        return <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>;
                      })}
                    </p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center text-gray-500 py-8">Nenhuma mensagem ainda</p>
                )}
              </div>

              {/* Pagination Bottom */}
              {messages.length > messagesPerPage && (() => {
                const totalPages = Math.ceil(messages.length / messagesPerPage);
                const startMsg = (currentPage - 1) * messagesPerPage + 1;
                const endMsg = Math.min(currentPage * messagesPerPage, messages.length);
                
                return (
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
                    <div>
                      Página {currentPage} de {totalPages} - Mostrando {startMsg} de {messages.length} mensagens
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-8 px-3"
                      >
                        &lt; Anterior
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn("h-8 w-8", currentPage === pageNum && "bg-blue-600 hover:bg-blue-700")}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                        className="h-8 px-3"
                      >
                        Próxima &gt;
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Message Input */}
              <div className="border-t pt-4">
                <div className="relative">
                  <Textarea
                    placeholder="Digite sua mensagem ou cole uma imagem..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    onPaste={handlePaste}
                    className="mb-3 min-h-[200px]"
                  />
                  {pastedImages.length > 0 && (
                    <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 pointer-events-none">
                      {pastedImages.map((url, idx) => (
                        <img 
                          key={idx}
                          src={url} 
                          alt="Imagem colada" 
                          className="max-w-full rounded-lg border shadow-sm"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Attachment */}
                    <div className="flex items-center gap-2">
                      <label>
                        <input type="file" className="hidden" onChange={handleFileUpload} />
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Paperclip size={14} className="mr-1" />
                            {selectedFile ? selectedFile.name : 'Anexar'}
                          </span>
                        </Button>
                      </label>
                      {selectedFile && (
                        <>
                          <Select value={attachmentType} onValueChange={setAttachmentType}>
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue placeholder="Tipo anexo *" />
                            </SelectTrigger>
                            <SelectContent>
                              {attachmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={handleFileAttach} disabled={isUploading}>
                            {isUploading ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Alterar status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>Manter status</SelectItem>
                        {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Button 
                      onClick={handleSendMessageWithImage}
                      className="bg-gradient-to-r from-[#2D1B69] to-[#4338ca]"
                      disabled={createMessage.isPending}
                    >
                      {createMessage.isPending ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                      <span className="ml-2">Enviar</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Image Viewer Dialog */}
          <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Visualizar Imagem</DialogTitle>
              </DialogHeader>
              <div className="relative">
                <img src={viewImage} alt="Imagem em tamanho real" className="w-full h-auto rounded-lg" />
                <div className="flex gap-2 mt-4">
                  <a href={viewImage} download className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Download size={16} className="mr-2" />
                      Download
                    </Button>
                  </a>
                  <a href={viewImage} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Abrir em nova aba
                    </Button>
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recurso */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recurso</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (isEditingAssignment) {
                      if (selectedCollaborator) {
                        handleAssignCollaborator(selectedCollaborator);
                      } else {
                        setIsEditingAssignment(false);
                      }
                    } else {
                      setIsEditingAssignment(true);
                      setSelectedCollaborator(task.assigned_to_name || '');
                    }
                  }}
                >
                  {isEditingAssignment ? 'Salvar' : 'Editar'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingAssignment ? (
                <div>
                  <Label className="text-xs text-gray-500">Atribuir para</Label>
                  <Select 
                    value={selectedCollaborator} 
                    onValueChange={setSelectedCollaborator}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Nenhum</SelectItem>
                      {collaborators.map(c => (
                        <SelectItem key={c.id} value={`${c.first_name} ${c.last_name}`}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500">Consultor</p>
                    <p className="text-sm font-medium">{task.assigned_to_name || '-'}</p>
                  </div>
                  {(() => {
                    if (!task.assigned_to_name) return null;
                    
                    const resourceUser = allUsers.find(u => 
                      `${u.first_name} ${u.last_name}` === task.assigned_to_name
                    );
                    
                    if (!resourceUser?.manager_email) return null;
                    
                    const managerUser = allUsers.find(u => u.email === resourceUser.manager_email);
                    if (!managerUser) return null;
                    
                    return (
                      <div>
                        <p className="text-xs text-gray-500">Gestor do consultor</p>
                        <p className="text-sm font-medium">{`${managerUser.first_name} ${managerUser.last_name}`}</p>
                        <p className="text-xs text-gray-600">{managerUser.email}</p>
                      </div>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Criado por</p>
                <p className="text-sm font-medium">{taskCreator || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Parceiro</p>
                <p className="text-sm font-medium">{task.partner || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Criado em</p>
                <p className="text-sm font-medium">{format(new Date(task.created_date), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}