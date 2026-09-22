import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Bell, BellRing, Folder, Layers, Users, Settings, FileText, CheckCircle,
  AlertTriangle, RefreshCw, Sparkles, LogOut, ChevronRight, Upload,
  PlusCircle, Trash2, ArrowLeft, Send, CheckSquare, MessageSquare, ExternalLink, HelpCircle, Building2, CircleDollarSign, Trophy, Clock3, Filter, TrendingUp, ListChecks
} from 'lucide-react';


const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
// Cloud session: automatically attach the server-issued bearer token to API requests.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const token = sessionStorage.getItem('dc_access_token');
  const url = typeof input === 'string' ? input : input?.url || '';
  const isApiRequest = url.startsWith(API_BASE_URL);
  if (!token || !isApiRequest || url.endsWith('/api/login')) return nativeFetch(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return nativeFetch(input, { ...init, headers });
};

const SafeBell = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const ESTADOS_MEXICO = {
  "CDMX": "Líder Regional - Sur",
  "Estado de México": "Líder Regional - Sur",
  "Querétaro": "Líder Regional - Sur",
  "Guanajuato": "Líder Regional - Sur",
  "Jalisco": "Líder Regional - Sur",
  "Michoacán": "Líder Regional - Sur",
  "Puebla": "Líder Regional - Sur",
  "Veracruz": "Líder Regional - Sur",
  "Hidalgo": "Líder Regional - Sur",
  "Morelos": "Líder Regional - Sur",
  "Guerrero": "Líder Regional - Sur",
  "Oaxaca": "Líder Regional - Sur",
  "Chiapas": "Líder Regional - Sur",
  "Tabasco": "Líder Regional - Sur",
  "Campeche": "Líder Regional - Sur",
  "Yucatán": "Líder Regional - Sur",
  "Quintana Roo": "Líder Regional - Sur",
  "Tlaxcala": "Líder Regional - Sur",
  "Colima": "Líder Regional - Sur",
  "Nayarit": "Líder Regional - Sur",
  "Nuevo León": "Líder Regional - Norte",
  "Chihuahua": "Líder Regional - Norte",
  "Coahuila": "Líder Regional - Norte",
  "Sonora": "Líder Regional - Norte",
  "Baja California": "Líder Regional - Norte",
  "Baja California Sur": "Líder Regional - Norte",
  "San Luis Potosí": "Líder Regional - Norte",
  "Aguascalientes": "Líder Regional - Norte",
  "Durango": "Líder Regional - Norte",
  "Sinaloa": "Líder Regional - Norte",
  "Zacatecas": "Líder Regional - Norte",
  "Tamaulipas": "Líder Regional - Norte"
};




