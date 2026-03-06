import React, { useState, useContext } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthContext } from '../components/auth/AuthContext';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function DiagnosticUserContract() {
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const { currentUser, loading } = useContext(AuthContext);

  const runDiagnostic = async () => {
    setIsRunning(true);
    const diagnosticResults = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Verificar sessão localStorage
      diagnosticResults.tests.push({
        name: '1. Verificar sessão localStorage',
        status: 'running'
      });

      const sessionData = localStorage.getItem('app_user');
      const session = sessionData ? JSON.parse(sessionData) : null;
      
      diagnosticResults.tests[0] = {
        name: '1. Verificar sessão localStorage',
        status: session ? 'success' : 'error',
        data: {
          exists: !!session,
          sessionId: session?.id,
          sessionEmail: session?.email
        }
      };

      // Test 2: Verificar AuthContext currentUser
      diagnosticResults.tests.push({
        name: '2. Verificar AuthContext currentUser',
        status: 'running'
      });
      
      const systemUser = currentUser;
      
      diagnosticResults.tests[1] = {
        name: '2. Verificar AuthContext currentUser',
        status: systemUser ? 'success' : 'error',
        data: {
          found: !!systemUser,
          id: systemUser?.id,
          email: systemUser?.email,
          first_name: systemUser?.first_name,
          last_name: systemUser?.last_name,
          full_name_display: systemUser ? `${systemUser.first_name} ${systemUser.last_name}` : 'N/A',
          is_collaborator: systemUser?.is_collaborator,
          active: systemUser?.active,
          position_name: systemUser?.position_name
        }
      };

      // Test 3: Buscar todos os contratos
      diagnosticResults.tests.push({
        name: '3. Buscar todos os contratos',
        status: 'running'
      });

      const allContracts = await base44.entities.ServiceContract.list();
      
      diagnosticResults.tests[2] = {
        name: '3. Buscar todos os contratos',
        status: 'success',
        data: {
          total: allContracts.length,
          active: allContracts.filter(c => c.status === 'Ativo').length,
          withLinkedUsers: allContracts.filter(c => c.linked_users?.length > 0).length
        }
      };

      // Test 4: Verificar contratos do usuário
      diagnosticResults.tests.push({
        name: '4. Verificar contratos vinculados ao usuário',
        status: 'running'
      });

      if (systemUser?.email) {
        const userEmail = systemUser.email.toLowerCase().trim();
        const userContracts = allContracts.filter(c => {
          if (c.status !== 'Ativo') return false;
          if (!c.linked_users || c.linked_users.length === 0) return false;
          
          return c.linked_users.some(lu => 
            lu.user_email?.toLowerCase().trim() === userEmail && 
            lu.status === 'Ativa'
          );
        });

        // Mostrar detalhes de cada contrato
        const contractDetails = userContracts.map(c => ({
          contract_id: c.contract_id,
          name: c.name,
          partner_id: c.partner_id,
          partner_name: c.partner_name,
          status: c.status,
          linked_users_count: c.linked_users?.length || 0,
          user_link: c.linked_users?.find(lu => 
            lu.user_email?.toLowerCase().trim() === userEmail
          )
        }));

        diagnosticResults.tests[3] = {
          name: '4. Verificar contratos vinculados ao usuário',
          status: userContracts.length > 0 ? 'success' : 'warning',
          data: {
            userEmail,
            contractsFound: userContracts.length,
            contracts: contractDetails
          }
        };
      } else {
        diagnosticResults.tests[3] = {
          name: '4. Verificar contratos vinculados ao usuário',
          status: 'error',
          data: { error: 'SystemUser não encontrado' }
        };
      }

      // Test 5: Verificar exemplo de linked_users
      diagnosticResults.tests.push({
        name: '5. Exemplo de estrutura linked_users',
        status: 'running'
      });

      const contractWithUsers = allContracts.find(c => c.linked_users?.length > 0);
      
      diagnosticResults.tests[4] = {
        name: '5. Exemplo de estrutura linked_users',
        status: contractWithUsers ? 'success' : 'warning',
        data: {
          contract_id: contractWithUsers?.contract_id,
          linked_users: contractWithUsers?.linked_users || []
        }
      };

    } catch (error) {
      diagnosticResults.tests.push({
        name: 'Erro no diagnóstico',
        status: 'error',
        data: { error: error.message }
      });
    }

    setResults(diagnosticResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      case 'error': return <XCircle className="text-red-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'running': return <Loader2 className="animate-spin text-blue-500" size={20} />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Diagnóstico - Vínculo Usuário x Contrato</h1>
        <p className="text-gray-500 text-sm mt-1">
          Validação estrutural do modelo de dados
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informações do Usuário Logado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>ID:</strong> {currentUser?.id || 'N/A'}</div>
            <div><strong>Email:</strong> {currentUser?.email || 'N/A'}</div>
            <div><strong>Nome Completo:</strong> {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'N/A'}</div>
            <div><strong>Is Collaborator:</strong> {currentUser?.is_collaborator ? 'Sim' : 'Não'}</div>
            <div><strong>Active:</strong> {currentUser?.active !== false ? 'Sim' : 'Não'}</div>
          </div>
          <Button 
            onClick={runDiagnostic} 
            className="mt-4 bg-[#2D1B69]"
            disabled={isRunning || !currentUser}
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Executando...
              </>
            ) : (
              'Executar Diagnóstico Completo'
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Diagnóstico</CardTitle>
            <p className="text-sm text-gray-500">
              Executado em: {new Date(results.timestamp).toLocaleString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.tests.map((test, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  {getStatusIcon(test.status)}
                  <h3 className="font-semibold text-gray-800">{test.name}</h3>
                </div>
                
                {test.data && (
                  <div className="ml-8 bg-gray-50 rounded p-3">
                    <pre className="text-xs overflow-auto max-h-96">
                      {JSON.stringify(test.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {/* Resumo Final */}
            <Alert className="mt-6">
              <AlertDescription>
                <strong>Análise:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                  <li>
                    {results.tests.filter(t => t.status === 'success').length} testes bem-sucedidos
                  </li>
                  <li>
                    {results.tests.filter(t => t.status === 'error').length} testes com erro
                  </li>
                  <li>
                    {results.tests.filter(t => t.status === 'warning').length} testes com aviso
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}