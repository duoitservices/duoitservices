import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TicketFilters from '../components/tickets/TicketFilters';
import TicketList from '../components/tickets/TicketList';
import FilterManager from '../components/tickets/FilterManager';
import { Loader2 } from 'lucide-react';

const defaultColumns = ['ticket_number', 'title', 'module', 'partner', 'status', 'created_date', 'sla_response', 'sla_solution', 'updated_date', 'main_resource', 'logged_hours', 'estimated_hours'];

export default function ClientMyTickets() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    id: '',
    title: '',
    ticket_type: '',
    module: '',
    status: [],
    priority: '',
    partner: '',
    dateFrom: null,
    dateTo: null
  });
  const [visibleColumns, setVisibleColumns] = useState(defaultColumns);
  const [columnOrder, setColumnOrder] = useState(['ticket_number', 'title', 'module', 'partner', 'status', 'created_date', 'sla_response', 'sla_solution', 'updated_date', 'main_resource', 'other_resources', 'manager', 'logged_hours', 'estimated_hours']);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedFilters, setSavedFilters] = useState([]);
  const [showFilterManager, setShowFilterManager] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const sessionData = localStorage.getItem('app_user');
      if (!sessionData) return null;
      const session = JSON.parse(sessionData);
      const users = await base44.entities.SystemUser.filter({ id: session.id });
      return users[0] || null;
    }
  });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['clientTickets', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      const allTickets = await base44.entities.Ticket.list('-created_date');
      
      // Filtrar apenas chamados abertos pelo solicitante (requester_email ou created_by)
      return allTickets.filter(t => 
        t.requester_email === currentUser.email ||
        t.created_by === currentUser.email
      );
    },
    enabled: !!currentUser
  });

  const { data: userPrefs } = useQuery({
    queryKey: ['userPrefs', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return null;
      const prefs = await base44.entities.UserPreferences.filter({ user_email: currentUser.email });
      return prefs[0] || null;
    },
    enabled: !!currentUser
  });

  const { data: allSavedFilters = [] } = useQuery({
    queryKey: ['savedFilters', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const filters = await base44.entities.SavedFilter.list('-created_date');
      return filters.filter(f => f.created_by === currentUser.email || f.is_public);
    },
    enabled: !!currentUser
  });

  useEffect(() => {
    if (userPrefs) {
      if (userPrefs.visible_columns?.length) setVisibleColumns(userPrefs.visible_columns);
      if (userPrefs.column_order?.length) setColumnOrder(userPrefs.column_order);
      if (userPrefs.rows_per_page) setRowsPerPage(userPrefs.rows_per_page);
    }
  }, [userPrefs]);

  useEffect(() => {
    setSavedFilters(allSavedFilters);
  }, [allSavedFilters]);

  const savePrefs = useMutation({
    mutationFn: async (data) => {
      if (!currentUser?.email) return;
      if (userPrefs?.id) {
        return base44.entities.UserPreferences.update(userPrefs.id, data);
      } else {
        return base44.entities.UserPreferences.create({ user_email: currentUser.email, ...data });
      }
    },
    onSuccess: () => queryClient.invalidateQueries(['userPrefs']),
  });

  useEffect(() => {
    if (userPrefs !== undefined && userPrefs !== null) {
      const timeout = setTimeout(() => {
        savePrefs.mutate({ visible_columns: visibleColumns, column_order: columnOrder, rows_per_page: rowsPerPage });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [visibleColumns, columnOrder, rowsPerPage, userPrefs?.id]);

  const handleSaveFilter = async (name, filterData) => {
    await base44.entities.SavedFilter.create({ 
      name, 
      filters: filterData,
      is_public: false 
    });
    queryClient.invalidateQueries(['savedFilters']);
  };

  const handleApplySavedFilter = (filterData) => {
    setFilters(filterData);
  };

  const filteredTickets = tickets.filter(ticket => {
    // Filtro de ID com múltiplos valores separados por vírgula
    if (filters.id) {
      const ids = filters.id.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length > 0 && !ids.some(id => String(ticket.ticket_number).includes(id))) return false;
    }
    if (filters.title && !ticket.title?.toLowerCase().includes(filters.title.toLowerCase())) return false;
    if (filters.ticket_type && filters.ticket_type !== 'all' && ticket.ticket_type !== filters.ticket_type) return false;
    if (filters.module && filters.module !== 'all' && ticket.module !== filters.module) return false;
    // Filtro de status com múltiplos valores
    if (filters.status && filters.status.length > 0 && !filters.status.includes(ticket.status)) return false;
    if (filters.priority && filters.priority !== 'all' && ticket.priority !== filters.priority) return false;
    if (filters.partner && !ticket.partner?.toLowerCase().includes(filters.partner.toLowerCase())) return false;
    if (filters.dateFrom && new Date(ticket.created_date) < filters.dateFrom) return false;
    if (filters.dateTo && new Date(ticket.created_date) > filters.dateTo) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-[#2D1B69]" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Meus Chamados</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe todos os chamados que você abriu</p>
      </div>

      <TicketFilters 
        filters={filters} 
        setFilters={setFilters}
        onSaveFilter={handleSaveFilter}
        savedFilters={savedFilters}
        onApplySavedFilter={handleApplySavedFilter}
        onManageFilters={() => setShowFilterManager(true)}
      />

      <FilterManager 
        open={showFilterManager}
        onClose={() => setShowFilterManager(false)}
        savedFilters={savedFilters}
        onRefresh={() => queryClient.invalidateQueries(['savedFilters'])}
      />

      <TicketList
        tickets={filteredTickets}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        rowsPerPage={rowsPerPage}
        setRowsPerPage={setRowsPerPage}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}