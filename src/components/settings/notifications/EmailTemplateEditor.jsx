import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, RotateCcw, Mail, Code } from 'lucide-react';

/**
 * Componente editor de template de e-mail
 * Permite editar assunto e corpo com suporte a variáveis dinâmicas
 */
export default function EmailTemplateEditor({ template, onChange, onReset }) {
  const [showPreview, setShowPreview] = useState(false);

  const availableVariables = [
    '{{nome_usuario}}',
    '{{numero_chamado}}',
    '{{titulo_chamado}}',
    '{{status}}',
    '{{descricao}}',
    '{{prioridade}}',
    '{{criador}}',
    '{{prazo_sla}}',
    '{{tempo_restante}}',
    '{{link_sistema}}',
    '{{autor_comentario}}',
    '{{conteudo_comentario}}',
    '{{tipo_aprovacao}}',
    '{{solicitante}}',
    '{{detalhes}}'
  ];

  const insertVariable = (variable) => {
    const textarea = document.getElementById('email-body');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = template.body;
      const newText = text.substring(0, start) + variable + text.substring(end);
      onChange({ ...template, body: newText });
      
      // Reposicionar cursor após inserção
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const previewTemplate = () => {
    // Substituir variáveis por valores de exemplo
    const examples = {
      '{{nome_usuario}}': 'João Silva',
      '{{numero_chamado}}': '1234',
      '{{titulo_chamado}}': 'Erro no sistema de vendas',
      '{{status}}': 'Em análise',
      '{{descricao}}': 'Sistema apresenta erro ao finalizar venda',
      '{{prioridade}}': 'Alta',
      '{{criador}}': 'Maria Santos',
      '{{prazo_sla}}': '18/02/2026 14:00',
      '{{tempo_restante}}': '2 horas',
      '{{link_sistema}}': 'https://sistema.smartcare.com.br/chamado/1234',
      '{{autor_comentario}}': 'Pedro Costa',
      '{{conteudo_comentario}}': 'Problema identificado, iniciando correção',
      '{{tipo_aprovacao}}': 'Horas extras',
      '{{solicitante}}': 'Ana Paula',
      '{{detalhes}}': '10 horas solicitadas para conclusão do projeto'
    };

    let previewSubject = template.subject;
    let previewBody = template.body;

    Object.entries(examples).forEach(([variable, value]) => {
      previewSubject = previewSubject.replaceAll(variable, value);
      previewBody = previewBody.replaceAll(variable, value);
    });

    return { subject: previewSubject, body: previewBody };
  };

  const preview = previewTemplate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-gray-600" />
          <Label className="text-sm font-medium">Template de E-mail</Label>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
          >
            <Eye size={14} className="mr-2" />
            Visualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
          >
            <RotateCcw size={14} className="mr-2" />
            Restaurar Padrão
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        {/* Assunto */}
        <div>
          <Label className="text-xs">Assunto</Label>
          <Input
            value={template.subject}
            onChange={(e) => onChange({ ...template, subject: e.target.value })}
            placeholder="Digite o assunto do e-mail"
            className="mt-1"
          />
        </div>

        {/* Variáveis disponíveis */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Code size={14} className="text-gray-500" />
            <Label className="text-xs text-gray-600">Variáveis Disponíveis (clique para inserir)</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map(variable => (
              <Badge
                key={variable}
                variant="outline"
                className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                onClick={() => insertVariable(variable)}
              >
                {variable}
              </Badge>
            ))}
          </div>
        </div>

        {/* Corpo */}
        <div>
          <Label className="text-xs">Corpo do E-mail</Label>
          <Textarea
            id="email-body"
            value={template.body}
            onChange={(e) => onChange({ ...template, body: e.target.value })}
            placeholder="Digite o corpo do e-mail"
            rows={12}
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use as variáveis acima para personalizar o e-mail
          </p>
        </div>
      </Card>

      {/* Dialog de Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia do E-mail</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Assunto:</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-lg font-medium">
                {preview.subject}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Corpo:</Label>
              <div className="mt-1 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                {preview.body}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              * Esta é uma prévia com valores de exemplo. Os valores reais serão inseridos quando a notificação for enviada.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}