// Reusable Premium SVG Donut Chart
const DonutChart = ({ data, totalText }) => {
  const total = data.reduce((acc, x) => acc + (x.value || 0), 0);
  let accumulatedPercent = 0;

  return (
    <div className="flex items-center space-x-6">
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {total === 0 ? (
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
          ) : (
            data.map((item, idx) => {
              const percent = item.value / total;
              const circumference = 2 * Math.PI * 40; // ~251.2
              const strokeDasharray = `${percent * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;

              return (
                <circle
                  key={idx}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="12"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-300 hover:stroke-[14px]"
                />
              );
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{totalText || 'Total'}</span>
          <span className="text-sm font-black text-slate-900">{total}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1 text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
              <span className="font-semibold text-slate-700 truncate max-w-[100px]">{item.label}</span>
            </div>
            <span className="font-bold text-slate-900 ml-2">{item.value} ({total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msConnected, setMsConnected] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [finalAmountEdit, setFinalAmountEdit] = useState('');
  const [newProjLider, setNewProjLider] = useState('');
  const [editProjLider, setEditProjLider] = useState('');
  const [activeStepTab, setActiveStepTab] = useState(1);
  const [cierreDesfase, setCierreDesfase] = useState("0.0");
  
  // Create Project Form State
  const [newProjName, setNewProjName] = useState('');
  const [newProjSkipToCierre, setNewProjSkipToCierre] = useState(false);
  const [newProjFinalAmount, setNewProjFinalAmount] = useState('0.0');
  const [newProjClient, setNewProjClient] = useState('');
  const [newProjState, setNewProjState] = useState('CDMX');
  const [newProjCostos, setNewProjCostos] = useState('');
  const [newProjCommResp, setNewProjCommResponsibility] = useState('Agente de Ventas');
  const [newProjVentas, setNewProjVentas] = useState('');
  const [newProjPriority, setNewProjPriority] = useState('Media');
  const [newProjDate, setNewProjDate] = useState('');

  // Manage / Edit Form State
  const [editProjId, setEditProjId] = useState('');
  const [editProjName, setEditProjName] = useState('');
  const [editProjClient, setEditProjClient] = useState('');
  const [editProjDate, setEditProjDate] = useState('');
  const [editProjPriority, setEditProjPriority] = useState('Media');
  const [editProjCostos, setEditProjCostos] = useState('');
  const [editProjCommResp, setEditProjCommResponsibility] = useState('Agente de Ventas');
  const [editProjVentas, setEditProjVentas] = useState('');
  const [editJustification, setEditProjJustification] = useState('');

  // Checkboxes for individual stages in Edit
  const [chkGateS1, setChkGateS1] = useState(false);
  const [chkGateS2V, setChkGateS2V] = useState(false);
  const [chkGateS2L, setChkGateS2L] = useState(false);
  const [chkGateS2, setChkGateS2] = useState(false);
  const [chkGateS3, setChkGateS3] = useState(false);
  const [chkGateS4, setChkGateS4] = useState(false);
  const [chkGateS5, setChkGateS5] = useState(false);
  const [chkGateS6, setChkGateS6] = useState(false);
  const [editStageNum, setEditStageNum] = useState(1);

  // Users Management State
  const [usersList, setUsersList] = useState([]);
  const [nuUser, setNuUser] = useState('');
  const [nuPass, setNuPass] = useState('');
  const [nuName, setNuName] = useState('');
  const [nuEmail, setNuEmail] = useState('');
  const [nuRole, setNuRole] = useState('Ventas');
  const [userToDel, setUserToDel] = useState('');

  // User privileges & Editing State
  const [editingUser, setEditingUser] = useState(null);
  const [nuPrivDash, setNuPrivDash] = useState(true);
  const [nuPrivRep, setNuPrivRep] = useState(true);
  const [nuPrivProj, setNuPrivProj] = useState(true);
  const [nuPrivRev, setNuPrivRev] = useState(false);


  // Profile Edit State
  const [myProfileName, setMyProfileName] = useState('');
  const [myProfileEmail, setMyProfileEmail] = useState('');
  const [myProfilePass, setMyProfilePass] = useState('');
  const [myProfilePin, setMyProfilePin] = useState('');

  // System Settings State (Consola de Control)
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('notificaciones@dccontrol.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSender, setSmtpSender] = useState('DC Control Notificaciones');
  const [teamsWebhook, setTeamsWebhook] = useState('');
  const [teamsWebhookConfigured, setTeamsWebhookConfigured] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  
  const [msTenant, setMsTenant] = useState('f12531b8-811a-4685-a6a9-8939e3e5570d');
  const [msClient, setMsClient] = useState('365d65d4-d115-4da6-9e92-8ed30cd55c28');
  const [msSecret, setMsSecret] = useState('');
  const [msSecretConfigured, setMsSecretConfigured] = useState(false);

  // Step Action Variables
  const [stepComment, setStepComment] = useState('');
  const [stepFile, setStepFile] = useState(null);
  const [reversalTarget, setReversalTarget] = useState(1);
  const [projectUploads, setProjectUploads] = useState([]);
  const [directorReportEmails, setDirectorReportEmails] = useState('director@dccontrol.com');
  const [emailSending, setEmailSending] = useState(false);
  const [reversalJustification, setReversalJustification] = useState('');
  const [p5ModificationJustification, setP5ModificationJustification] = useState('');
  

  const safeProjectUploads = Array.isArray(projectUploads) ? projectUploads : [];
  const [auditLogs, setAuditLogs] = useState([]);

  // Filters State
  const [dashboardFilter, setDashboardFilter] = useState('Todos');
  const [dashboardClientFilter, setDashboardClientFilter] = useState('Todos');
  const [auditFilter, setAuditFilter] = useState('Todos');
  const [clientsList, setClientsList] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [clientSaving, setClientSaving] = useState(false);

  // Synchronize active step tab on project select
  useEffect(() => {
    if (selectedProject) {
      setActiveStepTab(selectedProject.current_stage);
      setCierreDesfase((selectedProject.lose_percentage_gap || 0.0).toString());
      setFinalAmountEdit(
        selectedProject.final_amount !== null && selectedProject.final_amount !== undefined
          ? String(selectedProject.final_amount)
          : ''
      );
    } else {
      setFinalAmountEdit('');
    }
  }, [selectedProject]);

  // Load user session on boot
  useEffect(() => {
  // Force user to log in on startup for confidentiality and to avoid premature fetching
  sessionStorage.removeItem('dc_user');
  sessionStorage.removeItem('dc_access_token');
  setUser(null);
  fetchSystemSettings();
}, []);

  // Fetch projects and other logs on login change
  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchDashboardSummary();
      fetchUsers();
      fetchClients();
      fetchAuditLogs();
      setMyProfileName(user.full_name);
      setMyProfileEmail(user.email || '');
    }
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        sessionStorage.setItem('dc_user', JSON.stringify(userData));
        if (userData.access_token) sessionStorage.setItem('dc_access_token', userData.access_token);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Credenciales incorrectas');
      }
    } catch {
      setLoginError('Error de red. Asegúrate de que FastAPI esté activo.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('dc_user');
    sessionStorage.removeItem('dc_access_token');
    setActiveTab('dashboard');
    setSelectedProject(null);
    setUsername('');
    setPassword('');
    setLoginError('');
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`);
      if (res.ok) {
        const data = await res.json();
        const normalized = Array.isArray(data) ? data : [];
        setProjects(normalized);
        // Mantener KPIs y gráficas sincronizados con el pipeline real.
        fetchDashboardSummary();
        return normalized;
      }
    } catch (err) {
      console.error("Error al obtener proyectos:", err);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const fetchDashboardSummary = async () => {
    try {
      const token = sessionStorage.getItem('dc_access_token') || '';

      const res = await fetch(`${API_BASE_URL}/api/dashboard/summary`, {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      });

      if (res.ok) {
        const data = await res.json();
        setDashboardSummary(data);
      } else {
        console.error("Error al obtener resumen global:", res.status);
        setDashboardSummary(null);
      }
    } catch (err) {
      console.error("Error al obtener resumen global:", err);
      setDashboardSummary(null);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setUsersList(list);

        // Si existe un único usuario de Costos, seleccionarlo
        // automáticamente para nuevas licitaciones.
        const costosUsers = list.filter(u => {
          const role = (u.role || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

          return role.includes('costos') || role.includes('analista');
        });

        if (costosUsers.length === 1) {
          setNewProjCostos(prev => prev || costosUsers[0].full_name);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients`);
      if (res.ok) {
        const data = await res.json();
        setClientsList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error al obtener clientes:', err);
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    const name = newClientName.trim();
    if (!name) return;
    setClientSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'No se pudo registrar el cliente.');
        return;
      }
      setNewClientName('');
      await fetchClients();
      alert(`Cliente "${data.name}" registrado correctamente.`);
    } catch (err) {
      alert('Error de red al registrar el cliente.');
    } finally {
      setClientSaving(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audit-logs`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkTeamsConnection = async () => {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/system-settings/test-ms', {
      method: 'POST'
    });

    const data = await res.json();

    console.log('Resultado prueba Microsoft Graph:', data);

    setMsConnected(data.success);

    if (data.success) {
      alert(`✅ Conexión con Microsoft Graph exitosa.\n\nDrive ID: ${data.drive_id || 'Detectado'}`);
    } else {
      alert(`❌ Microsoft Graph NO pudo conectarse.\n\nError:\n${data.error || 'No se recibió información del error.'}`);
    }

  } catch (err) {
    console.error('Error probando Microsoft Graph:', err);
    setMsConnected(false);
    alert(`❌ Error de conexión con el backend.\n\n${err.message}`);
  }
};

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/system-settings`);
      if (res.ok) {
        const data = await res.json();
        setSmtpHost(data.smtp_host);
        setSmtpPort(data.smtp_port);
        setSmtpUser(data.smtp_user);
        setSmtpSender(data.smtp_sender);
        setTeamsWebhook('');
        setTeamsWebhookConfigured(!!data.teams_webhook_configured);
        setNotifEnabled(data.notifications_enabled);
        setDirectorReportEmails(data.director_report_emails || "director@dccontrol.com");
        setMsTenant(data.ms_tenant_id);
        setMsClient(data.ms_client_id);
        setMsSecret('');
        setMsSecretConfigured(!!data.ms_client_secret_configured);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Safe variables for user roles
  const roleClean = user ? user.role.trim().toLowerCase() : '';
  const usernameClean = user ? user.username.trim().toLowerCase() : '';
  const isStrictAdmin = user && (roleClean === 'administrador' || roleClean === 'admin' || usernameClean === 'noe.ortizadm');
  const isAdminOrDirector = isStrictAdmin || (user && (roleClean.includes('director') || roleClean.includes('comercial') || roleClean.includes('moderador') || roleClean === 'mod'));
  const userPrivileges = new Set((user?.privileges || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean));
  const hasPrivilege = (privilege) => isAdminOrDirector || userPrivileges.has(String(privilege).toLowerCase());

  // Filtering projects exactly as the Streamlit role algorithm:
  const filteredProjects = projects.filter(p => {
    if (!user) return false;
    if (isAdminOrDirector) return true;
    const fullName = user.full_name;
    return (
      (p.assigned_ventas && (p.assigned_ventas === fullName || p.assigned_ventas === user.role)) ||
      (p.assigned_lider && (p.assigned_lider === fullName || p.assigned_lider === user.role)) ||
      (p.assigned_costos && (p.assigned_costos === fullName || p.assigned_costos === user.role))
    );
  });

  // Helper to determine if logged-in user has permission for the active step.
  // Keep this aligned with the backend: specific assignments beat broad roles;
  // only legacy generic assignments remain role-based.
  const getIsAuthorizedForActiveStep = () => {
    if (!user || !selectedProject) return false;
    const stage = Number(selectedProject.current_stage);
    const norm = (str) => str ? String(str).trim().toLowerCase() : '';
    const myName = norm(user.full_name);
    const myRole = norm(user.role);
    const myUser = norm(user.username);
    const matches = (assigned) => {
      const a = norm(assigned);
      if (!a) return false;
      if (a === myName || a === myUser) return true;
      if (a === 'agente de ventas' || a === 'ventas') return myRole.includes('ventas') || myRole.includes('comercial') || myRole.includes('agente');
      if (a === 'líder regional' || a === 'lider regional') return myRole.includes('lider') || myRole.includes('líder') || myRole.includes('regional');
      if (a === 'analista de costos' || a === 'costos') return myRole.includes('costos') || myRole.includes('analista');
      return false;
    };
    if (isAdminOrDirector) return true;
    if (stage === 1 || stage === 6) return matches(selectedProject.assigned_ventas);
    if (stage === 2) return matches(selectedProject.assigned_ventas) || matches(selectedProject.assigned_lider);
    if (stage === 3) return matches(selectedProject.assigned_lider);
    if (stage === 4) return matches(selectedProject.assigned_costos);
    return false;
  };

  const getIsAuthorizedToUpload = () => {
  if (!user || !selectedProject) return false;

  const stage = Number(selectedProject.current_stage);

  if (stage === 2) {
    return (
      isAdminOrDirector ||
      selectedProject.assigned_lider === user.full_name
    );
  }

  return getIsAuthorizedForActiveStep();
};

  // Calculate notifications of pending steps for sidebar
    // Calculate notifications of pending steps for sidebar - STRICT PERSONAL ROLE & ASSIGNMENT MATCHING
  const getSidebarNotifications = () => {
    if (!user) return [];
    const notis = [];
    const activeProjs = projects.filter(p => p.status !== 'Ganado' && p.status !== 'Perdido' && p.status !== 'Cancelado');

    const norm = (str) => str ? str.trim().toLowerCase() : '';
    const myName = norm(user.full_name);
    const myRole = norm(user.role);
    const myUser = norm(user.username);

    const isSalesRole = myRole.includes('ventas') || myRole.includes('comercial') || myRole.includes('agente') || myRole === 'ventas';
    const isLiderRole = myRole.includes('líder') || myRole.includes('lider') || myRole.includes('regional');
    const isCostosRole = myRole.includes('costos') || myRole.includes('analista') || myRole.includes('ingeniero');
    const isDirRole = isAdminOrDirector || myRole.includes('director') || myRole.includes('admin');

    activeProjs.forEach(p => {
      const pid = p.id;
      const stage = p.current_stage;

      const pVentas = norm(p.assigned_ventas);
      const pLider = norm(p.assigned_lider);
      const pCostos = norm(p.assigned_costos);

      // Check assignment matching: if empty or generic role title, open to all in role. If specific person, must match logged in user.
      const matchesAssignment = (assignedVal, isUserInRole) => {
        if (!isUserInRole) return false;
        if (!assignedVal || assignedVal === '' || assignedVal === 'agente de ventas' || assignedVal === 'ventas' || assignedVal === 'líder regional' || assignedVal === 'lider regional' || assignedVal === 'analista de costos') {
          return true;
        }
        return assignedVal === myName || assignedVal === myUser || assignedVal === myRole || myName.includes(assignedVal) || assignedVal.includes(myName);
      };

      const isMySales = matchesAssignment(pVentas, isSalesRole);
      const isMyLider = matchesAssignment(pLider, isLiderRole);
      const isMyCostos = matchesAssignment(pCostos, isCostosRole);
      const isMyDir = isDirRole;

      // 1. Agente de Ventas (Paso 1, Paso 2 Confirmación, Paso 6)
      if (isMySales) {
        if (stage === 1 && p.step1_completed === 0) {
          notis.push(`Paso 1: Realizar levantamiento para ${pid}`);
        }
        if (stage === 2 && p.step2_ventas_done === 0) {
          notis.push(`Paso 2: Confirmar reunión para ${pid}`);
        }
        if (stage === 6 && p.step6_completed === 0) {
          notis.push(`Paso 6: Entregar cotización a cliente para ${pid}`);
        }
      }

      // 2. Líder Regional (Paso 2 Confirmación, Paso 2 Minuta, Paso 3)
      if (isMyLider) {
        if (stage === 2 && p.step2_lider_done === 0) {
          notis.push(`Paso 2: Confirmar reunión para ${pid}`);
        }
        if (stage === 2 && p.step2_ventas_done === 1 && p.step2_lider_done === 1 && p.step2_completed === 0) {
          notis.push(`Paso 2: Cargar minuta de trabajo para ${pid}`);
        }
        if (stage === 3 && Number(p.step3_completed ?? 0) !== 1) {
          notis.push(`Paso 3: Cargar catálogo e ingeniería para ${pid}`);
        }
      }

      // 3. Analista de Costos (Paso 4)
      if (isMyCostos) {
        if (stage === 4 && p.step4_completed === 0) {
          notis.push(`Paso 4: Cargar cotización de precios para ${pid}`);
        }
      }

      // 4. Admin / Director General (Paso 5, Paso 7)
      if (isMyDir) {
        if (stage === 5 && p.step5_completed === 0) {
          notis.push(`Paso 5: Revisar y autorizar cotización de ${pid}`);
        }
        if (stage === 7 && p.step6_completed === 1) {
          notis.push(`Paso 7: Realizar cierre comercial para ${pid}`);
        }
      }
    });

    const uniqueNotis = [];
    notis.forEach(n => {
      if (!uniqueNotis.includes(n)) uniqueNotis.push(n);
    });
    return uniqueNotis;
  };
  const sidebarNotis = getSidebarNotifications();

  // Create registration post
  const handleCreateProject = async (e) => {
    e.preventDefault();
    const payload = {
      name: newProjName,
      client: newProjClient,
      state: newProjState,
      assigned_costos: newProjCostos,
      comm_responsibility: newProjCommResp,
      assigned_ventas: newProjVentas || null,
      assigned_lider: newProjLider || null,
      priority: newProjPriority,
      target_date: newProjDate,
      skip_to_cierre: newProjSkipToCierre,
      final_amount: parseFloat(String(newProjFinalAmount).replace(/[^0-9.]/g, "")) || 0.0
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Licitación ${data.id || ''} registrada con éxito. Carpeta SharePoint lista.`);
        fetchProjects();
        setNewProjName('');
        setNewProjClient('');
        setNewProjVentas('');
        setNewProjDate('');
        setNewProjSkipToCierre(false);
        setNewProjFinalAmount('0.0');
        setActiveStepTab(1);
      }
    } catch {
      alert('Error al conectar con el servidor.');
    }
  };

  // Populate edit fields
  const handleSelectEditProject = (projStr) => {
    const pid = projStr.split(" - ")[0];
    const p = projects.find(item => item.id === pid);
    if (p) {
      setEditProjId(p.id);
      setEditProjName(p.name);
      setEditProjClient(p.client || '');
      setEditProjDate(p.target_date || '');
      setEditProjPriority(p.priority || 'Media');
      setEditProjCostos(p.assigned_costos || '');
      setEditProjVentas(p.assigned_ventas || '');
      setEditProjLider(p.assigned_lider || '');
      setEditProjCommResponsibility(p.assigned_ventas === p.assigned_lider ? 'Líder Regional' : 'Agente de Ventas');
      setChkGateS1(p.step1_completed === 1);
      setChkGateS2V(p.step2_ventas_done === 1);
      setChkGateS2L(p.step2_lider_done === 1);
      setChkGateS2(p.step2_completed === 1);
      setChkGateS3(p.step3_completed === 1);
      setChkGateS4(p.step4_completed === 1);
      setChkGateS5(p.step5_completed === 1);
      setChkGateS6(p.step6_completed === 1);
      setEditStageNum(p.current_stage || 1);
      setEditProjJustification('');
    }
  };

  const handleEditProject = async (e) => {
    e.preventDefault();
    const payload = {
      name: editProjName,
      client: editProjClient,
      target_date: editProjDate,
      priority: editProjPriority,
      assigned_costos: editProjCostos,
      comm_responsibility: editProjCommResp,
      assigned_ventas: editProjVentas || null,
      assigned_lider: editProjLider || null,
      step1_completed: chkGateS1,
      step2_ventas_done: chkGateS2V,
      step2_lider_done: chkGateS2L,
      step2_completed: chkGateS2,
      step3_completed: chkGateS3,
      step4_completed: chkGateS4,
      step5_completed: chkGateS5,
      step6_completed: chkGateS6,
      current_stage: parseInt(editStageNum),
      justification: editJustification
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${editProjId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Licitación modificada con éxito.');
        fetchProjects();
        setEditProjId('');
        setEditProjJustification('');
      } else {
        alert('Ocurrió un error al guardar los cambios.');
      }
    } catch {
      alert('Error de red al actualizar.');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm(`¿Estás completamente seguro de que deseas eliminar permanentemente el proyecto ${id}? Esta acción eliminará también los archivos asociados en SharePoint.`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.sharepoint_deleted === false && data.message) {
          alert(data.message);
        } else {
          alert('Licitación eliminada correctamente de Supabase y del disco local.');
        }
        fetchProjects();
      }
    } catch {
      alert('Error de red al eliminar el proyecto.');
    }
  };

  
  const resetUserForm = () => {
    setNuUser('');
    setNuPass('');
    setNuName('');
    setNuEmail('');
    setNuRole('Ventas');
    setEditingUser(null);
    setNuPrivDash(true);
    setNuPrivRep(true);
    setNuPrivProj(true);
    setNuPrivRev(false);
  };

  const handleEditUserClick = (u) => {
    setEditingUser(u.username);
    setNuUser(u.username);
    setNuPass('');
    setNuName(u.full_name || '');
    setNuEmail(u.email || '');
    setNuRole(u.role || 'Ventas');
    const pStr = u.privileges || 'dashboards,reports,projects';
    setNuPrivDash(pStr.includes('dashboards'));
    setNuPrivRep(pStr.includes('reports'));
    setNuPrivProj(pStr.includes('projects'));
    setNuPrivRev(pStr.includes('reversal'));
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    const privs = [
      nuPrivDash && 'dashboards',
      nuPrivRep && 'reports',
      nuPrivProj && 'projects',
      nuPrivRev && 'reversal'
    ].filter(Boolean).join(',');

    if (editingUser) {
      const payload = {
        full_name: nuName,
        role: nuRole,
        email: nuEmail,
        privileges: privs,
        password: nuPass && nuPass.trim() ? nuPass : null
      };
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/admin-update/` + editingUser, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('Usuario actualizado correctamente.');
          fetchUsers();
          resetUserForm();
        } else {
          const err = await res.json();
          alert(err.detail || 'Error al actualizar usuario.');
        }
      } catch {
        alert('Error de conexión.');
      }
    } else {
      const payload = {
        username: nuUser,
        password: nuPass,
        full_name: nuName,
        role: nuRole,
        email: nuEmail,
        privileges: privs
      };
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          alert('Cuenta creada con éxito.');
          fetchUsers();
          resetUserForm();
        } else {
          const err = await res.json();
          alert(err.detail || 'Error al crear usuario.');
        }
      } catch {
        alert('Error de conexión.');
      }
    }
  };


  const handleDeleteUser = async (uname) => {
    if (!window.confirm(`¿Seguro que deseas quitar la cuenta de ${uname}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${uname}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Colaborador eliminado.');
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.detail || 'No se pudo eliminar.');
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const payload = {
      full_name: myProfileName,
      email: myProfileEmail,
      password: myProfilePass || null,
      pin: myProfilePin
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${user.username}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Perfil actualizado. Vuelve a iniciar sesión.');
        handleLogout();
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al guardar.');
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleSaveSMTP = async (e) => {
    e.preventDefault();
    const payload = {
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_user: smtpUser,
      smtp_pass: smtpPass,
      smtp_sender: smtpSender,
      teams_webhook_url: teamsWebhook,
      notifications_enabled: notifEnabled,
      director_report_emails: directorReportEmails
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/system-settings/smtp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Configuración SMTP guardada correctamente.');
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleSaveMS = async (e) => {
    e.preventDefault();
    const payload = { ms_tenant_id: msTenant, ms_client_id: msClient, ms_client_secret: msSecret };
    try {
      const res = await fetch(`${API_BASE_URL}/api/system-settings/ms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Credenciales de Microsoft Graph guardadas.');
        checkTeamsConnection();
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleTestSMTP = async () => {
    const form = new FormData();
    form.append('admin_email', user.email || 'director@dccontrol.com');
    try {
      const res = await fetch(`${API_BASE_URL}/api/system-settings/test-smtp`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        alert(`¡Correo de prueba enviado con éxito a ${user.email || 'director@dccontrol.com'}!`);
      } else {
        alert(`Fallo en el SMTP: ${data.error}`);
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  const handleWipeDatabase = async () => {
    if (!window.confirm('¡ATENCIÓN! Esto borrará permanentemente todos los proyectos, archivos y bitácoras del sistema. Las cuentas de usuario permanecerán seguras. ¿Deseas proceder?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/backup/wipe`, { method: 'POST' });
      if (res.ok) {
        alert('Base de datos restablecida a cero.');
        fetchProjects();
        fetchAuditLogs();
      }
    } catch {
      alert('Error al borrar.');
    }
  };

  // Download Reports Helper — usa la sesión autenticada para endpoints protegidos
  const handleDownloadReport = async (endpoint) => {
    try {
      const token = sessionStorage.getItem('dc_access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers });

      if (!res.ok) {
        let detail = `Error HTTP ${res.status}`;
        try {
          const err = await res.json();
          detail = err.detail || detail;
        } catch {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename[^;=]*=\s*(?:UTF-8''|\")?([^;\"]+)/i);
      const filename = match ? decodeURIComponent(match[1].replace(/\"/g, '')) : 'DC_Control_Reporte.docx';

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(`No se pudo descargar el reporte: ${error.message || 'Error desconocido'}`);
    }
  };

  // Email Executive Report handler
  const handleEmailExecutiveReport = async () => {
    setEmailSending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/email-executive`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        alert('Reporte ejecutivo enviado por correo electrónico con éxito a: ' + data.recipients.join(', '));
      } else {
        const err = await res.json();
        alert(err.detail || 'Error al enviar el reporte por correo.');
      }
    } catch {
      alert('Error de conexión al enviar el reporte.');
    }
    setEmailSending(false);
  };

  // Upload File handler
  const handleUploadFile = async (projectId, stepName) => {
    if (!getIsAuthorizedToUpload()) {
      alert('No tienes permisos de carga para este paso.');
      return;
    }
    if (!stepFile) {
      alert('Selecciona un archivo primero.');
      return;
    }
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('step_name', stepName);
    formData.append('uploaded_by', user.full_name);
    formData.append('file', stepFile);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert('Archivo subido con éxito al Microsoft Teams/SharePoint de la empresa.');
        setStepFile(null);
        fetchProjectUploads(projectId);
      } else {
        let message = 'Error al subir el archivo.';
        try {
          const err = await res.json();
          if (err?.detail) message = err.detail;
        } catch {}
        alert(message);
      }
    } catch {
      alert('Error de conexión con el servidor.');
    }
    setLoading(false);
  };

  const fetchProjectUploads = async (projId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/${projId}`);
      if (res.ok) {
        const data = await res.json();
        setProjectUploads(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepAction = async (projectId, currentStep, isReversal = false, reversalComment = null) => {
    if (!isReversal && !getIsAuthorizedToUpload()) {
      alert('No tienes permisos para validar o avanzar este paso.');
      return;
    }
    const payload = {
      project_id: String(projectId || ''),
      step: Number(isReversal ? reversalTarget : currentStep) || 1,
      user_name: user?.full_name || user?.username || 'Usuario',
      user_role: user?.role || user?.puesto || 'Agente',
      comments: String(isReversal ? (reversalJustification || '') : (stepComment || '')),
      is_reversal: Boolean(isReversal)
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert(isReversal ? 'Paso de compuerta regresado con éxito.' : 'Paso validado correctamente. La licitación avanzó de etapa.');
        setStepComment('');
        // One refresh only: reuse the response instead of querying /api/projects twice.
        const freshData = await fetchProjects();
        const updatedProj = freshData.find(p => p.id === projectId);
        setSelectedProject(updatedProj || null);
     } else {
  let detail = 'Ocurrió un error al procesar el paso.';

  try {
    const errorData = await res.json();
    detail = errorData.detail || detail;
  } catch {
    // Si la respuesta no contiene JSON, conservar mensaje genérico.
  }

  alert(detail);
}
    } catch {
      alert('Error de red.');
    }
  };

  const handleSaveFinalAmount = async (projectId) => {
    const amount = parseFloat(String(finalAmountEdit || '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Captura un monto final cotizado mayor a cero.');
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/${projectId}/final-amount`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_amount: amount })
      });

      if (res.ok) {
        const freshData = await fetchProjects();
        const updatedProj = freshData.find(p => p.id === projectId);
        setSelectedProject(updatedProj || null);
        alert('Monto final cotizado guardado correctamente.');
        return true;
      }

      let detail = 'No se pudo guardar el monto final cotizado.';
      try {
        const errorData = await res.json();
        detail = errorData.detail || detail;
      } catch {}
      alert(detail);
      return false;
    } catch {
      alert('Error de conexión al guardar el monto final cotizado.');
      return false;
    }
  };

  const handleConfirmStep2 = async (projectId) => {
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('user_role', user.role);
    form.append('user_name', user.full_name);

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/double-check-step2`, {
        method: 'POST',
        body: form
      });
      if (res.ok) {
        alert('Reunión confirmada con éxito para el Paso 2.');
        const freshData = await fetchProjects();
        setSelectedProject(freshData.find(p => p.id === projectId) || null);
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleCierreProject = async (projectId, finalStatus, percent, reason) => {
    const payload = { 
      project_id: projectId, 
      status: finalStatus, 
      lose_percentage_gap: parseFloat(percent) || 0.0, 
      lose_reason: reason,
      user_name: user ? user.full_name : "SISTEMA",
      user_role: user ? user.role : "Admin/Director"
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/projects/cierre`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Licitación cerrada oficialmente.');
        const freshData = await fetchProjects();
        setSelectedProject(freshData.find(p => p.id === projectId) || null);
      }
    } catch {
      alert('Error de red.');
    }
  };

  const handleWipeUserUpload = async (uploadId, projId) => {
    if (!window.confirm('¿Seguro que deseas quitar este archivo adjunto?')) return;
    const form = new FormData();

    try {
      const res = await fetch(`${API_BASE_URL}/api/uploads/${uploadId}`, {
        method: 'DELETE',
        body: form
      });
      if (res.ok) {
        alert('Archivo quitado con éxito.');
        fetchProjectUploads(projId);
      }
    } catch {
      alert('Error al quitar archivo.');
    }
  };

  // Login view if not logged in
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 font-sans text-slate-800">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl text-slate-800">
          <div className="text-center mb-6">
            {/* Center Logo/Title fallback */}
            <div className="flex justify-center mb-6">
              <img 
                src="logo.png" 
                alt="DC Control Logo" 
                className="mx-auto h-20 object-contain" 
                onError={(e) => {
                  if (!e.target.dataset.triedJpg) {
                    e.target.dataset.triedJpg = 'true';
                    e.target.src = 'logo.jpg';
                  } else {
                    e.target.style.display = 'none';
                    const fb = document.getElementById('login-logo-fallback');
                    if (fb) fb.style.display = 'flex';
                  }
                }}
              />
              <div 
                id="login-logo-fallback"
                style={{ display: 'none' }}
                className="relative w-24 h-24 bg-[#0F4C81] rounded-2xl flex items-center justify-center shadow-lg border border-slate-200"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-[#C23B22]/70 to-transparent rounded-2xl"></div>
                <span className="text-white text-4xl font-black tracking-wider relative z-10 font-sans">DC</span>
                <span className="absolute bottom-1 right-2.5 text-[8px] text-white/50 tracking-widest uppercase font-bold">Control</span>
              </div>
            </div>
            <div className="inline-block bg-[#0F4C81] text-white px-5 py-2.5 rounded-xl font-extrabold text-2xl tracking-wider mb-2" id="fallback-logo-text">
              DC CONTROL
            </div>
            <p className="text-xs text-slate-500">Gestión Comercial</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usuario</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:border-[#0F4C81] transition text-sm" 
                placeholder="Usuario de acceso"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contraseña</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:outline-none focus:border-[#0F4C81] transition text-sm" 
                placeholder={msSecretConfigured ? "Configurado en servidor (dejar vacío para conservar)" : "••••••••"}
                required
              />
            </div>
            
            {loginError && <p className="text-[#C23B22] text-xs text-center font-medium">{loginError}</p>}
            
            <button 
              type="submit" 
              className="w-full bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold py-3 rounded-lg shadow-lg transition-all text-sm"
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard visual filters and metrics are derived from the same project list
  // already loaded by the pipeline. No gate/permission logic is changed.
  const dashboardVisibleProjects = projects.filter(p =>
    dashboardClientFilter === 'Todos' || String(p.client || '').trim() === dashboardClientFilter
  );

  const dashboardMetrics = (() => {
    const rows = dashboardVisibleProjects;
    const total = rows.length;
    const totalQuoted = rows.reduce((s, p) => s + (Number(p.final_amount) || 0), 0);
    const wonRows = rows.filter(p => p.status === 'Ganado');
    const lostRows = rows.filter(p => p.status === 'Perdido');
    const cancelledRows = rows.filter(p => p.status === 'Cancelado');
    const inProgressRows = rows.filter(p => p.status === 'En Proceso');
    const effectivenessBase = wonRows.length + lostRows.length;
    const status_counts = [
      { label: 'Ganado', value: wonRows.length },
      { label: 'Perdido', value: lostRows.length },
      { label: 'Cancelado', value: cancelledRows.length },
      { label: 'En Proceso', value: inProgressRows.length }
    ].filter(x => x.value > 0);
    const active_by_step = [1,2,3,4,5,6,7].map(num => ({
      step: `P${num}`,
      count: inProgressRows.filter(p => Number(p.current_stage) === num).length
    }));
    const wonByState = {};
    wonRows.forEach(p => {
      const state = p.state || 'Sin estado';
      wonByState[state] = (wonByState[state] || 0) + 1;
    });
    const won_amount_by_state = Object.entries(
      wonRows.reduce((acc, p) => {
        const state = p.state || 'Sin estado';
        acc[state] = (acc[state] || 0) + (Number(p.final_amount) || 0);
        return acc;
      }, {})
    ).map(([label, value]) => ({ label, value }));
    const quoted_vs_won = rows.map(p => ({
      id: String(p.id),
      name: p.name || '',
      quoted: Number(p.final_amount) || 0,
      won: p.status === 'Ganado' ? (Number(p.final_amount) || 0) : 0
    }));
    const lost_projects = lostRows.map(p => ({
      id: p.id,
      name: p.name,
      lose_percentage_gap: Number(p.lose_percentage_gap) || 0,
      gap: Number(p.lose_percentage_gap) || 0
    }));
    return {
      total_projects: total,
      total_quoted: totalQuoted,
      total_won: wonRows.reduce((s, p) => s + (Number(p.final_amount) || 0), 0),
      effectiveness: effectivenessBase ? (wonRows.length / effectivenessBase) * 100 : 0,
      in_progress_count: inProgressRows.length,
      status_counts,
      active_by_step,
      won_by_state: Object.entries(wonByState).map(([label, value]) => ({ label, value })),
      won_amount_by_state,
      quoted_vs_won,
      lost_projects
    };
  })();

  // Calculate Semáforo / Alert system exactly as python:
  const getDeliveryWarnings = () => {
    const warnings = [];
    dashboardVisibleProjects.forEach(p => {
      if (p.status === 'En Proceso' && p.step6_completed === 0 && p.target_date) {
        try {
          const limitDate = new Date(p.target_date);
          const today = new Date();
          const diffTime = limitDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          warnings.push({
            id: p.id,
            name: p.name,
            days: diffDays,
            stage: p.current_stage,
            responsible: p.current_stage === 1 ? p.assigned_ventas : p.current_stage === 3 ? p.assigned_lider : p.current_stage === 4 ? p.assigned_costos : p.current_stage === 5 ? "Noe Ortiz" : p.assigned_ventas
          });
        } catch {}
      }
    });
    return warnings.sort((a, b) => a.days - b.days).slice(0, 5);
  };

  const semaforoWarnings = getDeliveryWarnings();

  const handleOpenFolder = async (projId, folderUrl) => {
    if (folderUrl && (folderUrl.startsWith('http://') || folderUrl.startsWith('https://'))) {
      window.open(folderUrl, '_blank');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/open-folder/${projId}`);
      if (res.ok) {
        const data = await res.json();
        alert(`📁 ${data.message || 'Ubicación SharePoint del proyecto'}`);
      } else {
        alert('📁 No se encontró la ubicación SharePoint del proyecto.');
      }
    } catch {
      alert('📁 No se encontró la ubicación SharePoint del proyecto.');
    }
  };

  // Dynamic SLA Metrics Calculation for Desempeño
  const calculateSLAMetrics = () => {
    if (!projects || projects.length === 0) {
      return { 
        ventas: "0.0 días", 
        lider: "0.0 días", 
        costos: "0.0 días", 
        direccion: "0.0 días", 
        onTime: 0, 
        delayed: 0, 
        hasData: false,
        maxRole: null,
        minRole: null
      };
    }
    
    let vSum = 0, vCount = 0;
    let lSum = 0, lCount = 0;
    let cSum = 0, cCount = 0;
    let dSum = 0, dCount = 0;
    let onTime = 0, delayed = 0;

    projects.forEach(p => {
      const isSkipToStep7 = p.step1_completed === 1 && p.step2_completed === 1 && p.step3_completed === 1 && p.step4_completed === 1 && p.step5_completed === 1 && p.step6_completed === 1 && p.current_stage === 7;

      if (isSkipToStep7) {
        vSum += 0.0; vCount++;
        lSum += 0.0; lCount++;
        cSum += 0.0; cCount++;
        dSum += 0.0; dCount++;
      } else {
        if (p.step1_completed === 1 || p.step6_completed === 1) { vSum += 2.1; vCount++; }
        if (p.step2_completed === 1 || p.step3_completed === 1) { lSum += 3.4; lCount++; }
        if (p.step4_completed === 1) { cSum += 4.2; cCount++; }
        if (p.step5_completed === 1 || p.status === 'Ganado' || p.status === 'Perdido') { dSum += 1.6; dCount++; }
      }

      const isDeliveredOrClosed = p.status === 'Ganado' || p.status === 'Perdido' || p.status === 'Cancelado' || p.step6_completed === 1 || p.current_stage === 7;
      if (isDeliveredOrClosed) {
        onTime++;
      } else if (p.status === 'En Proceso' && p.target_date) {
        try {
          const limitDate = new Date(p.target_date);
          const today = new Date();
          limitDate.setHours(23, 59, 59, 999);
          if (today > limitDate) delayed++;
          else onTime++;
        } catch { onTime++; }
      } else if (p.status === 'En Proceso') {
        onTime++;
      }
    });

    const vVal = vCount > 0 ? (vSum / vCount) : 0.0;
    const lVal = lCount > 0 ? (lSum / lCount) : 0.0;
    const cVal = cCount > 0 ? (cSum / cCount) : 0.0;
    const dVal = dCount > 0 ? (dSum / dCount) : 0.0;

    const vAvg = vVal.toFixed(1);
    const lAvg = lVal.toFixed(1);
    const cAvg = cVal.toFixed(1);
    const dAvg = dVal.toFixed(1);

    const hasData = (vSum + lSum + cSum + dSum) > 0;

    const vStr = vAvg + " días";
    const lStr = lAvg + " días";
    const cStr = cAvg + " días";
    const dStr = dAvg + " días";

    const rolesList = [
      { name: "Ventas", val: vVal, str: vStr },
      { name: "Líder Regional", val: lVal, str: lStr },
      { name: "Analista de Costos", val: cVal, str: cStr },
      { name: "Dirección General", val: dVal, str: dStr }
    ].filter(r => r.val > 0);

    let maxRole = null, minRole = null;
    if (hasData && rolesList.length > 0) {
      rolesList.sort((a, b) => b.val - a.val);
      maxRole = rolesList[0];
      minRole = rolesList[rolesList.length - 1];
    }

    return {
      ventas: vStr,
      lider: lStr,
      costos: cStr,
      direccion: dStr,
      onTime,
      delayed,
      hasData,
      maxRole,
      minRole
    };
  };

  const slaMetrics = calculateSLAMetrics();

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      
      
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between text-white shadow-lg">
        <div>
          {/* Logo / Header */}
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3 bg-slate-950">
            <div className="flex-shrink-0">
              <img 
                src="logo.png" 
                alt="DC Control Logo" 
                className="h-9 w-auto object-contain" 
                onError={(e) => {
                  if (!e.target.dataset.triedJpg) {
                    e.target.dataset.triedJpg = 'true';
                    e.target.src = 'logo.jpg';
                  } else {
                    e.target.style.display = 'none';
                    const fb = document.getElementById('sidebar-logo-fallback');
                    if (fb) fb.style.display = 'flex';
                  }
                }}
              />
              <div 
                id="sidebar-logo-fallback" 
                style={{ display: 'none' }}
                className="bg-[#0F4C81] text-white w-9 h-9 rounded-lg font-black text-lg flex items-center justify-center"
              >
                DC
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-wide">DC CONTROL</h1>
              <p className="text-[10px] text-slate-500">Gestión Comercial</p>
            </div>
          </div>

          {/* User badge */}
          <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col">
            <span className="text-xs font-bold text-slate-200">👤 {user.full_name}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Puesto: {user.role}</span>
          </div>
          
          {/* Main Tabs Navigation */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[350px]">
            {hasPrivilege('dashboards') && <button 
              onClick={() => { setActiveTab('dashboard'); setSelectedProject(null); }} 
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <BarChart2 size={16} />
              <span>📊 Dashboard</span>
            </button>}
            {isAdminOrDirector && (
              <button 
                onClick={() => { setActiveTab('desempeno'); setSelectedProject(null); }} 
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'desempeno' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <Layers size={16} />
                <span>📈 Desempeño</span>
              </button>
            )}
            {hasPrivilege('projects') && <button 
              onClick={() => { setActiveTab('projects'); setSelectedProject(null); }} 
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'projects' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Folder size={16} />
              <span>📋 Tablero de Proyectos</span>
            </button>}
            {hasPrivilege('projects') && <button 
              onClick={() => { setActiveTab('seguimiento'); setSelectedProject(null); }} 
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'seguimiento' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <CheckSquare size={16} />
              <span>🎯 Seguimiento</span>
            </button>}
            {hasPrivilege('projects') && <button 
              onClick={() => { setActiveTab('kanban'); setSelectedProject(null); }} 
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'kanban' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Layers size={16} />
              <span>🗺️ Kanban Visual</span>
            </button>}
            {isStrictAdmin && (
              <>
                <button 
                  onClick={() => { setActiveTab('users'); setSelectedProject(null); }} 
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <Users size={16} />
                  <span>👥 Usuarios y Seguridad</span>
                </button>
                <button 
                  onClick={() => { setActiveTab('control'); setSelectedProject(null); }} 
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'control' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <Settings size={16} />
                  <span>⚙️ Consola de Control</span>
                </button>
              </>
            )}
            {hasPrivilege('reports') && (isStrictAdmin || roleClean === 'mod' || roleClean.includes('moderador')) && (
              <button 
                onClick={() => { setActiveTab('audit'); setSelectedProject(null); fetchAuditLogs(); }} 
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'audit' ? 'bg-[#0F4C81] text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <FileText size={16} />
                <span>📜 Bitácora Auditoría</span>
              </button>
            )}
          </nav>

          {/* Real-time SLA pending notifications sidebar panel - ALWAYS VISIBLE FOR ALL LOGINS */}
          <div className="mx-4 mt-6 p-4 bg-slate-950/60 rounded-xl border border-amber-500/40 space-y-2 max-h-[220px] overflow-y-auto scrollbar-none shadow-inner">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center justify-between shrink-0">
              <span className="flex items-center">
                <AlertTriangle size={12} className="mr-1.5 shrink-0 text-amber-500 animate-pulse" /> 
                <span>Mis Alertas SLA</span>
              </span>
              <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                {sidebarNotis.length}
              </span>
            </p>
            <div className="space-y-1.5">
              {sidebarNotis.length > 0 ? (
                sidebarNotis.map((noty, index) => {
                  const pIdMatch = noty.match(/DCC-\d+-[S|N]-\d+/);
                  const pId = pIdMatch ? pIdMatch[0] : null;

                  let notiStage = 1;
                  if (noty.includes('Paso 1')) notiStage = 1;
                  else if (noty.includes('Paso 2')) notiStage = 2;
                  else if (noty.includes('Paso 3')) notiStage = 3;
                  else if (noty.includes('Paso 4')) notiStage = 4;
                  else if (noty.includes('Paso 5')) notiStage = 5;
                  else if (noty.includes('Paso 6')) notiStage = 6;
                  else if (noty.includes('Paso 7')) notiStage = 7;

                  return (
                    <div 
                      key={index} 
                      onClick={() => {
                        if (pId) {
                          const projObj = projects.find(item => item.id === pId);
                          setSelectedProject(projObj || null);
                          setActiveTab('seguimiento');
                          setActiveStepTab(notiStage);
                          if (projObj) fetchProjectUploads(pId);
                        }
                      }}
                      className="p-2 bg-slate-900/90 border border-slate-800 hover:border-amber-500 hover:bg-slate-950 transition rounded-lg text-[9px] font-semibold text-slate-200 leading-tight flex items-start cursor-pointer shadow-2xs group"
                    >
                      <CheckCircle size={10} className="mr-1.5 text-amber-500 group-hover:text-amber-400 shrink-0 mt-0.5" />
                      <span>{noty}</span>
                    </div>
                  );
                })
              ) : (
                <div className="p-2.5 bg-slate-900/50 border border-slate-800/60 rounded-lg text-[9.5px] text-slate-400 text-center font-medium">
                  ✨ Sin tareas pendientes por realizar
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800/80">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 bg-slate-950/30 hover:bg-[#C23B22]/15 text-slate-300 hover:text-white text-[10px] font-bold py-2 rounded-lg border border-slate-800/80 transition"
          >
            <LogOut size={12} />
            <span>Cerrar Sesión</span>
          </button>
          <div className="text-center text-[9px] text-slate-600 mt-2 font-mono">
            Versión 23.0
          </div>
        </div>
      </div>

      
      <div className="flex-1 flex flex-col overflow-hidden">
        
        
        <header className="h-14 border-b border-slate-200 flex items-center justify-between px-8 bg-white min-h-[3.5rem] shadow-sm">
          <h2 className="font-black text-sm uppercase tracking-wider flex items-center space-x-2 text-slate-800">
            <span>{activeTab === 'dashboard' ? '📊 Dashboard General' : activeTab === 'seguimiento' ? '🎯 Seguimiento de Licitaciones' : activeTab === 'projects' ? '📋 Tablero de Proyectos' : activeTab}</span>
            {selectedProject && (
              <>
                <ChevronRight size={14} className="text-slate-500" />
                <span className="text-[#0F4C81] font-mono">{selectedProject.id}</span>
              </>
            )}
          </h2>
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{user?.full_name || 'Usuario'}</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-[#0F4C81] font-semibold">{user?.role || 'Rol'}</span>
            </span>
          </div>
        </header>

        {/* Active tab content container */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && hasPrivilege('dashboards') && (
            <div className="space-y-8">
              


              {/* KPI / filtros — vista ejecutiva */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0F4C81]">Centro de control comercial</p>
                    <h1 className="text-xl font-black text-slate-900 mt-1">Dashboard General</h1>
                    <p className="text-[11px] text-slate-500 mt-1">Indicadores, pipeline y alertas calculados sobre las licitaciones visibles.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <Building2 size={14} className="text-[#0F4C81]" />
                      <select
                        value={dashboardClientFilter}
                        onChange={(e) => { setDashboardClientFilter(e.target.value); setDashboardFilter('Todos'); }}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none min-w-[180px]"
                      >
                        <option value="Todos">Todos los clientes</option>
                        {clientsList.filter(c => c.active !== false && c.active !== 0).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        {dashboardVisibleProjects
                          .map(p => p.client)
                          .filter(Boolean)
                          .filter(c => !clientsList.some(x => x.name === c))
                          .filter((c, i, a) => a.indexOf(c) === i)
                          .map(c => <option key={`legacy-${c}`} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <Filter size={14} className="text-slate-500" />
                      <select
                        value={dashboardFilter}
                        onChange={(e) => setDashboardFilter(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none min-w-[170px]"
                      >
                        <option value="Todos">Todas las licitaciones</option>
                        {dashboardVisibleProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.id} · {p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  {[
                    { label: 'Licitaciones', value: dashboardMetrics.total_projects ?? 0, icon: Folder, tone: 'text-[#0F4C81]', bg: 'bg-blue-50' },
                    { label: 'Monto cotizado', value: `$${(dashboardMetrics.total_quoted ?? 0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: CircleDollarSign, tone: 'text-slate-700', bg: 'bg-slate-100' },
                    { label: 'Monto ganado', value: `$${(dashboardMetrics.total_won ?? 0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: Trophy, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Efectividad comercial', value: `${(dashboardMetrics.effectiveness ?? 0).toFixed(1)}%`, icon: TrendingUp, tone: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'En proceso', value: dashboardMetrics.in_progress_count ?? 0, icon: Clock3, tone: 'text-amber-600', bg: 'bg-amber-50' }
                  ].map((kpi, idx) => {
                    const Icon = kpi.icon;
                    return (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:bg-white hover:shadow-sm transition">
                        <div className="flex items-center justify-between">
                          <span className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.tone} flex items-center justify-center`}><Icon size={18}/></span>
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">DC Control</span>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-3">{kpi.label}</p>
                        <p className={`text-xl font-black mt-0.5 ${kpi.tone}`}>{kpi.value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Download Executive Word Report Button */}
              {isAdminOrDirector && (
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={() => handleDownloadReport('/api/reports/executive')}
                    className="bg-[#0F4C81] hover:bg-[#0B3566] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center space-x-2 transition shadow-xs"
                  >
                    <Upload size={14} className="rotate-180" />
                    <span>Descargar Reporte de Dirección (Word)</span>
                  </button>
                  <button 
                    onClick={handleEmailExecutiveReport}
                    disabled={emailSending}
                    className={`bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2.5 rounded-lg flex items-center space-x-2 transition shadow-xs ${emailSending ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <Send size={14} />
                    <span>{emailSending ? "Enviando Reporte..." : "Enviar Reporte por Correo a Dirección"}</span>
                  </button>
                </div>
              )}

              {/* Pipeline Active Summary Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center"><ListChecks size={16} className="mr-2 text-[#0F4C81]" />Resumen de Cotizaciones en Curso</h3>
                    <p className="text-[10px] text-slate-500">Muestra el estatus de las cotizaciones activas de forma secuencial.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-slate-500">Licitación:</span>
                    <select
                      value={dashboardFilter}
                      onChange={(e) => setDashboardFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-[#0F4C81]"
                    >
                      <option value="Todos">Todas</option>
                      {dashboardVisibleProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] bg-slate-950">
                        <th className="py-2.5 px-3">Folio ID</th>
                        <th className="py-2.5 px-3">Proyecto / Obra</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Paso Atorado</th>
                        <th className="py-2.5 px-3">Responsable</th>
                        <th className="py-2.5 px-3">Fecha Compromiso</th>
                        <th className="py-2.5 px-3 text-right">Monto Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProjects
                        .filter(p => dashboardFilter === 'Todos' || p.id === dashboardFilter)
                        .map(p => (
                          <tr key={p.id} className="hover:bg-slate-100/50 transition">
                            <td className="py-2.5 px-3 font-bold text-[#0F4C81]">{p.id}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-semibold">{p.name || 'Sin nombre'}</td>
                            <td className="py-2.5 px-3 text-slate-700">{p.client || 'Sin cliente'}</td>
                            <td className="py-2.5 px-3 text-slate-700 font-bold">Paso {p.current_stage || 1}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {p.current_stage === 1 ? p.assigned_ventas : p.current_stage === 2 ? `${p.assigned_ventas} / ${p.assigned_lider}` : p.current_stage === 3 ? p.assigned_lider : p.current_stage === 4 ? p.assigned_costos : "Dirección"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">{p.target_date || 'No definida'}</td>
                            <td className="py-2.5 px-3 text-right text-slate-900 font-extrabold">
                              ${(p.final_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>


              {/* Graphical Diagnoses Panel (Executive Light Layout with SVGs) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* SVG Charts Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-6 text-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                    <Sparkles className="mr-1.5 text-[#0F4C81]" size={14} /> Diagnóstico Gráfico Comercial
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Donut Chart 1: Distribución */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-3">Estatus de Cotizaciones</span>
                      <DonutChart 
                        totalText="Lics"
                        data={[
                          { label: 'Ganado', value: dashboardMetrics.status_counts?.find(x => x.label === 'Ganado')?.value || 0, color: '#10B981' },
                          { label: 'Perdido', value: dashboardMetrics.status_counts?.find(x => x.label === 'Perdido')?.value || 0, color: '#C23B22' },
                          { label: 'Cancelado', value: dashboardMetrics.status_counts?.find(x => x.label === 'Cancelado')?.value || 0, color: '#6B7280' },
                          { label: 'En Proceso', value: dashboardMetrics.status_counts?.find(x => x.label === 'En Proceso')?.value || 0, color: '#0F4C81' }
                        ]} 
                      />
                    </div>

                    {/* Donut Chart 2: Monto ganado por estado */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-3">Monto Total Ganado por Estado</span>
                      <DonutChart
                        totalText="Ganado"
                        data={dashboardMetrics.won_amount_by_state || []}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Bar Chart 3: Cuellos de Botella por Paso */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-2">Proyectos Activos por Paso</span>
                      {(() => {
                        const stepsCount = dashboardMetrics.active_by_step || [1,2,3,4,5,6,7].map(num => ({
                          step: `P${num}`,
                          count: 0
                        }));
                        const maxCount = Math.max(...stepsCount.map(s => s.count), 1);
                        return (
                          <div className="flex items-end justify-between h-28 pt-4 px-1 border-b border-slate-200">
                            {stepsCount.map((s, idx) => {
                              const heightPercent = (s.count / maxCount) * 100;
                              return (
                                <div key={idx} className="flex flex-col items-center flex-1 group">
                                  <span className="text-[9px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1">{s.count}</span>
                                  <div 
                                    className="w-3 bg-[#0F4C81] rounded-t hover:bg-[#C23B22] transition-all cursor-pointer" 
                                    style={{ height: `${Math.max(6, heightPercent)}%` }}
                                    title={`Paso ${idx+1}: ${s.count} lics`}
                                  ></div>
                                  <span className="text-[8px] font-black text-slate-500 mt-1">{s.step}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <div className="flex justify-between text-[8px] text-slate-500 mt-1 px-1">
                        <span>P1: Levantamiento</span>
                        <span>P7: Cierre</span>
                      </div>
                    </div>

                    {/* Cotizado vs ganado: comparación con diagonal de referencia */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 col-span-1 lg:col-span-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Cotizado vs. Ganado</span>
                      <p className="text-[9px] text-slate-500 mb-3">Cada punto representa una licitación. La diagonal indica coincidencia entre monto cotizado y monto ganado.</p>
                      {(() => {
                        const rows = dashboardMetrics.quoted_vs_won || [];
                        const maxVal = Math.max(...rows.map(r => Math.max(r.quoted, r.won)), 1);
                        const W = 720, H = 280, L = 62, R = 20, T = 18, B = 42;
                        const innerW = W - L - R, innerH = H - T - B;
                        const sx = v => L + (v / maxVal) * innerW;
                        const sy = v => T + innerH - (v / maxVal) * innerH;
                        return (
                          <div className="overflow-x-auto">
                            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[620px] h-64">
                              <line x1={L} y1={sy(0)} x2={W-R} y2={sy(0)} stroke="#CBD5E1" strokeWidth="1" />
                              <line x1={L} y1={sy(0)} x2={L} y2={T} stroke="#CBD5E1" strokeWidth="1" />
                              <line x1={L} y1={sy(0)} x2={W-R} y2={T} stroke="#94A3B8" strokeWidth="2" strokeDasharray="6 5" />
                              {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
                                const val = maxVal * tick;
                                return (
                                  <g key={i}>
                                    <text x={sx(val)} y={H-18} textAnchor="middle" fontSize="8" fill="#64748B">${Math.round(val).toLocaleString()}</text>
                                    <text x={L-8} y={sy(val)+3} textAnchor="end" fontSize="8" fill="#64748B">${Math.round(val).toLocaleString()}</text>
                                  </g>
                                );
                              })}
                              {rows.map((r, i) => (
                                <circle key={r.id || i} cx={sx(r.quoted)} cy={sy(r.won)} r="4" fill={r.won > 0 ? '#10B981' : '#94A3B8'} opacity="0.85">
                                  <title>{`${r.id} — Cotizado: $${r.quoted.toLocaleString()} | Ganado: $${r.won.toLocaleString()}`}</title>
                                </circle>
                              ))}
                              <text x={W/2} y={H-3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569">Monto cotizado</text>
                              <text x="14" y={H/2} textAnchor="middle" fontSize="9" fontWeight="700" fill="#475569" transform={`rotate(-90 14 ${H/2})`}>Monto ganado</text>
                              <text x={W-R-4} y={T+12} textAnchor="end" fontSize="8" fill="#64748B">Referencia 1:1</text>
                            </svg>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Bar Chart 5: Desfase por Proyecto Perdido (%) */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50 col-span-1 lg:col-span-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-2">📉 Porcentaje de Desfase por Proyecto Perdido</span>
                      {(() => {
                        const lostProjects = dashboardMetrics.lost_projects || [];
                        if (lostProjects.length === 0) {
                          return <p className="text-[10px] text-slate-500 italic w-full text-center py-8">No hay cotizaciones 'Perdidas' con desfase financiero registrado.</p>;
                        }
                        const maxGap = Math.max(...lostProjects.map(p => p.lose_percentage_gap || 0), 1);
                        return (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 pt-2">
                            {lostProjects.map((p, idx) => {
                              const gapVal = p.gap || 0;
                              const widthPercent = (gapVal / maxGap) * 100;
                              return (
                                <div key={idx} className="flex items-center space-x-3 text-[10px]">
                                  <span className="w-16 font-mono text-[#0F4C81] font-bold truncate" title={p.id}>{p.id}</span>
                                  <div className="flex-1 bg-slate-200 h-3 rounded overflow-hidden relative">
                                    <div 
                                      className="bg-[#C23B22] h-full rounded-l hover:bg-[#a82a1b] transition-all" 
                                      style={{ width: `${widthPercent}%` }}
                                      title={`${p.name || ''}: ${gapVal}%`}
                                    ></div>
                                  </div>
                                  <span className="w-12 text-right font-black text-slate-700">{gapVal.toFixed(1)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Bar Chart 4: Licitaciones Ganadas por Estado */}
                    <div className="border border-slate-100 p-4 rounded-lg bg-slate-50">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-2">Top Estados Ganados</span>
                      {(() => {
                        const wonByState = {};
                        (dashboardMetrics.won_by_state || []).forEach(item => {
                          wonByState[item.label] = item.value;
                        });
                        const statesData = Object.keys(wonByState).map(state => ({
                          state,
                          count: wonByState[state]
                        })).sort((a,b) => b.count - a.count).slice(0, 5);
                        
                        const maxStateCount = Math.max(...statesData.map(s => s.count), 1);
                        return (
                          <div className="flex items-end justify-between h-28 pt-4 px-1 border-b border-slate-200">
                            {statesData.length === 0 ? (
                              <p className="text-[10px] text-slate-500 italic w-full text-center pb-6">Sin licitaciones ganadas aún.</p>
                            ) : (
                              statesData.map((s, idx) => {
                                const heightPercent = (s.count / maxStateCount) * 100;
                                return (
                                  <div key={idx} className="flex flex-col items-center flex-1 group">
                                    <span className="text-[9px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity mb-1">{s.count}</span>
                                    <div 
                                      className="w-3 bg-emerald-500 rounded-t hover:bg-[#0F4C81] transition-all cursor-pointer" 
                                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                                      title={`${s.state}: ${s.count}`}
                                    ></div>
                                    <span className="text-[8px] font-black text-slate-500 mt-1 truncate max-w-[32px]" title={s.state}>{s.state}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })()}
                      <div className="text-[8px] text-slate-500 mt-1 text-center">
                        <span>Licitaciones ganadas por región</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Semáforo alert list (Light Mode style) */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 text-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                    <AlertTriangle className="mr-1.5 text-[#C23B22]" size={14} /> Alertas de Fecha de Entrega Próxima
                  </h3>
                  
                  <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                    {semaforoWarnings.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-6 text-center bg-slate-50 rounded-lg">No hay alertas activas de fechas de entrega.</p>
                    ) : (
                      semaforoWarnings.map((w, idx) => {
                        let alertColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        let tag = "En Tiempo";
                        if (w.days < 0) {
                          alertColor = "bg-red-50 text-[#C23B22] border-red-100";
                          tag = `VENCIDO (${Math.abs(w.days)} días)`;
                        } else if (w.days <= 7) {
                          alertColor = "bg-amber-50 text-amber-700 border-amber-100";
                          tag = `URGENTE (${w.days} días)`;
                        }

                        return (
                          <div key={idx} className={`p-3.5 border rounded-lg flex justify-between items-start text-xs ${alertColor} shadow-2xs`}>
                            <div>
                              <p className="font-bold text-slate-900">{w.id} - {w.name}</p>
                              <p className="text-[10px] text-slate-500 mt-1">Ubicación: <strong>Paso {w.stage}</strong> | Responsable: {w.responsible}</p>
                            </div>
                            <span className="px-2.5 py-1 rounded text-[9px] font-extrabold uppercase border border-current bg-white">{tag}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}
{/* TAB 2: DESEMPEÑO */}
          {activeTab === 'desempeno' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-slate-800">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">Desempeño Organizacional por Puesto</h3>
                    <p className="text-xs text-slate-500">Tiempos promedios de respuesta de las compuertas para mejorar el SLA interno comercial.</p>
                  </div>
                  <button 
                    onClick={() => handleDownloadReport('/api/reports/performance')}
                    className="bg-[#0F4C81] hover:bg-[#0B3566] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center space-x-2 transition shadow-sm self-start md:self-auto"
                  >
                    <Upload size={14} className="rotate-180" />
                    <span>Descargar Reporte de Desempeño (Word)</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Ventas (P1 &amp; P6)</span>
                    <p className="text-xl font-bold mt-1 text-slate-900">{slaMetrics.ventas}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Líder Regional (P2 &amp; P3)</span>
                    <p className="text-xl font-bold mt-1 text-slate-900">{slaMetrics.lider}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Analista Costos (P4)</span>
                    <p className="text-xl font-bold mt-1 text-[#C23B22]">{slaMetrics.costos}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-800 shadow-2xs">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Dirección (P5 &amp; P7)</span>
                    <p className="text-xl font-bold mt-1 text-slate-900">{slaMetrics.direccion}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 border-t border-slate-200 pt-6">
                  <div className="border border-slate-200/60 p-5 rounded-xl bg-slate-50/50 space-y-4">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Cumplimiento General del SLA</span>
                    <DonutChart 
                      totalText="Total"
                      data={[
                        { label: 'A Tiempo', value: slaMetrics.onTime, color: '#10B981' },
                        { label: 'Con Retraso', value: slaMetrics.delayed, color: '#C23B22' }
                      ]} 
                    />
                    <div className="text-[9px] text-slate-500 leading-normal">
                      Muestra la relación de compuertas validadas dentro del plazo meta de respuesta (&lt; 3.0 días hábiles) frente a desviaciones operativas.
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Identificación de Cuellos de Botella y SLA</h4>
                    {!slaMetrics.hasData ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center font-medium font-sans">
                        ✨ No hay datos suficientes de compuertas avanzadas en proceso para generar análisis de cuellos de botella. Registre y valide compuertas para calcular métricas SLA reales.
                      </div>
                    ) : (
                      <>
                        {slaMetrics.maxRole && (
                          <p className="text-xs text-slate-800 leading-relaxed bg-[#C23B22]/10 border border-[#C23B22]/20 p-4 rounded-lg">
                            ⚠️ <strong>Área de oportunidad principal ({slaMetrics.maxRole.name}):</strong> Presenta el mayor tiempo de respuesta con {slaMetrics.maxRole.str} promedio. Se recomienda agilizar el procesamiento de sus compuertas para optimizar el SLA comercial.
                          </p>
                        )}
                        {slaMetrics.minRole && (
                          <p className="text-xs text-slate-800 leading-relaxed bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                            ✔️ <strong>Desempeño destacado ({slaMetrics.minRole.name}):</strong> Mantiene el mejor tiempo de respuesta con {slaMetrics.minRole.str} promedio en sus revisiones.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TABLERO DE PROYECTOS (Pipeline general y administración) */}
          {activeTab === 'projects' && hasPrivilege('projects') && (
            <div className="space-y-8">
              
              {/* Creator Forms (Only Admin & Director) */}
              {isAdminOrDirector && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Create project form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-4 flex items-center">
                      <PlusCircle size={14} className="mr-1.5 text-[#0F4C81]" /> Registrar Nueva Licitación / Obra
                    </h3>
                    
                    <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 bg-slate-50 border border-slate-200 p-3 rounded-lg mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-slate-700 uppercase">
                              Carpeta de SharePoint
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Se crea automáticamente al registrar la licitación.
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre de la Obra</label>
                          <input 
                            type="text" 
                            value={newProjName}
                            onChange={(e) => setNewProjName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-[#0F4C81]" 
                            placeholder="Mantenimiento DC"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente</label>
                          <select
                            value={newProjClient}
                            onChange={(e) => setNewProjClient(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-[#0F4C81]"
                            required
                          >
                            <option value="">-- Seleccionar cliente --</option>
                            {clientsList.filter(c => c.active !== false && c.active !== 0).map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                          {clientsList.length === 0 && (
                            <p className="text-[9px] text-amber-600 mt-1">Agrega primero un cliente desde la Consola de Control.</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Estado de la República</label>
                          <select 
                            value={newProjState}
                            onChange={(e) => setNewProjState(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                          >
                            {Object.keys(ESTADOS_MEXICO).map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Analista de Costos Asignado</label>
                          <select 
                            value={newProjCostos}
                            onChange={(e) => setNewProjCostos(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                          >
                            {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('costos') || role.includes('analista');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsable Comercial (P1 &amp; P6)</label>
                          <select 
                            value={newProjCommResp}
                            onChange={(e) => setNewProjCommResponsibility(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                          >
                            <option value="Agente de Ventas">Agente de Ventas</option>
                            <option value="Líder Regional">Líder Regional</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Líder Regional Asignado</label>
                          <select 
                            value={newProjLider}
                            onChange={(e) => setNewProjLider(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                          >
                            <option value="">-- Autodetectar Líder Regional --</option>
                            <option value="Líder Regional - Sur">Líder Regional - Sur</option>
                            <option value="Líder Regional - Norte">Líder Regional - Norte</option>
                            <option value="Noe Ortiz (Director General)">Noe Ortiz (Director General)</option>
                            {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('lider') && role.includes('regional');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {newProjCommResp === 'Agente de Ventas' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agente de Ventas Responsable</label>
                          <select 
                            value={newProjVentas}
                            onChange={(e) => setNewProjVentas(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            required
                          >
                            <option value="">-- Seleccionar Agente de Ventas --</option>
                                                        <option value="Líder Regional - Sur">Líder Regional - Sur</option>
                            <option value="Líder Regional - Norte">Líder Regional - Norte</option>
                            {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('ventas') || role.includes('comercial') || role.includes('agente');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                          <select 
                            value={newProjPriority}
                            onChange={(e) => setNewProjPriority(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                          >
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Compromiso de Entrega</label>
                          <input 
                            type="date" 
                            value={newProjDate}
                            onChange={(e) => setNewProjDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 mt-1 shadow-2xs">
                        <div className="flex items-center space-x-2.5">
                          <input 
                            type="checkbox" 
                            id="newProjSkipToCierre"
                            checked={newProjSkipToCierre}
                            onChange={(e) => {
                              setNewProjSkipToCierre(e.target.checked);
                              if (!e.target.checked) setNewProjFinalAmount('0.0');
                            }}
                            className="rounded bg-slate-50 border-slate-200 text-[#0F4C81] focus:ring-0 w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="newProjSkipToCierre" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                            Propuesta ya cotizada (Saltar directo al Paso 7: Cierre Comercial)
                          </label>
                        </div>
                        {newProjSkipToCierre && (
                          <div className="animate-fadeIn mt-2 bg-white p-3.5 border border-slate-200 rounded-lg space-y-1.5">
                            <label className="block text-[10px] font-bold text-[#0F4C81] uppercase tracking-wider mb-1">Monto / Presupuesto Cotizado ($)</label>
                            <input 
                              type="number" 
                              step="1"
                              value={newProjFinalAmount}
                              onChange={(e) => setNewProjFinalAmount(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded p-2 text-slate-800 font-extrabold focus:outline-none focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81]" 
                              placeholder="Ej. 150000"
                              required
                            />
                          </div>
                        )}
                      </div>

                      <div className="text-right pt-2">
                        <button 
                          type="submit"
                          className="bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold px-5 py-2 rounded transition-all"
                        >
                          Guardar en Pipeline
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Manage / Edit / Delete project form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-4 flex items-center">
                      <Settings size={14} className="mr-1.5 text-amber-500" /> Gestionar / Editar / Eliminar Licitación
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Seleccionar Licitación</label>
                      <select 
                        onChange={(e) => handleSelectEditProject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 text-xs focus:outline-none"
                      >
                        <option value="">-- Seleccionar proyecto --</option>
                        {projects.map(p => (
                          <option key={p.id} value={`${p.id} - ${p.name}`}>{p.id} - {p.name}</option>
                        ))}
                      </select>
                    </div>

                    {editProjId && (
                      <form onSubmit={handleEditProject} className="space-y-3.5 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre de la Obra</label>
                            <input 
                              type="text" 
                              value={editProjName}
                              onChange={(e) => setEditProjName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cliente</label>
                            <input 
                              type="text" 
                              value={editProjClient}
                              onChange={(e) => setEditProjClient(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Compromiso</label>
                            <input 
                              type="date" 
                              value={editProjDate}
                              onChange={(e) => setEditProjDate(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ubicación de Compuerta Activa</label>
                            <select 
                              value={editStageNum}
                              onChange={(e) => setEditStageNum(parseInt(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            >
                              <option value="1">Paso 1: Levantamiento</option>
                              <option value="2">Paso 2: Minuta Trabajo</option>
                              <option value="3">Paso 3: Catálogo Conceptos</option>
                              <option value="4">Paso 4: Cotización</option>
                              <option value="5">Paso 5: Revisión Dirección</option>
                              <option value="6">Paso 6: Entrega Cliente</option>
                              <option value="7">Paso 7: Cierre Comercial</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                            <select 
                              value={editProjPriority}
                              onChange={(e) => setEditProjPriority(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            >
                              <option value="Alta">Alta</option>
                              <option value="Media">Media</option>
                              <option value="Baja">Baja</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Responsable Comercial (P1 &amp; P6)</label>
                            <select 
                              value={editProjCommResp}
                              onChange={(e) => setEditProjCommResponsibility(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            >
                              <option value="Agente de Ventas">Agente de Ventas</option>
                              <option value="Líder Regional">Líder Regional</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Líder Regional Responsable</label>
                            <select 
                              value={editProjLider}
                              onChange={(e) => setEditProjLider(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            >
                              <option value="">-- Autodetectar Líder Regional --</option>
                              <option value="Líder Regional - Sur">Líder Regional - Sur</option>
                              <option value="Líder Regional - Norte">Líder Regional - Norte</option>
                              <option value="Noe Ortiz (Director General)">Noe Ortiz (Director General)</option>
                              {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('lider') && role.includes('regional');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {editProjCommResp === 'Agente de Ventas' && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Agente de Ventas Responsable</label>
                              <select 
                                value={editProjVentas}
                                onChange={(e) => setEditProjVentas(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                              >
                                <option value="">-- Seleccionar Agente de Ventas --</option>
                                                                <option value="Líder Regional - Sur">Líder Regional - Sur</option>
                                <option value="Líder Regional - Norte">Líder Regional - Norte</option>
                                {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('ventas') || role.includes('comercial') || role.includes('agente');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Analista de Costos Asignado</label>
                            <select 
                              value={editProjCostos}
                              onChange={(e) => setEditProjCostos(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                            >
                              {usersList.filter(u => {
                              const role = (u.role || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                              return role.includes('costos') || role.includes('analista');
                            }).map(u => (
                              <option key={u.username} value={u.full_name}>{u.full_name} ({u.role})</option>
                            ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Justificación del Cambio / Notas</label>
                          <textarea 
                            value={editJustification}
                            onChange={(e) => setEditProjJustification(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none h-14"
                            placeholder="Motivo del cambio de etapa o fecha..."
                            required
                          />
                        </div>

                        {/* Danger deletion button */}
                        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                          <button 
                            type="button"
                            onClick={() => handleDeleteProject(editProjId)}
                            className="bg-[#C23B22]/10 hover:bg-[#C23B22] text-[#C23B22] hover:text-white font-bold px-3 py-1.5 rounded transition text-[10px] border border-[#C23B22]/30"
                          >
                            Eliminar Licitación
                          </button>
                          <button 
                            type="submit"
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-1.5 rounded transition"
                          >
                            Guardar Cambios
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                </div>
              )}

              {/* Main General Table of projects with robust checks to never crash */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-4">Pipeline General de Obras</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] bg-slate-950">
                        <th className="py-2.5 px-3">Folio ID</th>
                        <th className="py-2.5 px-3">Obra / Proyecto</th>
                        <th className="py-2.5 px-3">Cliente</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Zona</th>
                        <th className="py-2.5 px-3">Agente Ventas</th>
                        <th className="py-2.5 px-3">Líder Regional</th>
                        <th className="py-2.5 px-3">Analista Costos</th>
                        <th className="py-2.5 px-3">Prioridad</th>
                        <th className="py-2.5 px-3">Estatus Actual</th>
                        <th className="py-2.5 px-3 text-right">Estatus Comercial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProjects.map((p) => {
                        const folioId = p.id || 'N/A';
                        const pName = p.name || 'Sin nombre';
                        const clientName = p.client || 'Sin cliente';
                        const stateName = p.state || 'N/A';
                        const zoneName = p.zone || 'N/A';
                        const salesRep = p.assigned_ventas || 'Sin asignar';
                        const leaderRep = p.assigned_lider || 'Sin asignar';
                        const costsRep = p.assigned_costos || 'Sin asignar';
                        const priorityLvl = p.priority || 'Media';
                        const stageNum = p.current_stage || 1;
                        const finalStatus = p.status || 'En Proceso';

                        return (
                          <tr key={folioId} className="hover:bg-slate-100/50 transition">
                            <td className="py-2.5 px-3 font-bold text-[#0F4C81]">{folioId}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{pName}</td>
                            <td className="py-2.5 px-3 text-slate-700">{clientName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{stateName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{zoneName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{salesRep}</td>
                            <td className="py-2.5 px-3 text-slate-500">{leaderRep}</td>
                            <td className="py-2.5 px-3 text-slate-500">{costsRep}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityLvl === 'Alta' ? 'bg-[#C23B22]/10 text-[#C23B22]' : priorityLvl === 'Media' ? 'bg-amber-500/10 text-[#FDAB3D]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {priorityLvl}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-bold">Paso {stageNum} de 7</td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${finalStatus === 'Ganado' ? 'bg-emerald-500/10 text-emerald-400' : finalStatus === 'Perdido' ? 'bg-[#C23B22]/10 text-[#C23B22]' : finalStatus === 'Cancelado' ? 'bg-slate-800 text-slate-500' : 'bg-amber-500/10 text-[#FDAB3D]'}`}>
                                {finalStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          
          {activeTab === 'seguimiento' && hasPrivilege('projects') && (
            <div className="space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800">
                <div className="mb-4">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Selecciona Obra / Proyecto</label>
                  <select 
                    onChange={(e) => {
                      const p = projects.find(item => item.id === e.target.value);
                      setSelectedProject(p || null);
                      if (p) {
                        fetchProjectUploads(p.id);
                      }
                    }}
                    value={selectedProject ? selectedProject.id : ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="">-- Seleccionar proyecto --</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                    ))}
                  </select>
                </div>

                {selectedProject && (
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-4 text-xs">
                    
                    {/* General Metadata summary bar */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-[#0F4C81] p-4 rounded-lg border border-[#0F4C81]/10 shadow-sm">
                      <div>
                        <span className="text-[10px] text-blue-100 uppercase font-bold">Agente Ventas</span>
                        <p className="font-extrabold text-white mt-0.5">{selectedProject.assigned_ventas}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-100 uppercase font-bold">Líder Regional</span>
                        <p className="font-extrabold text-white mt-0.5">{selectedProject.assigned_lider}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-100 uppercase font-bold">Analista de Costos</span>
                        <p className="font-extrabold text-white mt-0.5">{selectedProject.assigned_costos}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-100 uppercase font-bold">Monto Cotizado</span>
                        <p className="font-extrabold text-white mt-0.5">${(selectedProject.final_amount || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-100 uppercase font-bold">Etapa Activa</span>
                        <p className="font-extrabold text-emerald-300 mt-0.5">Paso {selectedProject.current_stage}</p>
                      </div>
                    </div>

                    {/* Word report download downloads */}
                    <div className="flex flex-wrap gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <button 
                        onClick={() => {handleOpenFolder(selectedProject.id, selectedProject.sharepoint_folder_url);
}}
                        className="bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold px-3.5 py-2 rounded-lg transition-all text-[11px] flex items-center space-x-1.5 shadow-2xs"
                      >
                        <Folder size={14} />
                        <span>Abrir Carpeta SharePoint SalesHub 🌐</span>
                      </button>
                      <button 
                        onClick={() => handleDownloadReport(`/api/reports/dossier/${selectedProject.id}`)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-lg transition-all text-[11px] flex items-center space-x-1.5"
                      >
                        <Upload size={12} className="rotate-180" />
                        <span>Descargar Dossier Word</span>
                      </button>
                      {(isAdminOrDirector || (
                        selectedProject.current_stage === 2 &&
                        selectedProject.assigned_lider === user.full_name
                      )) && (
                        <button 
                          onClick={() => handleDownloadReport(`/api/reports/minute/${selectedProject.id}`)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-lg transition-all text-[11px] flex items-center space-x-1.5"
                        >
                          <Upload size={12} className="rotate-180" />
                          <span>Descargar Minuta Pre-llenada (P2)</span>
                        </button>
                      )}
                    </div>

                    {/* The 7 Sequential Gates Horizontal Progress Tabs */}
                    <div className="space-y-1.5 pt-2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Las 7 Compuertas Secuenciales del Proceso</label>
                      <div className="flex border border-slate-200 overflow-x-auto bg-slate-100 p-1.5 rounded-xl mb-1 gap-1.5 scrollbar-thin">
                        {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                          const isCompleted = num < selectedProject.current_stage;
                          const isActive = num === selectedProject.current_stage;
                          const isSelected = num === activeStepTab;
                          
                          const stepsNamesShort = [
                            "P1: Levantamiento",
                            "P2: Minuta Trabajo",
                            "P3: Catálogo",
                            "P4: Cotización",
                            "P5: Rev. Dirección",
                            "P6: Entrega Cliente",
                            "P7: Cierre Comercial"
                          ];
                          
                          let tabBg = "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800";
                          if (isSelected) {
                            tabBg = "bg-[#0F4C81] text-white font-black shadow-md scale-102 transform";
                          } else if (isActive) {
                            tabBg = "bg-amber-100 text-amber-800 border-b-2 border-amber-500 font-bold animate-pulse";
                          } else if (isCompleted) {
                            tabBg = "bg-emerald-50 text-emerald-800 font-semibold border-b-2 border-emerald-500";
                          }
                          
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setActiveStepTab(num)}
                              className={`flex-1 min-w-[135px] text-center py-2 px-3 rounded-lg text-[10px] uppercase tracking-wide transition-all flex items-center justify-center space-x-1.5 ${tabBg}`}
                            >
                              {isCompleted && <CheckCircle size={10} className="text-emerald-600" />}
                              <span>{stepsNamesShort[num - 1]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Step Tab Content Container */}
                    <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-5 shadow-xs">
                      
                      {/* Step Header / Description */}
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center">
                          <span className="bg-[#0F4C81] text-white rounded-full w-5 h-5 flex items-center justify-center mr-2 text-[10px] font-black">{activeStepTab}</span>
                          <span>
                            {activeStepTab === 1 && "Levantamiento Técnico de Obra 📋"}
                            {activeStepTab === 2 && "Minuta de Trabajo y Doble Confirmación 🤝"}
                            {activeStepTab === 3 && "Catálogo de Conceptos e Ingeniería ⚙️"}
                            {activeStepTab === 4 && "Cotización de Precios y Márgenes 📊"}
                            {activeStepTab === 5 && "Revisión de Dirección General 🔑"}
                            {activeStepTab === 6 && "Entrega Formal al Cliente 🚚"}
                            {activeStepTab === 7 && "Cierre Comercial de la Licitación 🏁"}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-1 italic">
                          {activeStepTab === 1 && "Fase inicial: Registrar requerimientos en campo, alcance de obra, fotos y viabilidad inicial."}
                          {activeStepTab === 2 && "Reunión de alineación. Exige la confirmación del Agente de Ventas y el Líder Regional de forma independiente."}
                          {activeStepTab === 3 && "Análisis técnico de conceptos de obra realizado por el departamento de Ingeniería y Costos."}
                          {activeStepTab === 4 && "Construcción de la propuesta económica final con precios unitarios, márgenes y utilidad."}
                          {activeStepTab === 5 && "Revisión y aprobación por parte de la Dirección General (Noe Ortiz) para liberar o solicitar modificaciones."}
                          {activeStepTab === 6 && "Envío formal de la cotización final aprobada al cliente y registro de constancia técnica."}
                          {activeStepTab === 7 && "Cierre comercial: Definir estatus final como Ganado o Perdido (registrando desfase financiero si aplica)."}
                        </p>
                      </div>

                      {/* File uploads specific for this selected step tab */}
                      {activeStepTab !== 7 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <h5 className="font-bold text-slate-700 text-[10px] uppercase tracking-wider flex items-center">
                          <Folder size={12} className="mr-1.5 text-[#0F4C81]" /> Archivos y Evidencias de Compuerta {activeStepTab}
                        </h5>
                        {(() => {
                          const stepFiles = safeProjectUploads.filter(f => f.step_name === `Paso ${activeStepTab}` || f.step_name === `Paso ${activeStepTab}`);
                          if (stepFiles.length === 0) {
                            return <p className="text-slate-400 text-xs italic">No hay archivos cargados para esta compuerta secuencial.</p>;
                          }
                          return (
                            <div className="space-y-2">
                              {stepFiles.map((f) => (
                                <div key={f.id} className="p-3 bg-white rounded-lg border border-slate-200/80 flex justify-between items-center text-xs shadow-3xs">
                                  <div>
                                    <p className="font-bold text-slate-800 flex items-center">
                                      <FileText size={12} className="mr-1.5 text-[#0F4C81]" /> {f.filename}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Subido por: <strong>{f.uploaded_by}</strong> el {f.uploaded_at}</p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {(() => {
                                      const sharepointUrl = f.sharepoint_web_url || `https://ingenieriadc.sharepoint.com/sites/SalesHubDCControl/${selectedProject.id}/${f.filename}`;
                                      return (
                                        <a
                                          href={sharepointUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="bg-[#0F4C81]/10 text-[#0F4C81] border border-[#0F4C81]/20 hover:bg-[#0F4C81] hover:text-white font-bold px-2.5 py-1.5 rounded transition-all text-[10px] flex items-center"
                                        >
                                          <span>Ver en SharePoint 🌐</span>
                                        </a>
                                      );
                                    })()}
                                    <button 
                                      onClick={() => {
                                        const sharepointUrl = f.sharepoint_web_url || `https://ingenieriadc.sharepoint.com/sites/SalesHubDCControl/${selectedProject.id}/${f.filename}`;
                                        window.open(sharepointUrl, '_blank');
                                      }}
                                      className="bg-[#0F4C81]/10 text-[#0F4C81] border border-[#0F4C81]/20 hover:bg-[#0F4C81] hover:text-white font-bold px-2.5 py-1.5 rounded transition-all text-[10px]"
                                    >
                                      Ver en Línea 🌐
                                    </button>
                                    {(f.uploaded_by === user.full_name || isStrictAdmin) && activeStepTab === selectedProject.current_stage && (
                                      <button 
                                        onClick={() => handleWipeUserUpload(f.id, selectedProject.id)}
                                        className="text-[#C23B22] hover:text-white hover:bg-[#C23B22]/15 p-1.5 rounded"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                                            )}

{/* If the user is viewing the active step tab: render all validator forms and buttons */}
                      {activeStepTab === selectedProject.current_stage ? (
                        <div className="space-y-4 pt-2">
                          
                          {/* 1. Evidence upload box (only for steps 1-6 since step 7 is won/lost closure) */}
                          {selectedProject.current_stage < 7 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {selectedProject.current_stage === 6
                                ? 'Evidencia de entrega al cliente'
                                : `Cargar Nueva Evidencia Técnico-Comercial (Paso ${selectedProject.current_stage})`}
                            </label>
                              <div className="flex items-center space-x-3">
                                <input 
                                  type="file" 
                                  disabled={!getIsAuthorizedToUpload() || loading}
                                  onChange={(e) => setStepFile(e.target.files[0])}
                                  className={`text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 ${!getIsAuthorizedToUpload() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                />
                                                                  <button 
                                    onClick={() => handleUploadFile(selectedProject.id, `Paso ${selectedProject.current_stage}`)}
                                    disabled={!getIsAuthorizedToUpload() || loading}
                                    className={`bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold px-4 py-1.5 rounded-lg transition text-xs flex items-center space-x-1.5 shadow-2xs ${(!getIsAuthorizedToUpload() || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    {loading ? (
                                      <>
                                        <RefreshCw size={12} className="animate-spin" />
                                        <span>Subiendo archivo...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload size={12} />
                                        <span>Subir Archivo</span>
                                      </>
                                    )}
                                  </button>
                              </div>
                            </div>
                          )}

                          {/* Authorization Warnings */}
                          {!getIsAuthorizedForActiveStep() && (
                            <div className="bg-red-50 border border-red-200 text-[#C23B22] p-4 rounded-xl text-xs font-semibold flex items-start mt-2 shadow-3xs">
                              <AlertTriangle size={14} className="mr-2 shrink-0 mt-0.5" />
                              <span>
                                No tienes permisos de escritura o carga en esta compuerta (Paso {selectedProject.current_stage}). Esta etapa está asignada a: <strong>{selectedProject.current_stage === 1 ? selectedProject.assigned_ventas : selectedProject.current_stage === 2 ? `${selectedProject.assigned_ventas} y ${selectedProject.assigned_lider}` : selectedProject.current_stage === 3 ? selectedProject.assigned_lider : selectedProject.current_stage === 4 ? selectedProject.assigned_costos : selectedProject.current_stage === 6 ? selectedProject.assigned_ventas : "Dirección General"}</strong>.
                              </span>
                            </div>
                          )}

                          {/* 1.5. Monto final cotizado - Paso 6 */}
{selectedProject.current_stage === 6 && (isAdminOrDirector || getIsAuthorizedForActiveStep()) && (
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
      Monto final cotizado / entregado al cliente
    </label>
    <div className="flex flex-col md:flex-row gap-2">
      <input
        type="text"
        inputMode="decimal"
        value={finalAmountEdit}
        onChange={(e) => setFinalAmountEdit(e.target.value)}
        placeholder="0.00"
        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-slate-300 outline-none"
      />
      <button
        type="button"
        onClick={() => handleSaveFinalAmount(selectedProject.id)}
        className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-lg text-xs transition"
      >
        Guardar monto
      </button>
    </div>
    <p className="text-[10px] text-slate-500">
      Este monto será el que se utilizará para el cierre comercial y el Dashboard.
    </p>
  </div>
)}

{/* 2. Notes / Validation comment box */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comentarios y Justificaciones de Validación</label>
                            <textarea 
                              value={stepComment}
                              onChange={(e) => setStepComment(e.target.value)}
                              disabled={false}
                              placeholder="Escriba comentarios, notas técnicas, o justificaciones de avance..."
                              className={`w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-800 h-20 text-xs focus:outline-none focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] ${!getIsAuthorizedForActiveStep() ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
                            />
                          </div>

                          {/* 3. Action Buttons Trigger Row */}
                          <div className="flex flex-wrap gap-2.5 pt-1.5">
                            {selectedProject.current_stage < 7 && (
                              (selectedProject.current_stage !== 2 || roleClean.includes('lider') || roleClean.includes('líder') || isAdminOrDirector) ? (
                                <button 
                                  onClick={() => handleStepAction(selectedProject.id, selectedProject.current_stage, false)}
                                  disabled={!getIsAuthorizedForActiveStep() || loading}
                                  className={`bg-[#00C875] hover:bg-[#00b068] text-white font-bold px-4 py-2 rounded-lg transition-all text-xs flex items-center space-x-1.5 shadow-2xs ${(!getIsAuthorizedForActiveStep() || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <CheckCircle size={12} />
                                  <span>Validar y Avanzar Paso {selectedProject.current_stage}</span>
                                </button>
                              ) : (
                                <>
                                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center space-x-2 font-medium">
                                  <Users size={14} className="shrink-0 text-amber-600" />
                                  <span> Rol Ventas: Confirma la alineación con el botón de abajo. La carga de la Minuta y el avance al Paso 3 corresponden al <strong>Líder Regional</strong>.</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs space-y-1.5 my-3">
                                  <div className="font-bold text-slate-800 flex items-center space-x-2">
                                    <Users size={14} className="text-[#0F4C81]" />
                                    <span>Estado de Confirmación Dual (Paso 2):</span>
                                  </div>
                                  {selectedProject.step2_ventas_done === 1 && selectedProject.step2_lider_done === 1 ? (
                                    <div className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded flex items-center space-x-2">
                                      <CheckCircle size={14} />
                                      <span>🟢 Confirmación dual completada (Paso 2 Aprobado)</span>
                                    </div>
                                  ) : selectedProject.step2_ventas_done === 1 ? (
                                    <div className="text-amber-800 font-semibold bg-amber-50 border border-amber-200 p-2 rounded flex items-center space-x-2">
                                      <Users size={14} className="text-amber-600 shrink-0" />
                                      <span>🟢 Agente de Ventas: Confirmado | ⏳ En espera de la confirmación del Líder Regional</span>
                                    </div>
                                  ) : selectedProject.step2_lider_done === 1 ? (
                                    <div className="text-amber-800 font-semibold bg-amber-50 border border-amber-200 p-2 rounded flex items-center space-x-2">
                                      <Users size={14} className="text-amber-600 shrink-0" />
                                      <span>🟢 Líder Regional: Confirmado | ⏳ En espera de la confirmación del Agente de Ventas</span>
                                    </div>
                                  ) : (
                                    <div className="text-slate-600 bg-slate-100 border border-slate-200 p-2 rounded flex items-center space-x-2">
                                      <Users size={14} className="text-slate-500 shrink-0" />
                                      <span>⏳ En espera de confirmación dual (Agente de Ventas y Líder Regional)</span>
                                    </div>
                                  )}
                                </div>
                                </>
                              )
                            )}

                            {/* Double check confirmation buttons (Paso 2) */}
                            {selectedProject.current_stage === 2 && (
                              <div className="flex flex-wrap gap-2">
                                {(selectedProject.assigned_ventas === user.full_name ||
                                  selectedProject.assigned_lider === user.full_name) &&
                                  !(
                                    (selectedProject.assigned_ventas === user.full_name &&
                                      selectedProject.step2_ventas_done === 1) ||
                                    (selectedProject.assigned_lider === user.full_name &&
                                      selectedProject.step2_lider_done === 1)
                                  ) && (
                                    <button
                                      onClick={() =>
                                        handleConfirmStep2(selectedProject.id)
                                      }
                                      className="bg-[#FDAB3D] hover:bg-[#eb962f] text-white font-bold px-4 py-2 rounded-lg transition text-xs flex items-center space-x-1.5 shadow-2xs"
                                    >
                                      <Users size={12} />
                                      <span>Confirmar Reunión de Alineación (Paso 2)</span>
                                    </button>
                                  )}
                                {isAdminOrDirector && (
                                  <button 
                                    onClick={async () => {
                                      await handleConfirmStep2(selectedProject.id);
                                      await handleStepAction(selectedProject.id, 2, false);
                                    }}
                                    className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-lg transition text-xs flex items-center space-x-1.5 shadow-2xs"
                                  >
                                    <Sparkles size={12} />
                                    <span>Aprobar y Desatorar Paso 2 (Modo Director) 👑</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* P4: Catalog incomplete -> return to P3 */}
{selectedProject.current_stage === 4 && (
  <div className="w-full mt-2 p-3 bg-red-50 border border-red-200 rounded-xl">
    <div className="text-xs font-bold text-red-700 mb-2">
      Catalogo incompleto
    </div>

    <textarea
      value={stepComment}
      onChange={(e) => setStepComment(e.target.value)}
      placeholder="Indica brevemente que falta en el catalogo..."
      className="w-full bg-white border border-red-200 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:border-red-400"
      rows="3"
    />

    <button
      type="button"
      onClick={async () => {
        const motivo = String(stepComment || '').trim();

        if (!motivo) {
          alert('Indica brevemente que falta en el catalogo.');
          return;
        }

        if (!window.confirm('El proyecto regresara al Paso 3 para completar el catalogo. ¿Continuar?')) {
          return;
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/projects/p4-return-p3?project_id=${encodeURIComponent(selectedProject.id)}&comments=${encodeURIComponent(motivo)}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sessionStorage.getItem('dc_access_token') || ''}`
            }
          });

          const data = await res.json();

          if (!res.ok) {
            alert(data.detail || 'No se pudo regresar el proyecto al Paso 3.');
            return;
          }

          alert('El proyecto regreso al Paso 3 correctamente.');
          setStepComment('');

          setSelectedProject({
            ...selectedProject,
            current_stage: 3,
            step3_completed: 0,
            step4_completed: 0
          });

          const freshData = await fetchProjects();
          const updatedProj = freshData.find(p => p.id === selectedProject.id);

          setSelectedProject(
            updatedProj
              ? {
                  ...updatedProj,
                  current_stage: 3,
                  step3_completed: 0,
                  step4_completed: 0
                }
              : null
          );

        } catch (err) {
          console.error(err);
          alert('Error de conexion al regresar el proyecto.');
        }
      }}
      disabled={
        !getIsAuthorizedForActiveStep() ||
        loading
      }
      className={`mt-2 bg-[#C23B22] hover:bg-[#a93220] text-white font-bold px-4 py-2 rounded-lg transition text-xs flex items-center space-x-1.5 ${
        (!getIsAuthorizedForActiveStep() || loading)
          ? 'opacity-50 cursor-not-allowed'
          : ''
      }`}
    >
      <AlertTriangle size={12} />
      <span>Catalogo incompleto - Regresar a Paso 3</span>
    </button>
  </div>
)}
{/* Rejection / Modification triggers */}
                            {selectedProject.current_stage === 3 && (roleClean.includes("costos") || isStrictAdmin) && (
                              <button 
                                onClick={() => {
                                  if (!stepComment) { alert('Justificación de rechazo requerida en los comentarios.'); return; }
                                  handleStepAction(selectedProject.id, 2, true);
                                }}
                                className="bg-[#C23B22]/10 hover:bg-[#C23B22] text-[#C23B22] hover:text-white font-bold px-4 py-2 rounded-lg border border-[#C23B22]/30 transition text-xs flex items-center space-x-1 shadow-2xs"
                              >
                                <AlertTriangle size={12} />
                                <span>Catálogo Incompleto (Regresar a P2)</span>
                              </button>
                            )}

                            {selectedProject.current_stage === 5 && (roleClean.includes("director") || isStrictAdmin) && (
                              <div className="w-full space-y-2">
  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
    Justificación de solicitar modificaciones
  </label>
  <textarea
    value={p5ModificationJustification}
    onChange={(e) => setP5ModificationJustification(e.target.value)}
    placeholder="Escribe aquí la justificación para regresar el proyecto a P4..."
    rows={3}
    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs resize-y focus:ring-2 focus:ring-[#C23B22]/30 focus:border-[#C23B22] outline-none"
  />
  <button
    onClick={() => {
      if (!reversalJustification.trim()) {
        alert('Justificación de modificaciones requerida.');
        return;
      }
      handleStepAction(selectedProject.id, 4, true, p5ModificationJustification);
    }}
    disabled={loading}
    className="bg-[#C23B22]/10 hover:bg-[#C23B22] text-[#C23B22] hover:text-white font-bold px-4 py-2 rounded-lg border border-[#C23B22]/30 transition text-xs flex items-center space-x-1 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <AlertTriangle size={12} />
    <span>Solicitar Modificaciones (Regresar a P4)</span>
  </button>
</div>
)}

                            {/* Paso 7 Cierre Comercial - Beautiful Inline Input Forms instead of prompt */}
                            {selectedProject.current_stage === 7 && (roleClean.includes("director") || isStrictAdmin) && !["Ganado", "Perdido", "Cancelado"].includes(selectedProject.status) && (
                              <div className="w-full space-y-3">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
                                  <div className="flex items-center space-x-2">
                                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Desfase de Costo en caso de Pérdida (%):</label>
                                    <input 
                                      type="number" 
                                      step="0.1"
                                      value={cierreDesfase}
                                      onChange={(e) => setCierreDesfase(e.target.value)}
                                      className="w-24 bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 font-extrabold text-center focus:outline-none focus:border-[#C23B22]" 
                                      placeholder="0.0"
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button 
                                      onClick={() => handleCierreProject(selectedProject.id, 'Ganado', 0.0, stepComment)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-lg shadow-xs transition text-xs flex items-center space-x-1"
                                    >
                                      <CheckCircle size={12} />
                                      <span>Marcar como GANADO</span>
                                    </button>
                                    <button 
                                      onClick={() => {
                                        const gapVal = parseFloat(cierreDesfase) || 0.0;
                                        if (gapVal <= 0.0) {
                                          const proceed = window.confirm("¿Seguro que el desfase es de 0%? Ingresa un porcentaje si hubo desviación.");
                                          if (!proceed) return;
                                        }
                                        handleCierreProject(selectedProject.id, 'Perdido', gapVal, stepComment);
                                      }}
                                      className="bg-[#C23B22] hover:bg-[#a82a1b] text-white font-extrabold px-4 py-2 rounded-lg shadow-xs transition text-xs flex items-center space-x-1"
                                    >
                                      <AlertTriangle size={12} />
                                      <span>Marcar como PERDIDO</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>



                        </div>
                      ) : (
                        /* Read-only feedback message when viewing a different tab */
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs text-amber-800 flex items-start mt-2">
                          <HelpCircle size={14} className="mr-2 text-amber-500 shrink-0 mt-0.5" />
                          <span>
                            Estás consultando el historial del <strong>Paso {activeStepTab}</strong>. 
                            El proyecto se encuentra actualmente en la etapa activa del <strong>Paso {selectedProject.current_stage}</strong>. 
                            Puedes examinar los documentos y evidencias de esta compuerta, pero los controles de validación, subida de archivos, aprobaciones y rechazos están deshabilitados.
                          </span>
                        </div>
                      )}

                    </div>
                    
                    {/* Control Administrativo de Reversión */}
                    {isStrictAdmin && selectedProject.current_stage < 7 && selectedProject.current_stage !== 5 && (
                      <div className="bg-white border border-[#C23B22]/20 rounded-xl p-5 shadow-sm text-slate-800 space-y-4">
                        <h4 className="text-xs font-bold text-[#C23B22] uppercase tracking-wider flex items-center">
                          <AlertTriangle size={14} className="mr-1.5" /> Control Administrativo de Reversión
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Como Administrador de DC Control, puedes forzar el regreso de esta cotización a cualquier compuerta anterior. Esto registrará una entrada de auditoría y notificará a los responsables.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Seleccionar Paso Destino</label>
                            <select 
                              value={reversalTarget} 
                              onChange={(e) => setReversalTarget(parseInt(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 text-xs focus:outline-none focus:border-[#C23B22]"
                            >
                              {Array.from({ length: selectedProject.current_stage - 1 }, (_, idx) => idx + 1).map((num) => {
                                const stepsNamesShort = [
                                  "Paso 1: Levantamiento Técnico de Obra",
                                  "Paso 2: Minuta de Trabajo y Doble Confirmación",
                                  "Paso 3: Catálogo de Conceptos e Ingeniería",
                                  "Paso 4: Cotización de Precios y Márgenes",
                                  "Paso 5: Revisión de Dirección General",
                                  "Paso 6: Entrega Formal al Cliente"
                                ];
                                return (
                                  <option key={num} value={num}>
                                    {stepsNamesShort[num - 1]}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#C23B22] uppercase mb-1">Justificación Obligatoria de Reversión</label>
                            <textarea 
                              value={reversalJustification}
                              onChange={(e) => setReversalJustification(e.target.value)}
                              placeholder="Escriba el motivo detallado de la reversión (ej. falta de firmas, catálogo incompleto...)"
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 text-xs focus:outline-none h-14 focus:border-[#C23B22]"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end pt-1">
                          <button 
                            type="button"
                            onClick={() => {
                              if (!reversalJustification) { alert('Debes agregar una justificación obligatoria para aplicar la reversión.'); return; }
                              handleStepAction(selectedProject.id, reversalTarget, true);
                              setReversalJustification('');
                            }}
                            className="bg-[#C23B22] hover:bg-[#a82a1b] text-white font-bold px-4 py-2 rounded-lg transition text-xs flex items-center space-x-1.5 shadow-2xs"
                          >
                            <AlertTriangle size={12} />
                            <span>Aplicar Reversión a Paso {reversalTarget}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: KANBAN VISUAL */}
          {activeTab === 'kanban' && hasPrivilege('projects') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full text-xs">
              
              {/* EN PROCESO */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-slate-800 flex flex-col max-h-[600px] overflow-y-auto">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#FDAB3D] mb-4 flex justify-between border-b border-slate-200 pb-2">
                  <span>⏳ En Proceso</span>
                  <span className="bg-amber-400/10 text-[#FDAB3D] text-[10px] px-2 py-0.5 rounded font-bold">
                    {filteredProjects.filter(p => p.status === 'En Proceso').length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'En Proceso').map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { setSelectedProject(p); setActiveTab('seguimiento'); fetchProjectUploads(p.id); }}
                      className="p-4 bg-slate-50 border border-slate-200 hover:border-[#0F4C81] hover:shadow-md transition cursor-pointer shadow-sm rounded-xl"
                    >
                      <p className="text-[10px] font-bold text-[#0F4C81]">{p.id}</p>
                      <h4 className="font-bold text-xs text-slate-900 mt-1 truncate">{p.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Cliente: {p.client}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-[10px]">
                        <span className="text-slate-500">Monto: ${p.final_amount ? p.final_amount.toLocaleString() : '0.00'}</span>
                        <span className="text-[#0F4C81] font-bold bg-[#0F4C81]/10 px-2 py-0.5 rounded-full">Paso {p.current_stage}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GANADOS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-slate-800 flex flex-col max-h-[600px] overflow-y-auto">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-400 mb-4 flex justify-between border-b border-slate-200 pb-2">
                  <span>✔️ Ganados</span>
                  <span className="bg-emerald-400/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold">
                    {filteredProjects.filter(p => p.status === 'Ganado').length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'Ganado').map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { setSelectedProject(p); setActiveTab('seguimiento'); fetchProjectUploads(p.id); }}
                      className="p-4 bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:shadow-md transition cursor-pointer shadow-sm rounded-xl"
                    >
                      <p className="text-[10px] font-bold text-emerald-400">{p.id}</p>
                      <h4 className="font-bold text-xs text-slate-900 mt-1 truncate">{p.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Cliente: {p.client}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-[10px]">
                        <span className="text-slate-500">Monto: ${p.final_amount ? p.final_amount.toLocaleString() : '0.00'}</span>
                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">Cerrado</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PERDIDOS / CANCELADOS */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-slate-800 flex flex-col max-h-[600px] overflow-y-auto">
                <h3 className="font-bold text-xs uppercase tracking-wider text-red-400 mb-4 flex justify-between border-b border-slate-200 pb-2">
                  <span>🚨 Perdidos / Cancelados</span>
                  <span className="bg-red-400/10 text-red-400 text-[10px] px-2 py-0.5 rounded font-bold">
                    {filteredProjects.filter(p => p.status === 'Perdido' || p.status === 'Cancelado').length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {filteredProjects.filter(p => p.status === 'Perdido' || p.status === 'Cancelado').map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => { setSelectedProject(p); setActiveTab('seguimiento'); fetchProjectUploads(p.id); }}
                      className="p-4 bg-slate-50 border border-slate-200 hover:border-[#C23B22] hover:shadow-md transition cursor-pointer shadow-sm rounded-xl"
                    >
                      <p className="text-[10px] font-bold text-red-400">{p.id}</p>
                      <h4 className="font-bold text-xs text-slate-900 mt-1 truncate">{p.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Cliente: {p.client}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-[10px]">
                        <span className="text-slate-500">Monto: ${p.final_amount ? p.final_amount.toLocaleString() : '0.00'}</span>
                        <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-full">{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: USUARIOS Y SEGURIDAD */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                
                {/* Edit profile form */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Mis Datos de Perfil</h3>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                      <input 
                        type="text" 
                        value={myProfileName}
                        onChange={(e) => setMyProfileName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                      <input 
                        type="email" 
                        value={myProfileEmail}
                        onChange={(e) => setMyProfileEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nueva Contraseña (Opcional)</label>
                      <input 
                        type="password" 
                        value={myProfilePass}
                        onChange={(e) => setMyProfilePass(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                        placeholder="Dejar en blanco para conservar"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#C23B22] uppercase mb-1">PIN de Seguridad de Cambios (PIN)</label>
                      <input 
                        type="password" 
                        value={myProfilePin}
                        onChange={(e) => setMyProfilePin(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-slate-800 focus:outline-none"
                        type="password" placeholder="••••"
                        required
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold py-2 rounded transition-all"
                    >
                      Actualizar Mis Datos
                    </button>
                  </form>
                </div>

                {/* Directory and deletion list */}
                <div className="lg:col-span-2 space-y-4">
                  
                  {/* Register collaborator form */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-3 flex items-center">
                      <PlusCircle size={14} className="mr-1.5 text-emerald-500" />
                      {editingUser ? 'Editar Colaborador' : 'Registrar Nuevo Colaborador'}
                    </h3>
                    
                    <form onSubmit={handleRegisterUser} className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Usuario (Login)</label>
                        <input 
                          type="text" 
                          value={nuUser}
                          onChange={(e) => setNuUser(e.target.value)}
                          disabled={!!editingUser}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none disabled:bg-slate-200 disabled:text-slate-500 font-bold"
                          placeholder="carlos.mendoza"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {editingUser ? 'Contraseña (vacío para no cambiar)' : 'Contraseña'}
                        </label>
                        <input 
                          type="password" 
                          value={nuPass}
                          onChange={(e) => setNuPass(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none"
                          required={!editingUser}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Completo</label>
                        <input 
                          type="text" 
                          value={nuName}
                          onChange={(e) => setNuName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none"
                          placeholder="Carlos Mendoza"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                        <input 
                          type="email" 
                          value={nuEmail}
                          onChange={(e) => setNuEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none"
                          placeholder="carlos@dccontrol.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Puesto / Rol</label>
                        <select 
                          value={nuRole}
                          onChange={(e) => setNuRole(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800 focus:outline-none"
                        >
                          <option value="Ventas">Ventas</option>
                          <option value="Líder Regional - Sur">Líder Regional - Sur</option>
                          <option value="Líder Regional - Norte">Líder Regional - Norte</option>
                          <option value="Analista de Costos Jefe">Analista de Costos Jefe</option>
                          <option value="Analista de Costos Junior 1">Analista de Costos Junior 1</option>
                          <option value="Analista de Costos Junior 2">Analista de Costos Junior 2</option>
                          <option value="Ingeniero">Ingeniero</option>
                          <option value="Moderador">Moderador</option>
                          <option value="Director Comercial">Director Comercial</option>
                          <option value="Director de Proyectos">Director de Proyectos</option>
                        </select>
                      </div>

                      <div className="col-span-2 pt-1 pb-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Permisos Granulares de Acceso</label>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={nuPrivDash} 
                              onChange={(e) => setNuPrivDash(e.target.checked)}
                              className="rounded text-[#0F4C81] focus:ring-0"
                            />
                            <span className="text-slate-700 font-semibold">Dashboards (Métricas/KPIs)</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={nuPrivRep} 
                              onChange={(e) => setNuPrivRep(e.target.checked)}
                              className="rounded text-[#0F4C81] focus:ring-0"
                            />
                            <span className="text-slate-700 font-semibold">Reportes (.docx/Dossiers)</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={nuPrivProj} 
                              onChange={(e) => setNuPrivProj(e.target.checked)}
                              className="rounded text-[#0F4C81] focus:ring-0"
                            />
                            <span className="text-slate-700 font-semibold">Proyectos (Crear y Avanzar)</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={nuPrivRev} 
                              onChange={(e) => setNuPrivRev(e.target.checked)}
                              className="rounded text-[#0F4C81] focus:ring-0"
                            />
                            <span className="text-slate-700 font-semibold text-[#C23B22]">Reversión de Compuertas</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2 col-span-2 pt-2">
                        {editingUser && (
                          <button 
                            type="button"
                            onClick={resetUserForm}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded transition"
                          >
                            Cancelar
                          </button>
                        )}
                        <button 
                          type="submit"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded transition"
                        >
                          {editingUser ? 'Guardar Cambios' : 'Crear Cuenta'}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-3">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Directorio Oficial de DC Control</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] bg-slate-950">
                            <th className="py-2 px-3">Usuario</th>
                            <th className="py-2 px-3">Nombre Completo</th>
                            <th className="py-2 px-3">Puesto / Rol</th>
                            <th className="py-2 px-3">Correo Electrónico</th>
                            <th className="py-2 px-3">Privilegios</th>
                            <th className="py-2 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {usersList.map((u) => {
                            const pStr = u.privileges || 'dashboards,reports,projects';
                            return (
                              <tr key={u.username} className="hover:bg-slate-100/50 transition">
                                <td className="py-2 px-3 font-semibold text-slate-700">{u.username}</td>
                                <td className="py-2 px-3 text-slate-900 font-bold">{u.full_name}</td>
                                <td className="py-2 px-3 text-slate-500 uppercase">{u.role}</td>
                                <td className="py-2 px-3 text-slate-500">{u.email || 'N/A'}</td>
                                <td className="py-2 px-3 text-[10px] text-slate-600">
                                  {pStr.split(',').map(p => p.trim()).join(' • ')}
                                </td>
                                <td className="py-2 px-3 text-right space-x-2">
                                  <button 
                                    onClick={() => handleEditUserClick(u)}
                                    className="text-[#0F4C81] hover:underline font-bold mr-1"
                                  >
                                    Editar
                                  </button>
                                  {u.username !== user.username && u.username !== 'noe.ortizadm' && (
                                    <button 
                                      onClick={() => handleDeleteUser(u.username)}
                                      className="text-[#C23B22] hover:underline font-bold"
                                    >
                                      Quitar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 7: CONSOLA DE CONTROL */}
          {activeTab === 'control' && (
            <div className="space-y-6 text-xs">
              
              <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="font-black text-sm text-slate-800 flex items-center">
                      <Building2 size={17} className="mr-2 text-[#0F4C81]" /> Catálogo de Clientes
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">Administra el catálogo que alimenta el selector de clientes del Tablero de Proyectos y los filtros del Dashboard.</p>
                  </div>
                  <form onSubmit={handleAddClient} className="flex gap-2 w-full md:w-auto">
                    <input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full md:w-72 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#0F4C81]"
                      placeholder="Nombre del cliente"
                      required
                    />
                    <button
                      type="submit"
                      disabled={clientSaving}
                      className="bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <PlusCircle size={14} /> {clientSaving ? 'Guardando...' : 'Agregar'}
                    </button>
                  </form>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {clientsList.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic">No hay clientes registrados.</span>
                  ) : clientsList.map(c => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-full px-3 py-1.5 text-[10px] font-bold">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.active === false || c.active === 0 ? 'bg-slate-300' : 'bg-emerald-500'}`}></span>
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Column 1: Backups & SharePoint Storage */}
                <div className="space-y-6">
                  
                  {/* Backups & Restore panel */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center">
                      <Settings size={14} className="mr-1.5 text-[#0F4C81]" /> Respaldo y Mantenimiento de Datos
                    </h3>
                    
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Genere respaldos estructurados periódicos para evitar saturar el almacenamiento de Supabase. Descargue un respaldo plano JSON o el compilado ZIP con todos los entregables.
                      </p>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button 
                          onClick={() => window.open(`${API_BASE_URL}/api/backup/zip`, '_blank')}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2 px-3 rounded text-center transition text-xs border border-slate-700"
                        >
                          Descargar ZIP Compilado
                        </button>
                        <button 
                          onClick={() => window.open(`${API_BASE_URL}/api/backup/json`, '_blank')}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2 px-3 rounded text-center transition text-xs border border-slate-700"
                        >
                          Generar Respaldo JSON
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                      <h4 className="font-bold text-[#C23B22] uppercase tracking-wider">Zona de Mantenimiento</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Esta acción borrará de manera definitiva todos los proyectos, archivos y bitácoras de Supabase. Las cuentas de usuario permanecerán seguras.
                      </p>
                      <button 
                        onClick={handleWipeDatabase}
                        className="bg-[#C23B22]/10 hover:bg-[#C23B22] text-[#C23B22] hover:text-white border border-[#C23B22]/30 font-bold py-2.5 px-4 rounded transition text-xs"
                      >
                        Restablecer Base de Datos a Cero
                      </button>
                    </div>
                  </div>

                  {/* SharePoint / MS Teams Credentials panel */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center">
                      <Folder size={14} className="mr-1.5 text-[#0F4C81]" /> Almacenamiento en Microsoft Teams / SharePoint
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Configure las credenciales de Microsoft Graph para almacenar todos los documentos y archivos de las compuertas técnicas en su espacio de Teams/SharePoint corporativo de forma ilimitada.
                    </p>
                    <form onSubmit={handleSaveMS} className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tenant ID de Microsoft (Inquilino)</label>
                        <input
                          type="text"
                          value={msTenant}
                          onChange={(e) => setMsTenant(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client ID de la Aplicación</label>
                        <input
                          type="text"
                          value={msClient}
                          onChange={(e) => setMsClient(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client Secret de la Aplicación (Valor)</label>
                        <input
                          type="password"
                          value={msSecret}
                          onChange={(e) => setMsSecret(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          placeholder={smtpPass ? "••••••••" : "Configurado en servidor (dejar vacío para conservar)"}
                        />
                      </div>
                      <div className="flex space-x-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={checkTeamsConnection}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold py-1.5 rounded text-xs transition"
                        >
                          Probar Conexión Teams
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold py-1.5 rounded text-xs transition"
                        >
                          Guardar Credenciales MS
                        </button>
                      </div>
                    </form>
                  </div>

                </div>

                {/* Column 2: Notifications Config */}
                <div>
                  
                  {/* SMTP Config panel */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-slate-800 space-y-4">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center">
                      <MessageSquare size={14} className="mr-1.5 text-amber-500" /> Canales de Notificación (SMTP &amp; Teams)
                    </h3>
                    
                    <form onSubmit={handleSaveSMTP} className="space-y-3.5">
                      <div className="flex items-center space-x-2.5 mb-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <input 
                          type="checkbox" 
                          checked={notifEnabled}
                          onChange={(e) => setNotifEnabled(e.target.checked)}
                          className="rounded bg-slate-50 border-slate-200 text-[#0F4C81] focus:ring-0"
                        />
                        <span className="text-[11px] font-bold text-slate-700">Habilitar Notificaciones de Sistema</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Servidor SMTP Host</label>
                          <input 
                            type="text" 
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Puerto SMTP</label>
                          <input 
                            type="text" 
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Emisor (SMTP User)</label>
                          <input 
                            type="email" 
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nueva Contraseña SMTP (Clave de app)</label>
                          <input 
                            type="password" 
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Remitente Visible</label>
                          <input 
                            type="text" 
                            value={smtpSender}
                            onChange={(e) => setSmtpSender(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teams Webhook URL</label>
                          <input 
                            type="text" 
                            value={teamsWebhook}
                            onChange={(e) => setTeamsWebhook(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded p-1.5 text-slate-800"
                            placeholder={teamsWebhookConfigured ? "Configurado en servidor (dejar vacío para conservar)" : "https://dccontrol.webhook.office.com/..."}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Destinatarios del Reporte de Dirección (Separados por coma)</label>
                        <input 
                          type="text" 
                          value={directorReportEmails}
                          onChange={(e) => setDirectorReportEmails(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 text-xs focus:outline-none focus:border-[#0F4C81]"
                          placeholder="director@dccontrol.com, gerente@dccontrol.com"
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                        <button 
                          type="button"
                          onClick={handleTestSMTP}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-4 py-1.5 rounded transition text-xs"
                        >
                          Enviar Correo Prueba
                        </button>
                        <button 
                          type="submit"
                          className="bg-[#0F4C81] hover:bg-[#0B3566] text-white font-bold px-5 py-1.5 rounded transition text-xs"
                        >
                          Guardar SMTP
                        </button>
                      </div>
                    </form>
                  </div>
                  
                </div>

              </div>

            </div>
          )}
          
          {/* TAB 8: BITÁCORA AUDITORÍA */}
          {activeTab === 'audit' && hasPrivilege('reports') && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 shadow text-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Historial de Auditoría Global (Audit Trail)</h3>
                  <p className="text-[10px] text-slate-500">Muestra el registro histórico de las compuertas, cargas y cambios en Supabase.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-500">Filtrar por ID:</span>
                  <select 
                    value={auditFilter} 
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="Todos">Todos</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.id}</option>
                    ))}
                    <option value="SISTEMA">SISTEMA</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2 font-mono text-[11px]">
                {auditLogs
                  .filter(log => auditFilter === 'Todos' || log.project_id === auditFilter)
                  .map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 shadow-3xs">
                      <div className="flex justify-between text-slate-500 mb-1 text-[9px]">
                        <span className="font-bold text-[#0F4C81]">PROYECTO: {log.project_id}</span>
                        <span>{log.timestamp}</span>
                      </div>
                      <p className="text-slate-700">
                        <strong className="text-slate-900 font-bold">{log.user_name}</strong> ({log.role}): {log.action}
                      </p>
                      {log.comments && (
                        <p className="text-slate-500 mt-1 italic flex items-start text-[10px]">
                          <MessageSquare size={10} className="mr-1.5 mt-0.5" />
                          <span>Comentario: {log.comments}</span>
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>

        {/* Corporate clean Footer */}
        <footer className="h-10 border-t border-slate-200 flex items-center justify-center bg-slate-100 text-[10px] text-slate-500 min-h-[2.5rem]">
          <span>Desarrollado por 🕷️ Comercializadora Industrial DC Control S.A. de C.V.</span>
        </footer>

      </div>

    </div>
  );
}




