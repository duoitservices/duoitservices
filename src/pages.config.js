/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AccessRoles from './pages/AccessRoles';
import AllTickets from './pages/AllTickets';
import Auth from './pages/Auth';
import Calendar from './pages/Calendar';
import CalendarDetails from './pages/CalendarDetails';
import Categories from './pages/Categories';
import ClientApprovals from './pages/ClientApprovals';
import ClientMyTickets from './pages/ClientMyTickets';
import ClientNewTicket from './pages/ClientNewTicket';
import ClosureDetails from './pages/ClosureDetails';
import ClosuresList from './pages/ClosuresList';
import ContractTypes from './pages/ContractTypes';
import Dashboards from './pages/Dashboards';
import DiagnosticUserContract from './pages/DiagnosticUserContract';
import Fechamentos from './pages/Fechamentos';
import HourApproval from './pages/HourApproval';
import ManagerEstimates from './pages/ManagerEstimates';
import Modules from './pages/Modules';
import MyDashboard from './pages/MyDashboard';
import MyProjects from './pages/MyProjects';
import MyTasks from './pages/MyTasks';
import MyTickets from './pages/MyTickets';
import NewProject from './pages/NewProject';
import NewTicket from './pages/NewTicket';
import NotificationsHistory from './pages/NotificationsHistory';
import NotificationsSettings from './pages/NotificationsSettings';
import PartnerDetails from './pages/PartnerDetails';
import Partners from './pages/Partners';
import Positions from './pages/Positions';
import ProjectsList from './pages/ProjectsList';
import Reports from './pages/Reports';
import SLA from './pages/SLA';
import ServiceContractDetails from './pages/ServiceContractDetails';
import ServiceContracts from './pages/ServiceContracts';
import TaskDetails from './pages/TaskDetails';
import TestLogin from './pages/TestLogin';
import TicketDetails from './pages/TicketDetails';
import TicketEstimate from './pages/TicketEstimate';
import TicketTypes from './pages/TicketTypes';
import TimeEntry from './pages/TimeEntry';
import TimeManagement from './pages/TimeManagement';
import Users from './pages/Users';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AccessRoles": AccessRoles,
    "AllTickets": AllTickets,
    "Auth": Auth,
    "Calendar": Calendar,
    "CalendarDetails": CalendarDetails,
    "Categories": Categories,
    "ClientApprovals": ClientApprovals,
    "ClientMyTickets": ClientMyTickets,
    "ClientNewTicket": ClientNewTicket,
    "ClosureDetails": ClosureDetails,
    "ClosuresList": ClosuresList,
    "ContractTypes": ContractTypes,
    "Dashboards": Dashboards,
    "DiagnosticUserContract": DiagnosticUserContract,
    "Fechamentos": Fechamentos,
    "HourApproval": HourApproval,
    "ManagerEstimates": ManagerEstimates,
    "Modules": Modules,
    "MyDashboard": MyDashboard,
    "MyProjects": MyProjects,
    "MyTasks": MyTasks,
    "MyTickets": MyTickets,
    "NewProject": NewProject,
    "NewTicket": NewTicket,
    "NotificationsHistory": NotificationsHistory,
    "NotificationsSettings": NotificationsSettings,
    "PartnerDetails": PartnerDetails,
    "Partners": Partners,
    "Positions": Positions,
    "ProjectsList": ProjectsList,
    "Reports": Reports,
    "SLA": SLA,
    "ServiceContractDetails": ServiceContractDetails,
    "ServiceContracts": ServiceContracts,
    "TaskDetails": TaskDetails,
    "TestLogin": TestLogin,
    "TicketDetails": TicketDetails,
    "TicketEstimate": TicketEstimate,
    "TicketTypes": TicketTypes,
    "TimeEntry": TimeEntry,
    "TimeManagement": TimeManagement,
    "Users": Users,
}

export const pagesConfig = {
    mainPage: "MyTickets",
    Pages: PAGES,
    Layout: __Layout,
};