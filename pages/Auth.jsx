import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

  // Função para criar hash SHA-256 de senha
  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [sentCode, setSentCode] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('E-mail e senha são obrigatórios');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 [Login] Tentando login para:', email);
      
      // Buscar usuário na entidade SystemUser
      const users = await base44.entities.SystemUser.filter({ email });

      if (users.length === 0) {
        console.log('❌ [Login] Usuário não encontrado:', email);
        toast.error('E-mail ou senha incorretos');
        setIsLoading(false);
        return;
      }

      const user = users[0];
      console.log('✅ [Login] Usuário encontrado:', { email: user.email });

      // Hash da senha digitada para comparação
      const passwordHash = await hashPassword(password);
      
      // Verificar senha (suporta tanto hash quanto texto puro temporariamente)
      const isPasswordValid = user.password === passwordHash || user.password === password;
      
      if (!isPasswordValid) {
        console.log('❌ [Login] Senha incorreta');
        toast.error('E-mail ou senha incorretos');
        setIsLoading(false);
        return;
      }

      // Verificar se usuário está ativo
      if (user.active === false) {
        console.log('⚠️ [Login] Usuário inativo:', email);
        toast.error('Usuário inativo. Entre em contato com o administrador.');
        setIsLoading(false);
        return;
      }

      console.log('🎉 [Login] Login bem-sucedido para:', email);

      // Salvar sessão local mínima no localStorage
      localStorage.setItem('app_user', JSON.stringify({
        id: user.id,
        email: user.email,
        loginAt: Date.now()
      }));

      // Manter compatibilidade com código existente
      if (rememberMe) {
        localStorage.setItem('smartcare_email', email);
      } else {
        localStorage.removeItem('smartcare_email');
      }

      toast.success('Login realizado com sucesso!');
      window.location.href = '/MyTickets';
    } catch (error) {
      console.error('💥 [Login Error]', error);
      toast.error('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetStep === 1) {
      setIsLoading(true);
      try {
        const users = await base44.entities.SystemUser.filter({ email: resetEmail });
        const user = users[0];

        if (user) {
          const code = Math.floor(100000 + Math.random() * 900000).toString();
          setSentCode(code);

          await base44.integrations.Core.SendEmail({
            to: resetEmail,
            subject: 'Código de Recuperação de Senha - DuoIT Services',
            body: `Seu código de recuperação de senha é: ${code}\n\nEste código expira em 15 minutos.`
          });

          toast.success('Código enviado para seu e-mail!');
          setResetStep(2);
        } else {
          toast.error('E-mail não encontrado no sistema');
        }
      } catch (error) {
        toast.error('Erro ao enviar código');
      } finally {
        setIsLoading(false);
      }
    } else if (resetStep === 2) {
      if (resetCode === sentCode) {
        setResetStep(3);
      } else {
        toast.error('Código incorreto');
      }
    } else if (resetStep === 3) {
      if (newPassword !== confirmPassword) {
        toast.error('As senhas não coincidem');
        return;
      }

      if (newPassword.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres');
        return;
      }

      setIsLoading(true);
      try {
        const users = await base44.entities.SystemUser.filter({ email: resetEmail });
        const user = users[0];

        if (user) {
          // Hash da nova senha antes de salvar
          const passwordHash = await hashPassword(newPassword);
          
          await base44.entities.SystemUser.update(user.id, {
            password: passwordHash
          });

          toast.success('Senha alterada com sucesso!');
          setShowForgotPassword(false);
          setResetStep(1);
          setResetEmail('');
          setResetCode('');
          setNewPassword('');
          setConfirmPassword('');
        }
      } catch (error) {
        toast.error('Erro ao alterar senha');
      } finally {
        setIsLoading(false);
      }
    }
  };

  React.useEffect(() => {
    const savedEmail = localStorage.getItem('smartcare_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2D1B69] to-[#1a103d] flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2D1B69] to-[#4338ca] rounded-full flex items-center justify-center">
              <Lock className="text-white" size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">DuoIT Services</CardTitle>
          <p className="text-gray-500 text-sm mt-2">Entre com suas credenciais</p>
          <p className="text-gray-400 text-xs mt-3">Desenvolvido por IA, idealizado por humanos</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={setRememberMe}
              />
              <label htmlFor="remember" className="text-sm cursor-pointer">
                Lembrar meus dados
              </label>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-[#2D1B69] to-[#4338ca] hover:from-[#2D1B69]/90 hover:to-[#4338ca]/90"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar'}
            </Button>

            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => setShowForgotPassword(true)}
            >
              Esqueci minha senha
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {resetStep === 1 && (
              <>
                <div>
                  <Label>E-mail de Cadastro</Label>
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <Button
                  onClick={handleForgotPassword}
                  className="w-full bg-[#2D1B69]"
                  disabled={isLoading || !resetEmail}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Código'}
                </Button>
              </>
            )}

            {resetStep === 2 && (
              <>
                <p className="text-sm text-gray-600">
                  Um código de 6 dígitos foi enviado para <strong>{resetEmail}</strong>
                </p>
                <div>
                  <Label>Código de Recuperação</Label>
                  <Input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <Button
                  onClick={handleForgotPassword}
                  className="w-full bg-[#2D1B69]"
                  disabled={resetCode.length !== 6}
                >
                  Verificar Código
                </Button>
              </>
            )}

            {resetStep === 3 && (
              <>
                <div>
                  <Label>Nova Senha</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label>Confirmar Nova Senha</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  onClick={handleForgotPassword}
                  className="w-full bg-[#2D1B69]"
                  disabled={isLoading || !newPassword || !confirmPassword}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Alterar Senha'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}