import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Bell } from 'lucide-react';
import { NotificationSettingsProvider } from '../components/settings/notifications/NotificationSettingsContext';
import { useNotificationSettings } from '../components/settings/notifications/useNotificationSettings';
import { notificationTypes } from '../components/settings/notifications/notificationSettingsService';
import { notificationEngine } from '../components/notifications/notificationEngine';
import NotificationRecipientConfig from '../components/settings/notifications/NotificationRecipientConfig';
import NotificationChannelConfig from '../components/settings/notifications/NotificationChannelConfig';
import NotificationTriggerConfig from '../components/settings/notifications/NotificationTriggerConfig';
import EmailTemplateEditor from '../components/settings/notifications/EmailTemplateEditor';

/**
 * Conteúdo principal da página de configurações
 * Separado para usar o contexto
 */
function NotificationsSettingsContent() {
  const { settings, loading, updateSetting, resetToDefault } = useNotificationSettings();
  const [activeTab, setActiveTab] = useState('status_change');
  const [saving, setSaving] = useState(false);

  const currentSetting = settings[activeTab] || {};

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting(activeTab, currentSetting);
      // Recarregar configurações no engine
      await notificationEngine.reloadSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = (field, value) => {
    updateSetting(activeTab, { ...currentSetting, [field]: value });
  };

  const handleResetTemplate = async () => {
    if (window.confirm('Tem certeza que deseja restaurar o template padrão? As alterações atuais serão perdidas.')) {
      await resetToDefault(activeTab);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Bell className="text-[#2D1B69]" size={28} />
          Configurações de Notificações
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure como e quando as notificações serão enviadas para os usuários
        </p>
      </div>

      {/* Tabs por tipo de notificação */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          {notificationTypes.map(type => (
            <TabsTrigger key={type.id} value={type.id} className="flex-1 min-w-[150px]">
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {notificationTypes.map(type => (
          <TabsContent key={type.id} value={type.id} className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{type.label}</CardTitle>
                    <CardDescription className="mt-1">{type.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm">Ativo</Label>
                    <Switch
                      checked={currentSetting.enabled}
                      onCheckedChange={(checked) => handleUpdate('enabled', checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Destinatários */}
                <NotificationRecipientConfig
                  recipients={currentSetting.recipients || []}
                  onChange={(recipients) => handleUpdate('recipients', recipients)}
                />

                {/* Canais */}
                <NotificationChannelConfig
                  channels={currentSetting.channels || {}}
                  delayInMinutes={currentSetting.delayInMinutes || 0}
                  onChange={({ channels, delayInMinutes }) => {
                    updateSetting(activeTab, {
                      ...currentSetting,
                      channels,
                      delayInMinutes
                    });
                  }}
                />

                {/* Gatilhos */}
                <NotificationTriggerConfig
                  triggerEvents={currentSetting.triggerEvents || []}
                  onChange={(triggerEvents) => handleUpdate('triggerEvents', triggerEvents)}
                />

                {/* Template de E-mail (se canal email estiver ativo) */}
                {currentSetting.channels?.email && (
                  <EmailTemplateEditor
                    template={currentSetting.emailTemplate || { subject: '', body: '' }}
                    onChange={(template) => handleUpdate('emailTemplate', template)}
                    onReset={handleResetTemplate}
                  />
                )}

                {/* Botão salvar */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#2D1B69] hover:bg-[#2D1B69]/90"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2" size={16} />
                        Salvar Configurações
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/**
 * Página principal de configurações de notificações
 * Wrapper com provider
 */
export default function NotificationsSettings() {
  return (
    <NotificationSettingsProvider>
      <NotificationsSettingsContent />
    </NotificationSettingsProvider>
  );
}