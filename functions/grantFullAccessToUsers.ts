import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Verificar se é administrador
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Acesso negado: apenas administradores podem executar esta ação' },
        { status: 403 }
      );
    }

    // Buscar ou criar a função de acesso com permissões totais
    const existingRoles = await base44.asServiceRole.entities.AccessRole.filter(
      { name: 'Acesso Total' }
    );

    let fullAccessRole = existingRoles[0];

    if (!fullAccessRole) {
      // Criar a função de acesso com todas as permissões ativas
      fullAccessRole = await base44.asServiceRole.entities.AccessRole.create({
        name: 'Acesso Total',
        description: 'Função com acesso completo a todas as funcionalidades',
        permissions: {
          consultor_meus_chamados: true,
          consultor_novo_chamado: true,
          consultor_meu_dashboard: true,
          consultor_gestao_horas: true,
          consultor_apontamento_horas: true,
          gestor_dashboards: true,
          gestor_relatorios: true,
          gestor_lista_chamados: true,
          gestor_fechamentos: true,
          admin_usuarios: true,
          admin_colaboradores: true,
          admin_parceiros: true,
          admin_contratos: true,
          config_tipo_chamados: true,
          config_modulos: true,
          config_calendario: true,
          config_cargos: true,
          config_funcoes_acesso: true,
          config_sla: true
        }
      });
    }

    // Buscar todos os usuários ativos
    const allUsers = await base44.asServiceRole.entities.SystemUser.list();
    const activeUsers = allUsers.filter(u => u.active !== false);

    // Atualizar cada usuário com a função de acesso total
    let updatedCount = 0;
    for (const userToUpdate of activeUsers) {
      await base44.asServiceRole.entities.SystemUser.update(userToUpdate.id, {
        access_role_id: fullAccessRole.id,
        is_administrator: true
      });
      updatedCount++;
    }

    return Response.json({
      success: true,
      message: `${updatedCount} usuários atualizados com acesso total`,
      roleId: fullAccessRole.id,
      usersUpdated: updatedCount
    });
  } catch (error) {
    console.error('Erro ao conceder acesso total:', error);
    return Response.json(
      { error: error.message || 'Erro ao conceder acesso total' },
      { status: 500 }
    );
  }
});