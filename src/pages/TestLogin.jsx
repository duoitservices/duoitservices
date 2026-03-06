import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function TestLogin() {
  const [email, setEmail] = useState('amauri.pelisson@gmail.com');
  const [newPassword, setNewPassword] = useState('Admin@123');
  const [testPassword, setTestPassword] = useState('Admin@123');
  const [result, setResult] = useState('');

  const updatePassword = async () => {
    try {
      const users = await base44.entities.User.list();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        setResult('Usuário não encontrado');
        return;
      }

      setResult(`Usuário encontrado: ${user.email}\nID: ${user.id}\nSenha atual em data: ${user.data?.password || 'VAZIA'}`);

      // Atualizar a senha no campo data.password
      const updatedData = { ...user.data, password: newPassword };
      await base44.entities.User.update(user.id, {
        data: updatedData
      });

      setResult(prev => prev + '\n\nSenha atualizada com sucesso! Aguarde...');

      // Verificar se foi atualizada
      setTimeout(async () => {
        const updatedUsers = await base44.entities.User.list();
        const updatedUser = updatedUsers.find(u => u.email === email);
        setResult(prev => prev + `\n\nVerificação:\nSenha em data.password: ${updatedUser.data?.password || 'VAZIA'}\nSenha em password: ${updatedUser.password || 'VAZIA'}`);
      }, 2000);

      toast.success('Senha atualizada!');
    } catch (error) {
      setResult(`Erro: ${error.message}`);
      toast.error('Erro ao atualizar senha');
    }
  };

  const testLogin = async () => {
    try {
      const users = await base44.entities.User.list();
      const user = users.find(u => u.email === email);

      if (!user) {
        setResult('Login FALHOU: Usuário não encontrado');
        return;
      }

      const userPassword = user.data?.password || user.password || '';
      
      setResult(`Teste de Login:\n` +
        `Email: ${email}\n` +
        `Senha digitada: ${testPassword}\n` +
        `Senha em data.password: ${user.data?.password || 'VAZIA'}\n` +
        `Senha em password: ${user.password || 'VAZIA'}\n` +
        `Senha que será comparada: ${userPassword}\n` +
        `Senhas coincidem: ${userPassword === testPassword ? 'SIM ✓' : 'NÃO ✗'}\n\n` +
        `${userPassword === testPassword ? 'LOGIN BEM-SUCEDIDO! ✓✓✓' : 'LOGIN FALHOU! ✗✗✗'}`
      );

      if (userPassword === testPassword) {
        toast.success('Login funcionaria!');
      } else {
        toast.error('Login falharia!');
      }
    } catch (error) {
      setResult(`Erro no teste: ${error.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teste de Atualização de Senha e Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email do Usuário</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div>
            <Label>Nova Senha para Definir</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>

          <Button onClick={updatePassword} className="w-full bg-blue-600">
            1. Atualizar Senha no Banco
          </Button>

          <div className="border-t pt-4">
            <Label>Senha para Testar Login</Label>
            <Input value={testPassword} onChange={(e) => setTestPassword(e.target.value)} />
          </div>

          <Button onClick={testLogin} className="w-full bg-green-600">
            2. Testar Login (Simulação)
          </Button>

          {result && (
            <div className="bg-gray-100 p-4 rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-sm text-gray-600">
              <strong>Instruções:</strong><br />
              1. Clique em "Atualizar Senha no Banco" para definir a senha<br />
              2. Aguarde 2 segundos para ver a verificação<br />
              3. Clique em "Testar Login" para simular o processo de login<br />
              4. Se o teste passar, tente fazer login na página Auth
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}