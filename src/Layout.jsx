import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Ticket, 
  PlusCircle, 
  BarChart3, 
  Clock, 
  CalendarClock,
  Menu,
  X,
  Users,
  User,
  FileText,
  CheckCircle2,
  Circle,
  UserCircle,
  Sun,
  Moon,
  Monitor,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserProfile from './components/UserProfile';
import { NotificationProvider } from './components/notifications/NotificationContext';
import { NotificationBell } from './components/notifications';
import { AuthProvider, AuthContext } from './components/auth/AuthContext';
import { Toaster } from './components/ui/sonner';

export default function Layout({ children, currentPageName }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [zoomLevel, setZoomLevel] = useState(parseInt(localStorage.getItem('zoomLevel') || '100'));

  // Check authentication
  useEffect(() => {
    if (currentPageName === 'Auth') return;
    
    const session = localStorage.getItem('app_user');
    if (!session) {
      console.log('[Auth] No session found, redirecting to login');
      window.location.href = '/Auth';
      return;
    }
  }, [currentPageName]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        // System theme
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };
    
    applyTheme();
    localStorage.setItem('theme', theme);
    
    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Apply zoom
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${zoomLevel}%`;
    localStorage.setItem('zoomLevel', zoomLevel.toString());
  }, [zoomLevel]);

  const increaseZoom = () => {
    setZoomLevel(prev => Math.min(prev + 10, 150));
  };

  const decreaseZoom = () => {
    setZoomLevel(prev => Math.max(prev - 10, 70));
  };

  const resetZoom = () => {
    setZoomLevel(100);
  };



  // Render Auth page without layout
  if (currentPageName === 'Auth') {
    return children;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <LayoutContent
          children={children}
          currentPageName={currentPageName}
          theme={theme}
          setTheme={setTheme}
          zoomLevel={zoomLevel}
          increaseZoom={increaseZoom}
          decreaseZoom={decreaseZoom}
          resetZoom={resetZoom}
        />
      </NotificationProvider>
    </AuthProvider>
  );
}

function LayoutContent({
  children,
  currentPageName,
  theme,
  setTheme,
  zoomLevel,
  increaseZoom,
  decreaseZoom,
  resetZoom
}) {
  const { currentUser, logout } = React.useContext(AuthContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState('consultor');
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Debug log para verificar currentUser
  useEffect(() => {
    console.log('🔍 [LayoutContent] currentUser:', currentUser);
  }, [currentUser]);

  const toggleMenu = (menu) => {
    setOpenMenu(openMenu === menu ? menu : menu);
  };

  const menuItems = [
    {
      id: 'cliente',
      title: 'Área do cliente',
      icon: UserCircle,
      submenu: [
        { name: 'Novo chamado', page: 'ClientNewTicket', icon: PlusCircle },
        { name: 'Meus chamados', page: 'ClientMyTickets', icon: Ticket },
        { name: 'Aprovações', page: 'ClientApprovals', icon: CheckCircle2 },
      ]
    },
    {
      id: 'consultor',
      title: 'Área do consultor',
      icon: Ticket,
      submenu: [
        { name: 'Novo chamado', page: 'NewTicket', icon: PlusCircle },
        { name: 'Meus chamados', page: 'MyTickets', icon: Ticket },
        { name: 'Minhas tarefas', page: 'MyTasks', icon: CheckCircle2 },
        { name: 'Meu dashboard', page: 'MyDashboard', icon: BarChart3 },
        { name: 'Meus apontamentos', page: 'TimeManagement', icon: CalendarClock },
        { name: 'Acompanhamento mensal', page: 'TimeEntry', icon: CalendarClock },
        { name: 'Meus projetos', page: 'MyProjects', icon: FolderOpen },
      ]
    },
    {
      id: 'gestor',
      title: 'Área do Gestor',
      icon: BarChart3,
      submenu: [
        { name: 'Dashboards', page: 'Dashboards', icon: BarChart3 },
        { name: 'Relatórios', page: 'Reports', icon: FileText },
        { name: 'Lista de chamados', page: 'AllTickets', icon: Ticket },
        { name: 'Estimativas', page: 'ManagerEstimates', icon: FileText },
        { name: 'Gestão de Horas', page: 'HourApproval', icon: CalendarClock },
        { name: 'Fechamento', page: 'Fechamentos', icon: FileText },
        { name: 'Fechamentos Gerados', page: 'ClosuresList', icon: CheckCircle2 },
        { name: 'Lista de Projetos', page: 'ProjectsList', icon: FolderOpen },
      ]
    },
    {
      id: 'admin',
      title: 'Administração',
      icon: Users,
      submenu: [
        { name: 'Usuários', page: 'Users', icon: User },
        { name: 'Parceiros', page: 'Partners', icon: Users },
        { name: 'Contratos de serviço', page: 'ServiceContracts', icon: FileText },
      ]
    },
    {
      id: 'config',
      title: 'Configurações',
      icon: Circle,
      submenu: [
        { name: 'Tipo de chamados', page: 'TicketTypes', icon: Circle },
        { name: 'Tipos de contratos', page: 'ContractTypes', icon: Circle },
        { name: 'Módulos', page: 'Modules', icon: Circle },
        { name: 'Calendário', page: 'Calendar', icon: CalendarClock },
        { name: 'Cargos', page: 'Positions', icon: Circle },
        { name: 'Funções de acesso', page: 'AccessRoles', icon: Circle },
        { name: 'Notificações', page: 'NotificationsSettings', icon: Circle },
        { name: '🔍 Diagnóstico', page: 'DiagnosticUserContract', icon: Circle },
      ]
    }
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-gradient-to-b from-[#2D1B69] to-[#1a103d] text-white transition-all duration-300 flex flex-col shadow-2xl",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent">
              DuoIT Services
            </h1>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
          {menuItems.map((menu) => (
            <div key={menu.id}>
              <button
                onClick={() => !isCollapsed && toggleMenu(menu.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                  "hover:bg-white/10",
                  isCollapsed ? "justify-center" : "justify-between"
                )}
              >
                <div className="flex items-center gap-3">
                  <menu.icon size={20} className="text-orange-400" />
                  {!isCollapsed && (
                    <span className="font-medium text-sm">{menu.title}</span>
                  )}
                </div>
                {!isCollapsed && (
                   <ChevronRight 
                    size={16} 
                    className={cn(
                      "transition-transform text-white/50",
                      openMenu === menu.id && "rotate-90"
                    )}
                   />
                )}
              </button>
              
              {!isCollapsed && openMenu === menu.id && (
                <div className="ml-4 mt-1 space-y-1">
                  {menu.submenu.map((item) => (
                    <Link
                      key={item.page}
                      to={createPageUrl(item.page)}
                      className={cn(
                        "flex items-center gap-3 p-2.5 pl-4 rounded-lg transition-all text-sm",
                        currentPageName === item.page
                          ? "bg-gradient-to-r from-orange-500/20 to-blue-500/20 text-white border-l-2 border-orange-400"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <item.icon size={16} />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-white/10">
            <p className="text-xs text-white/40 text-center">
              © {new Date().getFullYear()} DuoIT Services v1.0.0
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Top Bar */}
        <div className="bg-gradient-to-r from-[#2D1B69] to-[#1a103d] text-white px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            {/* User Profile */}
            <button
              onClick={() => {
                console.log('🖱️ [Profile Button] Clicked! Current modal state:', showUserProfile);
                console.log('🖱️ [Profile Button] Current user data:', currentUser);
                setShowUserProfile(true);
              }}
              className="flex items-center gap-3 hover:bg-white/10 rounded-lg p-2 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <UserCircle size={32} className="text-white" />
              </div>
              {currentUser && (
                <div className="text-left">
                  <div className="font-semibold text-sm leading-tight">
                    {currentUser.first_name} {currentUser.last_name}
                  </div>
                  <div className="text-xs text-white/70 leading-tight mt-0.5">
                    {currentUser.position_name || 'Sem cargo'}
                  </div>
                </div>
              )}
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  {theme === 'light' && <Sun size={20} />}
                  {theme === 'dark' && <Moon size={20} />}
                  {theme === 'system' && <Monitor size={20} />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  Claro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  Escuro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-8 w-8"
                onClick={decreaseZoom}
                disabled={zoomLevel <= 70}
                title="Diminuir zoom"
              >
                <span className="text-xs font-bold">A</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-8 w-8"
                onClick={resetZoom}
                disabled={zoomLevel === 100}
                title={`Zoom: ${zoomLevel}% - Clique para resetar`}
              >
                <span className="text-[10px]">{zoomLevel}%</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10 h-8 w-8"
                onClick={increaseZoom}
                disabled={zoomLevel >= 150}
                title="Aumentar zoom"
              >
                <span className="text-base font-bold">A</span>
              </Button>
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={logout}
            >
              <LogOut size={20} />
            </Button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
          {children}
        </div>
      </main>

      {console.log('🎭 [Layout] Rendering UserProfile with open:', showUserProfile)}
      <UserProfile 
        open={showUserProfile} 
        onClose={() => {
          console.log('❌ [UserProfile] Close button clicked');
          setShowUserProfile(false);
        }}
      />
      <Toaster richColors position="top-right" />
    </div>
  );
}