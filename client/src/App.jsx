import {
  BarChart3,
  BedDouble,
  Building2,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  Download,
  Edit,
  Briefcase,
  Eye,
  EyeOff,
  Hotel,
  Lock,
  Mail,
  LogOut,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Upload,
  Phone,
  Trash2,
  X,
  UserRound,
  Users,
  Utensils
} from 'lucide-react';
import { createContext, useCallback, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { api, dateText, getBlockNotice, money, peekApiCache, setBlockNotice, setToken } from './api.js';

const AuthContext = createContext(null);

const roomImages = {
  hero: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80',
  login: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=900&q=80',
  single: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80',
  double: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  paneer: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=900&q=80'
};

const staffAvatarFallbacks = {
  admin: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  frontdesk: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  kitchen: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
  housekeeping: 'https://images.unsplash.com/photo-1531891437562-4301cf35b7e4?auto=format&fit=crop&w=300&q=80'
};

const fallbackRooms = [
  {
    id: 'single',
    number: '101',
    type: 'Single Room',
    price: 71,
    capacity: 1,
    status: 'available',
    availableForDates: true,
    image: roomImages.single,
    amenities: ['Wi-Fi', 'Breakfast', 'City view']
  },
  {
    id: 'double',
    number: '102',
    type: 'Double Room',
    price: 92,
    capacity: 2,
    status: 'available',
    availableForDates: true,
    image: roomImages.double,
    amenities: ['Wi-Fi', 'Room service', 'Balcony']
  }
];

const fallbackMenu = [
  { id: 'burger', name: 'Burger', category: 'Starter', price: 13, image: roomImages.burger, available: true },
  { id: 'paneer', name: 'Paneer', category: 'Main Course', price: 30, image: roomImages.paneer, available: true }
];
const managedPanelRoles = ['frontdesk', 'guest', 'kitchen', 'housekeeping'];
const managedPanelLabels = {
  frontdesk: 'Front Desk',
  guest: 'Guest Portal',
  kitchen: 'Kitchen',
  housekeeping: 'Housekeeping'
};

function dashboardPath(role) {
  return {
    admin: '/admin',
    frontdesk: '/frontdesk',
    guest: '/guest',
    kitchen: '/kitchen',
    housekeeping: '/housekeeping'
  }[role] || '/';
}

function userInitials(user) {
  const role = String(user?.role || '').trim();
  if (user?.firstName && user?.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (role) return role.slice(0, 2).toUpperCase();
  if (user?.firstName) return user.firstName.slice(0, 2).toUpperCase();
  return 'AD';
}

function roleLabel(role) {
  return role ? `${role[0].toUpperCase()}${role.slice(1)}` : 'Admin';
}

function panelRoleLabel(role) {
  return managedPanelLabels[role] || roleLabel(role);
}

function topbarSystemAlerts(systemStatus, fallbackRoute) {
  return Array.isArray(systemStatus?.alerts)
    ? systemStatus.alerts.map((alert) => ({
        id: `system-${alert.id}`,
        title: alert.title,
        message: alert.message,
        route: alert.route || fallbackRoute,
        createdAt: alert.createdAt || new Date().toISOString(),
        severity: alert.severity || 'info'
      }))
    : [];
}

function staffRoleLabel(role) {
  return {
    frontdesk: 'Receptionist',
    kitchen: 'Kitchen',
    housekeeping: 'Housekeeping',
    admin: 'Admin Manager'
  }[role] || roleLabel(role);
}

function staffFieldLabel(key) {
  return {
    firstName: 'First Name',
    lastName: 'Last Name',
    username: 'Username',
    email: 'Email',
    phone: 'Phone',
    avatar: 'Avatar URL',
    jobTitle: 'Job Title',
    salary: 'Salary',
    experience: 'Experience',
    password: 'Password'
  }[key] || key.replace(/([A-Z])/g, ' $1');
}

function initialsFromPerson(person) {
  const first = person?.firstName?.[0] || person?.username?.[0] || 'U';
  const last = person?.lastName?.[0] || person?.role?.[0] || 'R';
  return `${first}${last}`.toUpperCase();
}

function staffAvatarUrl(person) {
  return person?.avatar || staffAvatarFallbacks[person?.role] || '';
}

function fullName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.username || 'Guest';
}

function timeAgoText(value) {
  if (!value) return 'Now';
  const diff = Math.round((new Date(value) - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const minutes = Math.abs(diff);
  if (minutes < 60) return formatter.format(diff, 'minute');
  const hours = Math.round(diff / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  return formatter.format(days, 'day');
}

const roomTypeOptions = ['Single Room', 'Double Room', 'Deluxe Room', 'Suite', 'Family Room'];
const RADIAN = Math.PI / 180;

function renderPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#e5f2ff" fontSize="12" fontWeight="800" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handlePanelBlocked = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('utkal:panel-blocked', handlePanelBlocked);
    return () => window.removeEventListener('utkal:panel-blocked', handlePanelBlocked);
  }, []);

  const login = async (identifier, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { identifier, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api('/auth/register', { method: 'POST', body: payload });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

function useLoad(path, initialValue, options = {}) {
  const {
    refreshMs = 0,
    cacheTtlMs = 8000,
    pauseWhenHidden = true,
    revalidateOnFocus = true,
    revalidateOnReconnect = true
  } = options;
  const latestInitialValueRef = useRef(initialValue);
  latestInitialValueRef.current = initialValue;
  const initialCache = useMemo(() => peekApiCache(path), [path]);
  const [data, setData] = useState(() => initialCache?.data ?? initialValue);
  const [loading, setLoading] = useState(() => !initialCache?.data);
  const [error, setError] = useState('');
  const inFlightRef = useRef(null);
  const lastLoadedRef = useRef(initialCache?.updatedAt || 0);

  const load = useCallback(async (loadOptions = {}) => {
    const { background = false, forceFresh = false, reason = 'manual' } = loadOptions;
    const pageHidden = typeof document !== 'undefined' && document.hidden;
    if (pauseWhenHidden && pageHidden && reason === 'interval') return inFlightRef.current;
    if (inFlightRef.current) return inFlightRef.current;
    if (!background) setLoading(true);
    setError('');
    const request = api(path, { cacheTtlMs, forceFresh });
    inFlightRef.current = request;
    try {
      const nextData = await request;
      setData(nextData);
      lastLoadedRef.current = Date.now();
      return nextData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null;
      if (!background) setLoading(false);
    }
  }, [cacheTtlMs, path, pauseWhenHidden]);

  useEffect(() => {
    const cached = peekApiCache(path);
    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
      lastLoadedRef.current = cached.updatedAt || Date.now();
      if (!cached.fresh) {
        load({ background: true, forceFresh: true, reason: 'stale-mount' }).catch(() => {});
      }
      return;
    }

    setData(latestInitialValueRef.current);
    setLoading(true);
    load({ reason: 'mount' }).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!refreshMs) return undefined;
    const intervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      load({ background: true, forceFresh: true, reason: 'interval' }).catch(() => {});
    }, refreshMs);
    return () => window.clearInterval(intervalId);
  }, [load, refreshMs]);

  useEffect(() => {
    if (!revalidateOnFocus && !revalidateOnReconnect) return undefined;

    const revalidate = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (Date.now() - lastLoadedRef.current < 5000) return;
      load({ background: true, forceFresh: true, reason: 'revalidate' }).catch(() => {});
    };

    const handleVisibility = () => {
      if (revalidateOnFocus && typeof document !== 'undefined' && !document.hidden) {
        revalidate();
      }
    };
    const handleFocus = () => {
      if (revalidateOnFocus) revalidate();
    };
    const handleOnline = () => {
      if (revalidateOnReconnect) revalidate();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [load, revalidateOnFocus, revalidateOnReconnect]);

  return { data, setData, loading, error, load };
}

function useSystemStatus(refreshMs = 15000) {
  return useLoad('/system/status', {
    alerts: [],
    panelLocks: {},
    blocked: { blocked: false, reason: '', updatedAt: null },
    currentRole: ''
  }, { refreshMs });
}

function RequireRole({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles?.length && !roles.includes(user.role)) return <Navigate to={dashboardPath(user.role)} replace />;
  return <Outlet />;
}

function FullScreenLoader() {
  return (
    <div className="full-loader">
      <Hotel />
      <strong>Utkal Reserve</strong>
      <small>Your Stay, Our Priority</small>
    </div>
  );
}

function StatusPill({ status, label = status, className = '' }) {
  return <span className={`status-pill status-${String(status).replace(/\s+/g, '-')} ${className}`.trim()}>{label}</span>;
}

function PageHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <article className="stat-card">
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {hint && <span>{hint}</span>}
      </div>
      <Icon />
    </article>
  );
}

function EmptyState({ icon: Icon = ClipboardList, title = 'No records found', text = 'Nothing is ready to show here yet.' }) {
  return (
    <div className="empty-state">
      <Icon />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PublicShell() {
  const { user, logout } = useAuth();
  return (
    <div className="public-shell">
      <header className="public-nav">
        <Link to="/" className="brand public-brand">
          <Building2 size={26} />
          <span className="brand-copy public-brand-copy">
            <strong>Utkal Reserve</strong>
            <small>Your Stay, Our Priority</small>
          </span>
        </Link>
        <nav className="public-nav-links">
          <NavLink to="/" end className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`.trim()}>Home</NavLink>
          <NavLink to="/about" className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`.trim()}>About Us</NavLink>
          <NavLink to="/rooms" className={({ isActive }) => `public-nav-link ${isActive ? 'active' : ''}`.trim()}>Rooms</NavLink>
          {user ? (
            <>
              <NavLink to={dashboardPath(user.role)} className={({ isActive }) => `public-nav-button public-portal-link ${isActive ? 'active' : ''}`.trim()}>My Portal</NavLink>
              <button className="public-nav-button public-login-link" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => `public-nav-button public-login-link ${isActive ? 'active' : ''}`.trim()}>Login</NavLink>
              <NavLink to="/register" className={({ isActive }) => `public-nav-button public-signup-link ${isActive ? 'active' : ''}`.trim()}>Sign Up</NavLink>
            </>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

const adminNav = [
  { to: '/admin', match: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  {
    to: '/admin/staff',
    match: '/admin/staff',
    label: 'Staff Management',
    icon: Users,
    children: [
      { to: '/admin/staff', label: 'View All Staff' },
      { to: '/admin/staff/history', label: 'Cleaning History' },
      { to: '/admin/staff/add', label: 'Add Employee' }
    ]
  },
  {
    to: '/admin/rooms',
    match: '/admin/rooms',
    label: 'Rooms',
    icon: BedDouble,
    children: [
      { to: '/admin/rooms', label: 'All Rooms' },
      { to: '/admin/rooms/add', label: 'Add New Room' }
    ]
  },
  {
    to: '/admin/kitchen/menu',
    match: '/admin/kitchen',
    label: 'Kitchen',
    icon: Utensils,
    children: [
      { to: '/admin/kitchen/menu', label: 'Manage Menu' },
      { to: '/admin/kitchen/menu/add', label: 'Add Food Item' },
      { to: '/admin/kitchen/monitor', label: 'Kitchen Monitor' },
      { to: '/admin/kitchen/history', label: 'Delivery History' }
    ]
  },
  {
    to: '/admin/bookings',
    match: '/admin/bookings',
    label: 'Bookings',
    icon: CalendarCheck,
    children: [{ to: '/admin/bookings', label: 'Manage Bookings' }]
  },
  { to: '/admin/guests', match: '/admin/guests', label: 'Guests', icon: UserRound }
];

const guestNav = [
  { to: '/guest', match: '/guest', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/guest/bookings', label: 'My Bookings', icon: CalendarCheck },
  { to: '/guest/book-room', label: 'Book New Room', icon: BedDouble },
  { to: '/guest/order-food', label: 'Order Food', icon: Utensils },
  { to: '/guest/food-orders', label: 'Food Orders', icon: ClipboardList },
  { to: '/guest/profile', label: 'Profile Settings', icon: Settings }
];

const frontNav = [
  { to: '/frontdesk', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/frontdesk/bookings', label: 'Booking History', icon: CalendarCheck },
  { to: '/frontdesk/walk-in', label: 'Walk In Booking', icon: Plus },
  { to: '/frontdesk/rooms', label: 'Room Status', icon: BedDouble },
  { to: '/frontdesk/guests', label: 'Guest List', icon: Users }
];

const kitchenNav = [
  { to: '/kitchen', label: 'Active Orders', icon: ChefHat, end: true },
  { to: '/kitchen/history', label: 'History', icon: ClipboardList },
  { to: '/kitchen/profile', label: 'My Profile', icon: UserRound }
];

const housekeepingNav = [
  { to: '/housekeeping', label: 'Task Board', icon: Sparkles, end: true },
  { to: '/housekeeping/history', label: 'Cleaning History', icon: ClipboardList },
  { to: '/housekeeping/profile', label: 'My Profile', icon: UserRound }
];

function navIsActive(item, pathname) {
  const base = item.match || item.to?.split('?')[0];
  if (!base) return false;
  if (item.end) return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

function AdminTopbarTools({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { data, error, load } = useLoad('/admin/command-center', {
    notifications: [],
    searchIndex: [],
    live: { pendingBookings: 0, dirtyRooms: 0, readyOrders: 0, arrivalsToday: 0, departuresToday: 0 }
  }, { refreshMs: 30000, cacheTtlMs: 5000 });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState([]);

  useEffect(() => {
    setSearchOpen(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen && !profileOpen) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.topbar-search-wrap') || target.closest('.topbar-notify-wrap') || target.closest('.topbar-profile-wrap'))) {
        return;
      }
      setSearchOpen(false);
      setNotificationsOpen(false);
      setProfileOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [searchOpen, notificationsOpen, profileOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setSeenNotifications((current) => Array.from(new Set([...current, ...data.notifications.map((item) => item.id)])));
  }, [notificationsOpen, data.notifications]);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return data.searchIndex
      .filter((item) => {
        const haystack = [item.title, item.subtitle, item.meta, item.keywords].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(deferredQuery);
      })
      .slice(0, 7);
  }, [data.searchIndex, deferredQuery]);

  const unreadCount = data.notifications.filter((item) => !seenNotifications.includes(item.id)).length;

  const openRoute = (route) => {
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    navigate(route);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) {
      openRoute(searchResults[0].route);
      return;
    }
    if (query.trim()) {
      setSearchOpen(true);
    }
  };

  const toggleNotifications = async () => {
    if (!notificationsOpen) {
      await load();
    }
    setProfileOpen(false);
    setNotificationsOpen((current) => !current);
  };

  return (
    <>
      <div className="topbar-search-wrap">
        <form className="search-box topbar-search topbar-search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(Boolean(query.trim()))} placeholder="Search rooms, staff, guests..." />
          {query && (
            <button type="button" className="topbar-clear-button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </form>
        {searchOpen && (
          <div className="topbar-search-panel">
            {searchResults.length ? searchResults.map((item) => (
              <button key={item.id} type="button" className="topbar-search-result" onClick={() => openRoute(item.route)}>
                <span className="topbar-search-result-type">{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            )) : (
              <div className="topbar-search-empty">
                <strong>No admin matches found</strong>
                <small>Try a room number, guest name, staff name, or menu item.</small>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className="topbar-notify-wrap">
          <button className="icon-button topbar-icon-button topbar-notify-button" type="button" onClick={toggleNotifications} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="topbar-badge">{Math.min(unreadCount, 9)}</span>}
          </button>
          {notificationsOpen && (
            <div className="topbar-notify-panel">
              <div className="topbar-notify-head">
                <strong>Notifications</strong>
                <small>{error ? 'Live feed unavailable' : `${data.notifications.length} updates`}</small>
              </div>
              {data.notifications.length ? (
                <div className="topbar-notify-list">
                  {data.notifications.map((item) => (
                    <button key={item.id} type="button" className={`topbar-notify-item ${seenNotifications.includes(item.id) ? 'seen' : 'new'}`.trim()} onClick={() => openRoute(item.route)}>
                      <span className="topbar-notify-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </div>
                      <span>{timeAgoText(item.createdAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="topbar-search-empty topbar-notify-empty">
                  <strong>All quiet right now</strong>
                  <small>New kitchen, booking, and room alerts will appear here.</small>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="topbar-profile-wrap">
          <button
            type="button"
            className={`topbar-profile-trigger ${profileOpen ? 'active' : ''}`.trim()}
            onClick={() => {
              setSearchOpen(false);
              setNotificationsOpen(false);
              setProfileOpen((current) => !current);
            }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className="topbar-user-label">{roleLabel(user.role)}</span>
            <span className="avatar topbar-avatar">{userInitials(user)}</span>
          </button>
          {profileOpen && (
            <div className="topbar-profile-panel" role="menu">
              <div className="topbar-profile-summary">
                <span className="avatar topbar-profile-avatar">{userInitials(user)}</span>
                <div>
                  <strong>{fullName(user)}</strong>
                  <small>{user.username}</small>
                </div>
              </div>
              <button type="button" className="topbar-profile-logout" onClick={logout}>
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TopbarUserMenu({ user }) {
  const { logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.topbar-profile-wrap.user-menu-wrap')) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  return (
    <div className="topbar-profile-wrap user-menu-wrap">
      <button
        type="button"
        className={`topbar-profile-trigger ${open ? 'active' : ''}`.trim()}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="topbar-user-label">{roleLabel(user.role)}</span>
        <span className="avatar topbar-avatar">{userInitials(user)}</span>
      </button>
      {open && (
        <div className="topbar-profile-panel" role="menu">
          <div className="topbar-profile-summary">
            <span className="avatar topbar-profile-avatar">{userInitials(user)}</span>
            <div>
              <strong>{fullName(user)}</strong>
              <small>{user.username}</small>
            </div>
          </div>
          <button type="button" className="topbar-profile-logout" onClick={logout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}

function HousekeepingTopbarTools({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: tasks, error: tasksError, load: loadTasks } = useLoad('/housekeeping/tasks', { rooms: [], pending: 0 }, { refreshMs: 30000 });
  const { data: history, error: historyError, load: loadHistory } = useLoad('/housekeeping/history', { logs: [] }, { refreshMs: 30000 });
  const { data: systemStatus, error: systemError, load: loadSystemStatus } = useSystemStatus(30000);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState([]);

  useEffect(() => {
    setSearchOpen(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.topbar-search-wrap') || target.closest('.topbar-notify-wrap'))) {
        return;
      }
      setSearchOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [searchOpen, notificationsOpen]);

  const notifications = useMemo(() => {
    const systemAlerts = topbarSystemAlerts(systemStatus, '/housekeeping');
    const roomAlerts = tasks.rooms.map((room) => ({
      id: `room-${room.id}`,
      title: `Room ${room.number} needs attention`,
      message: room.housekeepingNote || `${room.type} is marked as ${room.status}.`,
      route: '/housekeeping',
      createdAt: room.updatedAt || room.createdAt || new Date().toISOString()
    }));
    const historyAlerts = history.logs.slice(0, 3).map((log) => ({
      id: `log-${log.id}`,
      title: `Room ${log.room?.number || '-'} cleaned`,
      message: `${dateText(log.completedAt)} at ${timeText(log.completedAt)} · ${log.status}`,
      route: '/housekeeping/history',
      createdAt: log.completedAt || log.updatedAt || log.createdAt
    }));
    return [...systemAlerts, ...roomAlerts, ...historyAlerts]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 8);
  }, [history.logs, systemStatus, tasks.rooms]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setSeenNotifications((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
  }, [notificationsOpen, notifications]);

  const searchIndex = useMemo(() => {
    const alertResults = topbarSystemAlerts(systemStatus, '/housekeeping').map((alert) => ({
      id: `search-${alert.id}`,
      type: 'Admin Alert',
      title: alert.title,
      subtitle: alert.message,
      route: alert.route,
      keywords: `${alert.title} ${alert.message} ${alert.severity || ''}`
    }));
    const roomResults = tasks.rooms.map((room) => ({
      id: `task-${room.id}`,
      type: 'Task',
      title: `Room ${room.number}`,
      subtitle: `${room.status} · ${room.type}`,
      route: '/housekeeping',
      keywords: `${room.number} ${room.type} ${room.status} ${room.housekeepingNote || ''}`
    }));
    const historyResults = history.logs.map((log) => ({
      id: `history-${log.id}`,
      type: 'History',
      title: `Room ${log.room?.number || '-'}`,
      subtitle: `${dateText(log.completedAt)} · ${log.status}`,
      route: '/housekeeping/history',
      keywords: `${log.room?.number || ''} ${log.room?.type || ''} ${log.status || ''} ${log.housekeeper?.firstName || ''} ${log.housekeeper?.lastName || ''}`
    }));
    const profileResult = [{
      id: 'housekeeping-profile',
      type: 'Profile',
      title: fullName(user),
      subtitle: user.email || 'Housekeeping profile',
      route: '/housekeeping/profile',
      keywords: `${fullName(user)} ${user.email || ''} ${user.phone || ''} ${user.username || ''}`
    }];
    return [...alertResults, ...profileResult, ...roomResults, ...historyResults];
  }, [history.logs, systemStatus, tasks.rooms, user]);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return searchIndex
      .filter((item) => [item.title, item.subtitle, item.keywords].filter(Boolean).join(' ').toLowerCase().includes(deferredQuery))
      .slice(0, 7);
  }, [deferredQuery, searchIndex]);

  const unreadCount = notifications.filter((item) => !seenNotifications.includes(item.id)).length;

  const openRoute = (route) => {
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    navigate(route);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) {
      openRoute(searchResults[0].route);
      return;
    }
    if (query.trim()) setSearchOpen(true);
  };

  const toggleNotifications = async () => {
    if (!notificationsOpen) {
      await Promise.all([loadTasks(), loadHistory(), loadSystemStatus()]);
    }
    setNotificationsOpen((current) => !current);
  };

  const liveFeedError = tasksError || historyError || systemError;

  return (
    <>
      <div className="topbar-search-wrap">
        <form className="search-box topbar-search topbar-search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(Boolean(query.trim()))} placeholder="Search rooms, logs, or profile..." />
          {query && (
            <button type="button" className="topbar-clear-button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </form>
        {searchOpen && (
          <div className="topbar-search-panel">
            {searchResults.length ? searchResults.map((item) => (
              <button key={item.id} type="button" className="topbar-search-result" onClick={() => openRoute(item.route)}>
                <span className="topbar-search-result-type">{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            )) : (
              <div className="topbar-search-empty">
                <strong>No housekeeping matches found</strong>
                <small>Try a room number, status, or cleaning record.</small>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className="topbar-notify-wrap">
          <button className="icon-button topbar-icon-button topbar-notify-button" type="button" onClick={toggleNotifications} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="topbar-badge">{Math.min(unreadCount, 9)}</span>}
          </button>
          {notificationsOpen && (
            <div className="topbar-notify-panel">
              <div className="topbar-notify-head">
                <strong>Notifications</strong>
                <small>{liveFeedError ? 'Live feed unavailable' : `${notifications.length} updates`}</small>
              </div>
              {notifications.length ? (
                <div className="topbar-notify-list">
                  {notifications.map((item) => (
                    <button key={item.id} type="button" className={`topbar-notify-item ${seenNotifications.includes(item.id) ? 'seen' : 'new'}`.trim()} onClick={() => openRoute(item.route)}>
                      <span className="topbar-notify-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </div>
                      <span>{timeAgoText(item.createdAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="topbar-search-empty topbar-notify-empty">
                  <strong>No housekeeping alerts</strong>
                  <small>New room cleaning requests and log updates will appear here.</small>
                </div>
              )}
            </div>
          )}
        </div>
        <TopbarUserMenu user={user} />
      </div>
    </>
  );
}

function FrontdeskTopbarTools({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: overview, error: overviewError, load: loadOverview } = useLoad('/frontdesk/overview', { stats: { expectedArrivals: 0, pendingDepartures: 0, totalOccupancy: 0 }, arrivals: [], departures: [], date: null }, { refreshMs: 30000 });
  const { data: rooms, error: roomsError, load: loadRooms } = useLoad('/rooms/status', { rooms: [] }, { refreshMs: 30000 });
  const { data: bookings, error: bookingsError, load: loadBookings } = useLoad('/bookings', { bookings: [] }, { refreshMs: 30000 });
  const { data: guests, error: guestsError, load: loadGuests } = useLoad('/admin/guests', { guests: [] }, { refreshMs: 30000 });
  const { data: systemStatus, error: systemError, load: loadSystemStatus } = useSystemStatus(30000);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState([]);

  useEffect(() => {
    setSearchOpen(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.topbar-search-wrap') || target.closest('.topbar-notify-wrap'))) {
        return;
      }
      setSearchOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [searchOpen, notificationsOpen]);

  const notifications = useMemo(() => {
    const systemAlerts = topbarSystemAlerts(systemStatus, '/frontdesk');
    const arrivalAlerts = overview.arrivals.map((booking) => ({
      id: `arrival-${booking.id}`,
      title: `${fullName(booking.guest)} arriving`,
      message: `Room ${booking.room?.number || '-'} is scheduled for arrival.`,
      route: '/frontdesk',
      createdAt: booking.checkIn || booking.createdAt
    }));
    const departureAlerts = overview.departures.map((booking) => ({
      id: `departure-${booking.id}`,
      title: `${fullName(booking.guest)} ready for checkout`,
      message: `Prepare invoice for Room ${booking.room?.number || '-'}.`,
      route: '/frontdesk/bookings',
      createdAt: booking.checkOut || booking.updatedAt || booking.createdAt
    }));
    const roomAlerts = rooms.rooms
      .filter((room) => ['dirty', 'maintenance'].includes(room.status))
      .slice(0, 4)
      .map((room) => ({
        id: `room-${room.id}`,
        title: `Room ${room.number} needs follow-up`,
        message: `${room.type} is currently ${room.status}.`,
        route: '/frontdesk/rooms',
        createdAt: room.updatedAt || room.createdAt
      }));
    return [...systemAlerts, ...arrivalAlerts, ...departureAlerts, ...roomAlerts]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 8);
  }, [overview.arrivals, overview.departures, rooms.rooms, systemStatus]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setSeenNotifications((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
  }, [notificationsOpen, notifications]);

  const searchIndex = useMemo(() => {
    const alertResults = topbarSystemAlerts(systemStatus, '/frontdesk').map((alert) => ({
      id: `search-${alert.id}`,
      type: 'Admin Alert',
      title: alert.title,
      subtitle: alert.message,
      route: alert.route,
      keywords: `${alert.title} ${alert.message} ${alert.severity || ''}`
    }));
    const bookingResults = bookings.bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'Booking',
      title: `Room ${booking.room?.number || '-'} · ${fullName(booking.guest)}`,
      subtitle: `${booking.status} · ${dateText(booking.checkIn)} to ${dateText(booking.checkOut)}`,
      route: '/frontdesk/bookings',
      keywords: `${booking.room?.number || ''} ${booking.room?.type || ''} ${fullName(booking.guest)} ${booking.status || ''} ${booking.source || ''}`
    }));
    const roomResults = rooms.rooms.map((room) => ({
      id: `room-${room.id}`,
      type: 'Room',
      title: `Room ${room.number}`,
      subtitle: `${room.type} · ${room.status}`,
      route: '/frontdesk/rooms',
      keywords: `${room.number} ${room.type} ${room.status} ${room.housekeepingNote || ''}`
    }));
    const guestResults = guests.guests.map((guest) => ({
      id: `guest-${guest.id}`,
      type: 'Guest',
      title: fullName(guest),
      subtitle: guest.email || guest.phone || 'Guest record',
      route: '/frontdesk/guests',
      keywords: `${fullName(guest)} ${guest.email || ''} ${guest.phone || ''} ${guest.username || ''}`
    }));
    return [
      {
        id: 'walk-in',
        type: 'Action',
        title: 'Create Walk-In Booking',
        subtitle: 'Start a new manual booking from the front desk.',
        route: '/frontdesk/walk-in',
        keywords: 'walk in walk-in new booking guest check in'
      },
      ...alertResults,
      ...bookingResults,
      ...roomResults,
      ...guestResults
    ];
  }, [bookings.bookings, guests.guests, rooms.rooms, systemStatus]);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return searchIndex
      .filter((item) => [item.title, item.subtitle, item.keywords].filter(Boolean).join(' ').toLowerCase().includes(deferredQuery))
      .slice(0, 7);
  }, [deferredQuery, searchIndex]);

  const unreadCount = notifications.filter((item) => !seenNotifications.includes(item.id)).length;

  const openRoute = (route) => {
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    navigate(route);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) {
      openRoute(searchResults[0].route);
      return;
    }
    if (query.trim()) setSearchOpen(true);
  };

  const toggleNotifications = async () => {
    if (!notificationsOpen) {
      await Promise.all([loadOverview(), loadRooms(), loadBookings(), loadGuests(), loadSystemStatus()]);
    }
    setNotificationsOpen((current) => !current);
  };

  const liveFeedError = overviewError || roomsError || bookingsError || guestsError || systemError;

  return (
    <>
      <div className="topbar-search-wrap">
        <form className="search-box topbar-search topbar-search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(Boolean(query.trim()))} placeholder="Search bookings, guests, or rooms..." />
          {query && (
            <button type="button" className="topbar-clear-button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </form>
        {searchOpen && (
          <div className="topbar-search-panel">
            {searchResults.length ? searchResults.map((item) => (
              <button key={item.id} type="button" className="topbar-search-result" onClick={() => openRoute(item.route)}>
                <span className="topbar-search-result-type">{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            )) : (
              <div className="topbar-search-empty">
                <strong>No front desk matches found</strong>
                <small>Try a guest name, room number, or booking status.</small>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className="topbar-notify-wrap">
          <button className="icon-button topbar-icon-button topbar-notify-button" type="button" onClick={toggleNotifications} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="topbar-badge">{Math.min(unreadCount, 9)}</span>}
          </button>
          {notificationsOpen && (
            <div className="topbar-notify-panel">
              <div className="topbar-notify-head">
                <strong>Notifications</strong>
                <small>{liveFeedError ? 'Live feed unavailable' : `${notifications.length} updates`}</small>
              </div>
              {notifications.length ? (
                <div className="topbar-notify-list">
                  {notifications.map((item) => (
                    <button key={item.id} type="button" className={`topbar-notify-item ${seenNotifications.includes(item.id) ? 'seen' : 'new'}`.trim()} onClick={() => openRoute(item.route)}>
                      <span className="topbar-notify-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </div>
                      <span>{timeAgoText(item.createdAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="topbar-search-empty topbar-notify-empty">
                  <strong>No front desk alerts</strong>
                  <small>New arrivals, departures, and room-status updates will appear here.</small>
                </div>
              )}
            </div>
          )}
        </div>
        <TopbarUserMenu user={user} />
      </div>
    </>
  );
}

function KitchenTopbarTools({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: activeOrders, error: activeError, load: loadActive } = useLoad('/orders?active=true', { orders: [] }, { refreshMs: 30000 });
  const { data: historyOrders, error: historyError, load: loadHistory } = useLoad('/orders?history=true', { orders: [] }, { refreshMs: 30000 });
  const { data: systemStatus, error: systemError, load: loadSystemStatus } = useSystemStatus(30000);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState([]);

  useEffect(() => {
    setSearchOpen(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.topbar-search-wrap') || target.closest('.topbar-notify-wrap'))) {
        return;
      }
      setSearchOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [searchOpen, notificationsOpen]);

  const notifications = useMemo(() => {
    const systemAlerts = topbarSystemAlerts(systemStatus, '/kitchen');
    const activeAlerts = activeOrders.orders.map((order) => {
      const itemCount = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const title = order.status === 'ready'
        ? `Room ${order.room?.number || '-'} ready for delivery`
        : order.status === 'cooking'
          ? `Room ${order.room?.number || '-'} is cooking`
          : `New ticket from Room ${order.room?.number || '-'}`;
      return {
        id: `active-${order.id}`,
        title,
        message: `${itemCount} item(s) · ${fullName(order.guest)}`,
        route: '/kitchen',
        createdAt: order.updatedAt || order.createdAt
      };
    });
    const historyAlerts = historyOrders.orders.slice(0, 3).map((order) => ({
      id: `history-${order.id}`,
      title: `Delivered to Room ${order.room?.number || '-'}`,
      message: `${order.items.map((item) => item.name).join(', ')} · ${money(order.total)}`,
      route: '/kitchen/history',
      createdAt: order.updatedAt || order.createdAt
    }));
    return [...systemAlerts, ...activeAlerts, ...historyAlerts]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 8);
  }, [activeOrders.orders, historyOrders.orders, systemStatus]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setSeenNotifications((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
  }, [notificationsOpen, notifications]);

  const searchIndex = useMemo(() => {
    const alertResults = topbarSystemAlerts(systemStatus, '/kitchen').map((alert) => ({
      id: `search-${alert.id}`,
      type: 'Admin Alert',
      title: alert.title,
      subtitle: alert.message,
      route: alert.route,
      keywords: `${alert.title} ${alert.message} ${alert.severity || ''}`
    }));
    const liveResults = activeOrders.orders.map((order) => ({
      id: `live-${order.id}`,
      type: 'Live Order',
      title: `Room ${order.room?.number || '-'} · ${order.items.map((item) => item.name).join(', ')}`,
      subtitle: `${order.status} · ${fullName(order.guest)}`,
      route: '/kitchen',
      keywords: `${order.room?.number || ''} ${order.status || ''} ${fullName(order.guest)} ${order.items.map((item) => item.name).join(' ')}`
    }));
    const historyResults = historyOrders.orders.map((order) => ({
      id: `history-${order.id}`,
      type: 'History',
      title: `Room ${order.room?.number || '-'} · ${money(order.total)}`,
      subtitle: `${dateText(order.updatedAt || order.createdAt)} · ${order.items.map((item) => item.name).join(', ')}`,
      route: '/kitchen/history',
      keywords: `${order.room?.number || ''} ${order.items.map((item) => item.name).join(' ')} ${order.status || ''} ${fullName(order.guest)}`
    }));
    return [
      {
        id: 'kitchen-board',
        type: 'Action',
        title: 'Open Active Orders',
        subtitle: 'Monitor the live kitchen queue.',
        route: '/kitchen',
        keywords: 'active orders kitchen board pending ready cooking'
      },
      {
        id: 'kitchen-history',
        type: 'Action',
        title: 'Open Delivery History',
        subtitle: 'Review completed room service tickets.',
        route: '/kitchen/history',
        keywords: 'history delivered orders kitchen delivery log'
      },
      {
        id: 'kitchen-profile',
        type: 'Profile',
        title: fullName(user),
        subtitle: user.email || 'Kitchen profile',
        route: '/kitchen/profile',
        keywords: `${fullName(user)} ${user.email || ''} ${user.phone || ''} ${user.username || ''}`
      },
      ...alertResults,
      ...liveResults,
      ...historyResults
    ];
  }, [activeOrders.orders, historyOrders.orders, systemStatus, user]);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return searchIndex
      .filter((item) => [item.title, item.subtitle, item.keywords].filter(Boolean).join(' ').toLowerCase().includes(deferredQuery))
      .slice(0, 7);
  }, [deferredQuery, searchIndex]);

  const unreadCount = notifications.filter((item) => !seenNotifications.includes(item.id)).length;

  const openRoute = (route) => {
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    navigate(route);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) {
      openRoute(searchResults[0].route);
      return;
    }
    if (query.trim()) setSearchOpen(true);
  };

  const toggleNotifications = async () => {
    if (!notificationsOpen) {
      await Promise.all([loadActive(), loadHistory(), loadSystemStatus()]);
    }
    setNotificationsOpen((current) => !current);
  };

  const liveFeedError = activeError || historyError || systemError;

  return (
    <>
      <div className="topbar-search-wrap">
        <form className="search-box topbar-search topbar-search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(Boolean(query.trim()))} placeholder="Search tickets, rooms, or profile..." />
          {query && (
            <button type="button" className="topbar-clear-button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </form>
        {searchOpen && (
          <div className="topbar-search-panel">
            {searchResults.length ? searchResults.map((item) => (
              <button key={item.id} type="button" className="topbar-search-result" onClick={() => openRoute(item.route)}>
                <span className="topbar-search-result-type">{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            )) : (
              <div className="topbar-search-empty">
                <strong>No kitchen matches found</strong>
                <small>Try a room number, dish name, or delivery status.</small>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className="topbar-notify-wrap">
          <button className="icon-button topbar-icon-button topbar-notify-button" type="button" onClick={toggleNotifications} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="topbar-badge">{Math.min(unreadCount, 9)}</span>}
          </button>
          {notificationsOpen && (
            <div className="topbar-notify-panel">
              <div className="topbar-notify-head">
                <strong>Notifications</strong>
                <small>{liveFeedError ? 'Live feed unavailable' : `${notifications.length} updates`}</small>
              </div>
              {notifications.length ? (
                <div className="topbar-notify-list">
                  {notifications.map((item) => (
                    <button key={item.id} type="button" className={`topbar-notify-item ${seenNotifications.includes(item.id) ? 'seen' : 'new'}`.trim()} onClick={() => openRoute(item.route)}>
                      <span className="topbar-notify-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </div>
                      <span>{timeAgoText(item.createdAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="topbar-search-empty topbar-notify-empty">
                  <strong>No kitchen alerts</strong>
                  <small>New room-service tickets and delivery completions will appear here.</small>
                </div>
              )}
            </div>
          )}
        </div>
        <TopbarUserMenu user={user} />
      </div>
    </>
  );
}

function GuestTopbarTools({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: dashboard, error: dashboardError, load: loadDashboard } = useLoad('/guests/dashboard', {
    stats: { currentBill: 0, membershipTier: 'Silver', loyaltyPoints: 0 },
    bookings: [],
    active: null,
    user: null
  }, { refreshMs: 30000 });
  const { data: orders, error: ordersError, load: loadOrders } = useLoad('/orders', { orders: [] }, { refreshMs: 30000 });
  const { data: menu, error: menuError, load: loadMenu } = useLoad('/public/menu', { menu: [] }, { refreshMs: 30000 });
  const { data: rooms, error: roomsError, load: loadRooms } = useLoad('/public/rooms', { rooms: [] }, { refreshMs: 30000 });
  const { data: systemStatus, error: systemError, load: loadSystemStatus } = useSystemStatus(30000);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotifications, setSeenNotifications] = useState([]);

  useEffect(() => {
    setSearchOpen(Boolean(query.trim()));
  }, [query]);

  useEffect(() => {
    setSearchOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchOpen && !notificationsOpen) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest('.topbar-search-wrap') || target.closest('.topbar-notify-wrap'))) {
        return;
      }
      setSearchOpen(false);
      setNotificationsOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [searchOpen, notificationsOpen]);

  const notifications = useMemo(() => {
    const systemAlerts = topbarSystemAlerts(systemStatus, '/guest');
    const stayAlerts = dashboard.active
      ? [{
        id: `stay-${dashboard.active.id}`,
        title: `Current stay in Room ${dashboard.active.room?.number || '-'}`,
        message: `Checkout is scheduled for ${dateText(dashboard.active.checkOut)}.`,
        route: '/guest/bookings',
        createdAt: dashboard.active.updatedAt || dashboard.active.createdAt || dashboard.active.checkIn
      }]
      : dashboard.bookings
        .filter((booking) => booking.status === 'confirmed')
        .slice(0, 2)
        .map((booking) => ({
          id: `booking-${booking.id}`,
          title: `Upcoming stay in Room ${booking.room?.number || '-'}`,
          message: `${dateText(booking.checkIn)} to ${dateText(booking.checkOut)} · ${booking.room?.type || 'Room booking'}`,
          route: '/guest/bookings',
          createdAt: booking.createdAt || booking.checkIn
        }));

    const orderAlerts = orders.orders
      .filter((order) => order.status !== 'delivered')
      .slice(0, 5)
      .map((order) => ({
        id: `order-${order.id}`,
        title: order.status === 'ready' ? `Room ${order.room?.number || '-'} order is ready` : `Room ${order.room?.number || '-'} order is ${order.status}`,
        message: `${order.items.map((item) => item.name).join(', ')} · ${money(order.total)}`,
        route: '/guest/food-orders',
        createdAt: order.updatedAt || order.createdAt
      }));

    return [...systemAlerts, ...stayAlerts, ...orderAlerts]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 8);
  }, [dashboard.active, dashboard.bookings, orders.orders, systemStatus]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setSeenNotifications((current) => Array.from(new Set([...current, ...notifications.map((item) => item.id)])));
  }, [notificationsOpen, notifications]);

  const searchIndex = useMemo(() => {
    const alertResults = topbarSystemAlerts(systemStatus, '/guest').map((alert) => ({
      id: `search-${alert.id}`,
      type: 'Admin Alert',
      title: alert.title,
      subtitle: alert.message,
      route: alert.route,
      keywords: `${alert.title} ${alert.message} ${alert.severity || ''}`
    }));
    const bookingResults = dashboard.bookings.map((booking) => ({
      id: `booking-${booking.id}`,
      type: 'Booking',
      title: `Room ${booking.room?.number || '-'} · ${booking.room?.type || 'Room'}`,
      subtitle: `${booking.status} · ${dateText(booking.checkIn)} to ${dateText(booking.checkOut)}`,
      route: '/guest/bookings',
      keywords: `${booking.room?.number || ''} ${booking.room?.type || ''} ${booking.status || ''} ${booking.source || ''} ${booking.guests || ''}`
    }));
    const orderResults = orders.orders.map((order) => ({
      id: `order-${order.id}`,
      type: 'Food Order',
      title: `Room ${order.room?.number || '-'} · ${money(order.total)}`,
      subtitle: `${order.status} · ${order.items.map((item) => item.name).join(', ')}`,
      route: '/guest/food-orders',
      keywords: `${order.room?.number || ''} ${order.status || ''} ${order.items.map((item) => item.name).join(' ')} ${money(order.total)}`
    }));
    const roomResults = rooms.rooms.slice(0, 12).map((room) => ({
      id: `room-${room.id}`,
      type: 'Room',
      title: `Room ${room.number} · ${room.type}`,
      subtitle: `${money(room.price)} / night · ${room.capacity || 2} guests`,
      route: '/guest/book-room',
      keywords: `${room.number} ${room.type} ${room.status || ''} ${(room.amenities || []).join(' ')}`
    }));
    const menuResults = menu.menu.map((item) => ({
      id: `menu-${item.id}`,
      type: 'Menu',
      title: item.name,
      subtitle: `${item.category} · ${money(item.price)}`,
      route: '/guest/order-food',
      keywords: `${item.name} ${item.category} ${item.description || ''}`
    }));

    return [
      {
        id: 'guest-book-room',
        type: 'Action',
        title: 'Book a New Room',
        subtitle: 'Check dates, compare rooms, and confirm a new stay.',
        route: '/guest/book-room',
        keywords: 'book new room booking stay reserve room'
      },
      {
        id: 'guest-order-food',
        type: 'Action',
        title: 'Order Food',
        subtitle: 'Send a room-service order to the kitchen.',
        route: '/guest/order-food',
        keywords: 'order food menu room service kitchen'
      },
      {
        id: 'guest-profile',
        type: 'Profile',
        title: fullName(user),
        subtitle: user.email || 'Guest profile',
        route: '/guest/profile',
        keywords: `${fullName(user)} ${user.email || ''} ${user.phone || ''} ${user.username || ''}`
      },
      ...alertResults,
      ...bookingResults,
      ...orderResults,
      ...roomResults,
      ...menuResults
    ];
  }, [dashboard.bookings, menu.menu, orders.orders, rooms.rooms, systemStatus, user]);

  const searchResults = useMemo(() => {
    if (!deferredQuery) return [];
    return searchIndex
      .filter((item) => [item.title, item.subtitle, item.keywords].filter(Boolean).join(' ').toLowerCase().includes(deferredQuery))
      .slice(0, 7);
  }, [deferredQuery, searchIndex]);

  const unreadCount = notifications.filter((item) => !seenNotifications.includes(item.id)).length;

  const openRoute = (route) => {
    setQuery('');
    setSearchOpen(false);
    setNotificationsOpen(false);
    navigate(route);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    if (searchResults[0]) {
      openRoute(searchResults[0].route);
      return;
    }
    if (query.trim()) setSearchOpen(true);
  };

  const toggleNotifications = async () => {
    if (!notificationsOpen) {
      await Promise.all([loadDashboard(), loadOrders(), loadMenu(), loadRooms(), loadSystemStatus()]);
    }
    setNotificationsOpen((current) => !current);
  };

  const liveFeedError = dashboardError || ordersError || menuError || roomsError || systemError;

  return (
    <>
      <div className="topbar-search-wrap">
        <form className="search-box topbar-search topbar-search-form" onSubmit={submitSearch}>
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setSearchOpen(Boolean(query.trim()))} placeholder="Search bookings, rooms, or menu..." />
          {query && (
            <button type="button" className="topbar-clear-button" onClick={() => { setQuery(''); setSearchOpen(false); }} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </form>
        {searchOpen && (
          <div className="topbar-search-panel">
            {searchResults.length ? searchResults.map((item) => (
              <button key={item.id} type="button" className="topbar-search-result" onClick={() => openRoute(item.route)}>
                <span className="topbar-search-result-type">{item.type}</span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </button>
            )) : (
              <div className="topbar-search-empty">
                <strong>No guest matches found</strong>
                <small>Try a room number, food item, booking date, or menu category.</small>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <div className="topbar-notify-wrap">
          <button className="icon-button topbar-icon-button topbar-notify-button" type="button" onClick={toggleNotifications} aria-label="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="topbar-badge">{Math.min(unreadCount, 9)}</span>}
          </button>
          {notificationsOpen && (
            <div className="topbar-notify-panel">
              <div className="topbar-notify-head">
                <strong>Notifications</strong>
                <small>{liveFeedError ? 'Live guest feed unavailable' : `${notifications.length} updates`}</small>
              </div>
              {notifications.length ? (
                <div className="topbar-notify-list">
                  {notifications.map((item) => (
                    <button key={item.id} type="button" className={`topbar-notify-item ${seenNotifications.includes(item.id) ? 'seen' : 'new'}`.trim()} onClick={() => openRoute(item.route)}>
                      <span className="topbar-notify-dot" />
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </div>
                      <span>{timeAgoText(item.createdAt)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="topbar-search-empty">
                  <strong>No guest alerts</strong>
                  <small>Your stay, room service, and booking updates will show up here.</small>
                </div>
              )}
            </div>
          )}
        </div>
        <TopbarUserMenu user={user} />
      </div>
    </>
  );
}

function RoleShell({ nav, theme, title, icon: Icon }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: systemStatus } = useSystemStatus();

  useEffect(() => {
    if (user.role === 'admin') return;
    if (!systemStatus.blocked?.blocked) return;
    setBlockNotice(`${panelRoleLabel(user.role)} has been blocked by the admin.${systemStatus.blocked.reason ? ` ${systemStatus.blocked.reason}` : ''}`);
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate, systemStatus.blocked?.blocked, systemStatus.blocked?.reason, user.role]);

  const activeSystemAlerts = user.role === 'admin' ? [] : systemStatus.alerts || [];

  return (
    <div className={`role-shell ${theme}`}>
      <aside className="side-nav">
        <Link to={dashboardPath(user.role)} className="side-brand">
          <span className="brand-mark">
            <Building2 size={16} strokeWidth={2.4} />
          </span>
          <div>
            <strong>Utkal Reserve</strong>
            <small>Your Stay, Our Priority</small>
          </div>
        </Link>
        <nav className="side-nav-links">
          {nav.map((item) => {
            const active = navIsActive(item, location.pathname);
            if (item.children?.length) {
              return (
                <div key={item.label} className={`nav-group ${active ? 'active' : ''}`}>
                  <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-parent ${isActive ? 'active' : ''}`}>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                    <ChevronDown size={13} className="nav-chevron" />
                  </NavLink>
                  {active && (
                    <div className="nav-children">
                      {item.children.map((child) => (
                        <NavLink key={child.label} to={child.to} className={({ isActive }) => `nav-child ${isActive ? 'active' : ''}`}>
                          <ChevronRight size={11} />
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="side-nav-footer">
          <button className="logout-button" onClick={logout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
          <div className="user-chip">
            <span>{userInitials(user)}</span>
            <div>
              <strong>{fullName(user)}</strong>
              <small>{roleLabel(user.role)}</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="workspace-topbar">
          <div className="topbar-main">
            <span className="topbar-title">{title}</span>
            {user.role === 'admin'
              ? <AdminTopbarTools user={user} />
              : user.role === 'guest'
                ? <GuestTopbarTools user={user} />
              : user.role === 'housekeeping'
                ? <HousekeepingTopbarTools user={user} />
                : user.role === 'kitchen'
                  ? <KitchenTopbarTools user={user} />
                : user.role === 'frontdesk'
                  ? <FrontdeskTopbarTools user={user} />
              : (
                <>
                  <div className="search-box topbar-search">
                    <Search size={16} />
                    <input placeholder="Search rooms, staff, guests..." />
                  </div>
                  <div className="topbar-actions">
                    <button className="icon-button topbar-icon-button" type="button" aria-label="Notifications">
                      <Bell size={16} />
                    </button>
                    <TopbarUserMenu user={user} />
                  </div>
                </>
              )}
          </div>
        </header>
        <section className="workspace-body">
          {activeSystemAlerts.length > 0 && (
            <div className="panel-broadcast-stack">
              {activeSystemAlerts.slice(0, 2).map((alert) => (
                <article key={alert.id} className={`panel-broadcast-card severity-${alert.severity || 'info'}`}>
                  <div className="panel-broadcast-badge">
                    <Bell size={16} />
                    <span>Admin Alert</span>
                  </div>
                  <div className="panel-broadcast-copy">
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                  </div>
                  <span className="panel-broadcast-time">{timeAgoText(alert.createdAt)}</span>
                </article>
              ))}
            </div>
          )}
          <Outlet />
        </section>
      </main>
    </div>
  );
}

function RoomCard({ room, action, compact = false }) {
  return (
    <article className={`room-card ${compact ? 'compact' : ''}`}>
      <div className="room-image-wrap">
        <img src={room.image || roomImages.single} alt={room.type} />
        <span className="room-price-tag">{money(room.price)} / night</span>
      </div>
      <div className="room-card-body">
        <div className="room-title-row">
          <div>
            <h3>{room.type}</h3>
            <small>Room {room.number}</small>
          </div>
          <StatusPill status={room.status || (room.availableForDates ? 'available' : 'occupied')} />
        </div>
        <p>{room.description || `Room ${room.number}`}</p>
        <div className="meta-row">
          <span>{room.capacity || 2} guests</span>
          {(room.amenities || []).slice(0, 2).map((amenity) => <span key={amenity}>{amenity}</span>)}
        </div>
        {action}
      </div>
    </article>
  );
}

function HomePage() {
  const { data } = useLoad('/public/rooms', { rooms: fallbackRooms });
  const rooms = data?.rooms?.length ? data.rooms.slice(0, 2) : fallbackRooms;
  return (
    <main className="home-page">
      <section className="home-hero-wrap">
        <section
          className="hero home-hero"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 17, 48, .82) 0%, rgba(5, 17, 48, .62) 42%, rgba(5, 17, 48, .36) 100%), url(${roomImages.hero})` }}
        >
          <div className="home-hero-copy">
            <h1>Welcome to <span className="hero-highlight">Utkal Reserve</span></h1>
            <p>Experience luxury, comfort, and world-class service. Book your perfect getaway today.</p>
            <div className="hero-actions">
              <Link to="/rooms" className="hero-primary-button">Browse Rooms</Link>
              <Link to="/register" className="hero-secondary-button">Join Member Club</Link>
            </div>
          </div>
        </section>
      </section>
      <section className="public-section home-featured-section">
        <PageHeader
          className="home-featured-header"
          title="Featured Rooms"
          subtitle="Hand-picked luxury selections for you."
          action={
            <Link to="/rooms" className="featured-link">
              <span>View All Rooms</span>
              <ChevronRight size={20} />
            </Link>
          }
        />
        <div className="room-grid public-room-grid">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} action={<Link className="primary-button wide" to="/rooms">Book Now</Link>} />
          ))}
        </div>
      </section>
    </main>
  );
}

function AboutPage() {
  const highlights = [
    {
      icon: BedDouble,
      title: 'Comfort-first rooms',
      text: 'Thoughtfully prepared rooms with clean layouts, modern amenities, and a calm atmosphere for rest or work.'
    },
    {
      icon: Utensils,
      title: 'Responsive room service',
      text: 'Fresh meals, quick kitchen coordination, and service flows that keep dining easy throughout the day.'
    },
    {
      icon: Shield,
      title: 'Reliable hospitality operations',
      text: 'Smooth booking, faster check-in support, and dependable service tracking across your stay.'
    },
    {
      icon: Users,
      title: 'A helpful on-site team',
      text: 'Front desk, housekeeping, and kitchen staff work together to keep every guest experience warm and consistent.'
    }
  ];

  return (
    <main className="about-page">
      <section className="public-section about-hero-section">
        <section
          className="about-hero"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(10, 22, 56, .86) 0%, rgba(10, 22, 56, .7) 44%, rgba(10, 22, 56, .38) 100%), url(${roomImages.login})` }}
        >
          <div className="about-hero-copy">
            <span className="about-kicker">About Utkal Reserve</span>
            <h1>Hospitality that feels warm, polished, and dependable from arrival to checkout.</h1>
            <p>Utkal Reserve was built around one simple promise: make every stay feel easy, welcoming, and well cared for. From room comfort to service response, we focus on the details that guests remember.</p>
            <div className="about-address-card">
              <strong>Address</strong>
              <span>Delta Square, Baramunda, Bhubaneswar, Khordha, PIN - 751003</span>
            </div>
            <div className="hero-actions">
              <Link to="/rooms" className="hero-primary-button">Explore Rooms</Link>
              <Link to="/register" className="hero-secondary-button">Plan Your Stay</Link>
            </div>
          </div>
        </section>
      </section>

      <section className="public-section about-story-section">
        <div className="about-story-grid">
          <div className="about-story-copy">
            <span className="about-section-label">Our Story</span>
            <h2>Your Stay, Our Priority</h2>
            <p>We designed Utkal Reserve for business travelers, families, and guests who want a stay that feels organized without feeling rigid. That means better room readiness, attentive support, and a guest journey that stays clear from booking to departure.</p>
            <p>Whether you are staying one night or several, our goal is the same: give you a space that feels comfortable, a team that feels responsive, and service that feels effortless.</p>
          </div>
          <div className="about-story-card">
            <div className="about-story-stat">
              <strong>24/7</strong>
              <span>Front desk and guest support coordination</span>
            </div>
            <div className="about-story-stat">
              <strong>Room Service</strong>
              <span>Fresh menu delivery tracked from kitchen to room</span>
            </div>
            <div className="about-story-stat">
              <strong>Clean Stays</strong>
              <span>Housekeeping activity monitored with room-level history</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section about-highlights-section">
        <PageHeader title="What Guests Can Expect" subtitle="A stay experience shaped around comfort, speed, and thoughtful service." />
        <div className="about-feature-grid">
          {highlights.map(({ icon: Icon, title, text }) => (
            <article className="about-feature-card" key={title}>
              <span className="about-feature-icon">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section about-cta-section">
        <div className="about-cta-card">
          <div>
            <span className="about-section-label">Ready To Book</span>
            <h2>Choose a room that fits your next stay.</h2>
            <p>Browse available rooms, compare room types, and book directly through Utkal Reserve.</p>
          </div>
          <div className="about-cta-actions">
            <Link to="/rooms" className="primary-button">Browse Rooms</Link>
            <Link to="/login" className="outline-button">Guest Login</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PublicRoomsPage() {
  const { data, error } = useLoad('/public/rooms', { rooms: fallbackRooms });
  const rooms = data?.rooms?.length ? data.rooms : fallbackRooms;
  return (
    <main className="public-section public-rooms-page">
      <PageHeader className="public-rooms-header" title="Our Luxurious Accommodations" subtitle="Choose from our wide range of rooms and suites designed for comfort." />
      {error && <div className="notice warning">{error}</div>}
      <div className="room-grid public-room-grid">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            action={<Link className="outline-button wide" to="/guest/book-room">Check Availability</Link>}
          />
        ))}
      </div>
    </main>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const notice = getBlockNotice();
    if (notice) {
      setError(notice);
      setBlockNotice('');
    }
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const user = await login(form.identifier, form.password);
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card auth-login-card">
        <div className="auth-art auth-login-art" style={{ backgroundImage: `linear-gradient(rgba(31, 41, 120, .26), rgba(31, 41, 120, .5)), url(${roomImages.login})` }}>
          <span className="auth-badge"><Sparkles size={14} /> Premium Member Access</span>
          <Hotel />
          <h2>Welcome Back</h2>
          <p>Your Stay, Our Priority</p>
          <div className="auth-art-copy">
            <span>Manage your stay, bookings, dining, and profile from one polished dashboard.</span>
          </div>
          <div className="auth-art-metrics">
            <div className="auth-metric">
              <strong>24/7</strong>
              <span>Guest support</span>
            </div>
            <div className="auth-metric">
              <strong>Fast</strong>
              <span>Room booking flow</span>
            </div>
            <div className="auth-metric">
              <strong>Live</strong>
              <span>Service updates</span>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="auth-form auth-login-form">
          <span className="auth-form-kicker">Member Login</span>
          <h1>Sign in to Utkal Reserve</h1>
          <p>Staff and guests can continue their stay journey here with secure access.</p>
          {error && <div className="notice danger">{error}</div>}
          <label className="auth-field">
            <span>Username or email</span>
            <div className="auth-input-shell">
              <UserRound size={18} />
              <input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} required />
            </div>
          </label>
          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-shell">
              <Lock size={18} />
              <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label className="check-row auth-check-row">
            <input type="checkbox" />
            <span>Remember me</span>
          </label>
          <button className="primary-button wide auth-submit-button">Sign In</button>
          <small className="auth-footer-note">Not a member? <Link to="/register">Create an account</Link></small>
        </form>
      </section>
    </main>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', phone: '', address: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const registerFields = [
    { key: 'firstName', label: 'First Name', icon: UserRound, type: 'text', required: true },
    { key: 'lastName', label: 'Last Name', icon: UserRound, type: 'text', required: false },
    { key: 'username', label: 'Username', icon: UserRound, type: 'text', required: true },
    { key: 'email', label: 'Email Address', icon: Mail, type: 'email', required: true },
    { key: 'phone', label: 'Mobile Number', icon: Phone, type: 'text', required: false },
    { key: 'address', label: 'Address', icon: Building2, type: 'text', required: false }
  ];

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const user = await register({
        ...form,
        phone: form.phone ? `+91${form.phone}` : ''
      });
      navigate(dashboardPath(user.role));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card auth-register-card">
        <div className="auth-art auth-register-art" style={{ backgroundImage: `linear-gradient(rgba(26, 35, 120, .22), rgba(26, 35, 120, .52)), url(${roomImages.hero})` }}>
          <span className="auth-badge"><CheckCircle2 size={14} /> Create Your Member Profile</span>
          <Hotel />
          <h2>Stay With Confidence</h2>
          <p>Your Stay, Our Priority</p>
          <div className="auth-art-copy">
            <span>Unlock direct room booking, room service ordering, and a smoother stay experience with one account.</span>
          </div>
          <div className="auth-art-metrics">
            <div className="auth-metric">
              <strong>Book</strong>
              <span>Rooms faster</span>
            </div>
            <div className="auth-metric">
              <strong>Track</strong>
              <span>Orders & stays</span>
            </div>
            <div className="auth-metric">
              <strong>Enjoy</strong>
              <span>Member convenience</span>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="auth-form auth-register-form">
          <span className="auth-form-kicker">Create Account</span>
          <h1>Join Utkal Reserve</h1>
          <p>Reserve rooms, order food, and manage your stay from one beautifully simple account.</p>
          {error && <div className="notice danger">{error}</div>}
          <div className="auth-form-grid">
            {registerFields.map(({ key, label, icon: Icon, type, required }) => (
              <label key={key} className={`auth-field ${key === 'address' ? 'auth-field-full' : ''}`.trim()}>
                <span>{label}</span>
                <div className={`auth-input-shell ${key === 'phone' ? 'auth-phone-shell' : ''}`.trim()}>
                  <Icon size={18} />
                  {key === 'phone' && <span className="auth-prefix">+91</span>}
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({
                      ...form,
                      [key]: key === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
                    })}
                    required={required}
                    inputMode={key === 'phone' ? 'numeric' : undefined}
                    maxLength={key === 'phone' ? 10 : undefined}
                    pattern={key === 'phone' ? '[0-9]{10}' : undefined}
                    placeholder={key === 'phone' ? '9876543210' : undefined}
                  />
                </div>
              </label>
            ))}
            <label className="auth-field auth-field-full">
              <span>Password</span>
              <div className="auth-input-shell">
                <Lock size={18} />
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          </div>
          <button className="primary-button wide auth-submit-button">Create Account</button>
          <small className="auth-footer-note">Already have an account? <Link to="/login">Sign in here</Link></small>
        </form>
      </section>
    </main>
  );
}

function AdminDashboard() {
  const { data, error } = useLoad('/admin/overview', {
    stats: { totalRevenue: 0, roomsAvailable: 0, occupancyRate: 0, activeGuests: 0 },
    revenueTrend: [],
    roomPopularity: []
  }, { refreshMs: 15000 });
  const { data: command } = useLoad('/admin/command-center', {
    notifications: [],
    searchIndex: [],
    live: { pendingBookings: 0, dirtyRooms: 0, readyOrders: 0, arrivalsToday: 0, departuresToday: 0 }
  }, { refreshMs: 15000 });
  const colors = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981'];
  const quickActions = [
    { label: 'Review Arrivals', value: command.live.arrivalsToday, route: '/admin/bookings' },
    { label: 'Inspect Dirty Rooms', value: command.live.dirtyRooms, route: '/admin/rooms' },
    { label: 'Check Ready Orders', value: command.live.readyOrders, route: '/admin/kitchen/monitor' }
  ];
  const revenuePeak = data.revenueTrend.reduce((best, item) => item.revenue > best.revenue ? item : best, { name: '-', revenue: 0 });
  const roomPopularityTotal = data.roomPopularity.reduce((total, item) => total + item.value, 0);

  return (
    <>
      <PageHeader title="Performance Overview" subtitle="One screen for revenue, occupancy, and room trends." action={<button className="dashboard-period-chip">Last 7 Days</button>} />
      {error && <div className="notice danger">{error}</div>}
      <div className="dashboard-grid dark-grid">
        <StatCard icon={Shield} label="Total Revenue" value={money(data.stats.totalRevenue)} hint="All completed bills" />
        <StatCard icon={BedDouble} label="Rooms Available" value={data.stats.roomsAvailable} hint="Ready for booking" />
        <StatCard icon={BarChart3} label="Occupancy Rate" value={`${data.stats.occupancyRate}%`} hint="Currently occupied" />
        <StatCard icon={Users} label="Active Guests" value={data.stats.activeGuests} hint="Checked in today" />
      </div>
      <div className="admin-dashboard-upper">
        <section className="chart-panel dark-panel admin-command-panel">
          <div className="admin-command-copy">
            <span className="soft-badge">Command Center</span>
            <h2>Keep front office, rooms, and kitchen moving from one place.</h2>
            <p>These live operational checkpoints help the admin desk react faster without leaving the dashboard.</p>
          </div>
          <div className="admin-command-grid">
            {quickActions.map((item) => (
              <Link key={item.label} to={item.route} className="admin-quick-card">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="chart-panel dark-panel admin-alerts-panel">
          <div className="admin-alerts-head">
            <h2>Live Alerts</h2>
            <small>{command.notifications.length} active items</small>
          </div>
          <div className="admin-alerts-list">
            {(command.notifications.length ? command.notifications : [{ id: 'clear', title: 'Operations are clear', message: 'No urgent admin issues are waiting right now.', route: '/admin', createdAt: new Date().toISOString() }]).slice(0, 4).map((item) => (
              <Link key={item.id} to={item.route} className="admin-alert-item">
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.message}</small>
                </div>
                <span>{timeAgoText(item.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <AdminSystemControls />
      <div className="chart-layout">
        <section className="chart-panel dark-panel chart-panel-rich">
          <div className="chart-panel-head">
            <div>
              <h2>Revenue Trends</h2>
              <p>Peak month: {revenuePeak.name} with {money(revenuePeak.revenue)}</p>
            </div>
            <div className="chart-insight-strip">
              <span className="chart-insight-chip">Live income view</span>
              <span className="chart-insight-chip">Seven month sweep</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.revenueTrend}>
              <defs>
                <linearGradient id="revenue" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.95} />
                  <stop offset="45%" stopColor="#60a5fa" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c2944" strokeDasharray="4 10" vertical={false} />
              <XAxis dataKey="name" stroke="#8aa4c2" axisLine={false} tickLine={false} />
              <YAxis stroke="#8aa4c2" axisLine={false} tickLine={false} tickFormatter={(value) => `$${Math.round(value)}`} />
              <Tooltip
                cursor={{ stroke: '#38bdf8', strokeOpacity: 0.35, strokeWidth: 1 }}
                contentStyle={{ background: '#0f1a30', border: '1px solid rgba(125, 211, 252, .18)', borderRadius: 14, boxShadow: '0 18px 30px rgba(8, 47, 73, .24)' }}
                labelStyle={{ color: '#dbeafe', fontWeight: 800 }}
                itemStyle={{ color: '#7dd3fc' }}
                formatter={(value) => [money(value), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={3} fill="url(#revenue)" activeDot={{ r: 6, fill: '#ffffff', stroke: '#38bdf8', strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
        <section className="chart-panel dark-panel chart-panel-rich">
          <div className="chart-panel-head">
            <div>
              <h2>Room Popularity</h2>
              <p>{roomPopularityTotal} total tracked bookings across room types.</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.roomPopularity}
                dataKey="value"
                nameKey="name"
                innerRadius={76}
                outerRadius={114}
                paddingAngle={4}
                stroke="#101827"
                strokeWidth={4}
                labelLine={false}
                label={renderPieLabel}
              >
                {data.roomPopularity.map((_entry, index) => <Cell key={index} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f1a30', border: '1px solid rgba(125, 211, 252, .18)', borderRadius: 14, boxShadow: '0 18px 30px rgba(8, 47, 73, .24)' }}
                labelStyle={{ color: '#dbeafe', fontWeight: 800 }}
                itemStyle={{ color: '#c4b5fd' }}
                formatter={(value, _name, item) => [`${value} bookings`, item?.payload?.name || 'Room']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="popularity-legend">
            {data.roomPopularity.map((item, index) => (
              <div key={item.name} className="popularity-legend-item">
                <span className="popularity-swatch" style={{ background: colors[index % colors.length] }} />
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.value} bookings</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="admin-dashboard-lower">
        <section className="chart-panel dark-panel admin-ops-panel">
          <div className="admin-alerts-head">
            <h2>Today at a Glance</h2>
            <small>Live operating signals</small>
          </div>
          <div className="admin-ops-grid">
            <article className="admin-ops-card">
              <span>Pending Bookings</span>
              <strong>{command.live.pendingBookings}</strong>
            </article>
            <article className="admin-ops-card">
              <span>Arrivals Today</span>
              <strong>{command.live.arrivalsToday}</strong>
            </article>
            <article className="admin-ops-card">
              <span>Departures Today</span>
              <strong>{command.live.departuresToday}</strong>
            </article>
            <article className="admin-ops-card">
              <span>Ready Orders</span>
              <strong>{command.live.readyOrders}</strong>
            </article>
          </div>
        </section>
      </div>
    </>
  );
}

function AdminSystemControls() {
  const { data, load, error } = useLoad('/admin/system-controls', {
    panelLocks: Object.fromEntries(managedPanelRoles.map((role) => [role, { blocked: false, reason: '', updatedAt: null }])),
    alerts: []
  }, { refreshMs: 15000 });
  const [roleReasons, setRoleReasons] = useState(() => Object.fromEntries(managedPanelRoles.map((role) => [role, ''])));
  const [workingRole, setWorkingRole] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [alertForm, setAlertForm] = useState({
    title: '',
    message: '',
    severity: 'info',
    roles: [...managedPanelRoles]
  });

  useEffect(() => {
    setRoleReasons(Object.fromEntries(managedPanelRoles.map((role) => [role, data.panelLocks?.[role]?.reason || ''])));
  }, [data.panelLocks]);

  const updateRoleLock = async (role, blocked) => {
    setWorkingRole(role);
    setActionError('');
    setNotice('');
    try {
      const result = await api(`/admin/system-controls/roles/${role}`, {
        method: 'PATCH',
        body: { blocked, reason: roleReasons[role] || '' }
      });
      setNotice(`${panelRoleLabel(role)} is now ${result.panelLock.blocked ? 'blocked' : 'active'}.`);
      await load();
    } catch (err) {
      setActionError(err.message || 'Unable to update this panel right now.');
    } finally {
      setWorkingRole('');
    }
  };

  const toggleAlertRole = (role) => {
    setAlertForm((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role]
    }));
  };

  const sendAlert = async (event) => {
    event.preventDefault();
    setAlertBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api('/admin/system-controls/alerts', {
        method: 'POST',
        body: alertForm
      });
      setAlertForm({
        title: '',
        message: '',
        severity: 'info',
        roles: [...managedPanelRoles]
      });
      setNotice('Broadcast alert sent to the selected panels.');
      await load();
    } catch (err) {
      setActionError(err.message || 'Unable to send this alert right now.');
    } finally {
      setAlertBusy(false);
    }
  };

  const dismissAlert = async (alertId) => {
    setActionError('');
    setNotice('');
    try {
      await api(`/admin/system-controls/alerts/${alertId}`, {
        method: 'PATCH',
        body: { active: false }
      });
      setNotice('Alert dismissed from all receiving panels.');
      await load();
    } catch (err) {
      setActionError(err.message || 'Unable to dismiss this alert.');
    }
  };

  return (
    <section className="admin-system-grid">
      <section className="chart-panel dark-panel admin-panel-locks">
        <div className="admin-alerts-head">
          <div>
            <h2>Panel Control</h2>
            <small>Block or reopen the operational dashboards managed by admin.</small>
          </div>
          <span className="soft-badge">{managedPanelRoles.length} managed panels</span>
        </div>
        {error && <div className="notice danger">{error}</div>}
        {actionError && <div className="notice danger">{actionError}</div>}
        {notice && <div className="notice success">{notice}</div>}
        <div className="admin-panel-lock-grid">
          {managedPanelRoles.map((role) => {
            const lock = data.panelLocks?.[role] || { blocked: false, reason: '', updatedAt: null };
            const busy = workingRole === role;
            return (
              <article key={role} className={`admin-panel-lock-card ${lock.blocked ? 'blocked' : 'live'}`}>
                <div className="admin-panel-lock-head">
                  <div>
                    <strong>{panelRoleLabel(role)}</strong>
                    <small>{lock.blocked ? 'Access is currently blocked' : 'Panel is currently live'}</small>
                  </div>
                  <StatusPill status={lock.blocked ? 'cancelled' : 'completed'} label={lock.blocked ? 'Blocked' : 'Active'} />
                </div>
                <Field label="Block Reason">
                  <textarea
                    rows={2}
                    value={roleReasons[role] || ''}
                    onChange={(event) => setRoleReasons((current) => ({ ...current, [role]: event.target.value }))}
                    placeholder={`Optional reason for ${panelRoleLabel(role)}`}
                  />
                </Field>
                <div className="admin-panel-lock-meta">
                  <small>{lock.updatedAt ? `Last updated ${timeAgoText(lock.updatedAt)}` : 'No admin override yet.'}</small>
                </div>
                <div className="admin-panel-lock-actions">
                  <button
                    type="button"
                    className={lock.blocked ? 'ghost-button' : 'primary-button danger-button'}
                    onClick={() => updateRoleLock(role, !lock.blocked)}
                    disabled={busy}
                  >
                    {busy ? 'Saving...' : lock.blocked ? 'Unblock Panel' : 'Block Panel'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="chart-panel dark-panel admin-broadcast-panel">
        <div className="admin-alerts-head">
          <div>
            <h2>Broadcast Alerts</h2>
            <small>Send a live alert that appears across the selected dashboards.</small>
          </div>
          <span className="soft-badge">{data.alerts.filter((alert) => alert.active !== false).length} active</span>
        </div>
        <form className="admin-broadcast-form" onSubmit={sendAlert}>
          <div className="admin-broadcast-grid">
            <Field label="Alert Title">
              <input value={alertForm.title} onChange={(event) => setAlertForm((current) => ({ ...current, title: event.target.value }))} required />
            </Field>
            <Field label="Severity">
              <select value={alertForm.severity} onChange={(event) => setAlertForm((current) => ({ ...current, severity: event.target.value }))}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Alert Message" className="admin-broadcast-wide">
              <textarea rows={3} value={alertForm.message} onChange={(event) => setAlertForm((current) => ({ ...current, message: event.target.value }))} required />
            </Field>
          </div>
          <div className="admin-broadcast-roles">
            {managedPanelRoles.map((role) => (
              <label key={role} className={`admin-role-chip ${alertForm.roles.includes(role) ? 'selected' : ''}`.trim()}>
                <input type="checkbox" checked={alertForm.roles.includes(role)} onChange={() => toggleAlertRole(role)} />
                <span>{panelRoleLabel(role)}</span>
              </label>
            ))}
          </div>
          <div className="admin-broadcast-actions">
            <button className="primary-button" disabled={alertBusy}>{alertBusy ? 'Sending...' : 'Send Alert'}</button>
          </div>
        </form>
        <div className="admin-broadcast-history">
          {data.alerts.length ? data.alerts.slice(0, 6).map((alert) => (
            <article key={alert.id} className={`admin-alert-history-card severity-${alert.severity || 'info'} ${alert.active === false ? 'inactive' : ''}`.trim()}>
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.message}</small>
                <span>{Array.isArray(alert.roles) ? alert.roles.map(panelRoleLabel).join(', ') : 'All panels'} · {timeAgoText(alert.createdAt)}</span>
              </div>
              {alert.active !== false && (
                <button type="button" className="ghost-button" onClick={() => dismissAlert(alert.id)}>
                  Dismiss
                </button>
              )}
            </article>
          )) : <EmptyState title="No admin alerts yet" text="Broadcast notices sent from admin will appear here for quick follow-up." />}
        </div>
      </section>
    </section>
  );
}

const staffBlank = { firstName: '', lastName: '', username: '', idCardNumber: '', email: '', phone: '', avatar: '', role: 'frontdesk', jobTitle: '', salary: '', experience: '', password: '', confirmPassword: '' };

function StaffManagement() {
  const { pathname } = useLocation();
  const { staffId } = useParams();
  const navigate = useNavigate();
  const addMode = pathname.endsWith('/add');
  const editMode = Boolean(staffId);
  const { data, load, error } = useLoad('/admin/staff', { staff: [] }, { refreshMs: 15000 });
  const [form, setForm] = useState(staffBlank);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const selectedStaff = editMode ? data.staff.find((entry) => entry.id === staffId) : null;

  useEffect(() => {
    if (addMode) {
      setForm(staffBlank);
      setConfirmPassword('');
      setFormError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      return;
    }
    if (editMode && selectedStaff) {
      setForm({ ...staffBlank, ...selectedStaff, password: '', confirmPassword: '', idCardNumber: '' });
      setConfirmPassword('');
      setFormError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [addMode, editMode, selectedStaff?.id]);

  const readAvatarFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatar: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const setAvatarFromFile = (event) => {
    readAvatarFile(event.target.files?.[0]);
  };

  const onAvatarDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    readAvatarFile(event.dataTransfer.files?.[0]);
  };

  const updatePhone = (value) => setForm((current) => ({ ...current, phone: String(value || '').replace(/\D/g, '').slice(0, 10) }));

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    const payload = { ...form };
    payload.phone = String(payload.phone || '').replace(/\D/g, '').slice(0, 10);
    if (addMode) {
      if (!payload.avatar) {
        setFormError('Profile picture is required.');
        return;
      }
      if (!payload.phone || payload.phone.length !== 10) {
        setFormError('Mobile number must be exactly 10 digits.');
        return;
      }
      if (!payload.password || !confirmPassword) {
        setFormError('Please fill out the password fields.');
        return;
      }
      if (payload.password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      if (!payload.username || !payload.firstName || !payload.lastName || !payload.email || !payload.role || !payload.idCardNumber || String(form.salary).trim() === '' || String(form.experience).trim() === '') {
        setFormError('Please complete every field before creating the employee.');
        return;
      }
    }
    payload.salary = Number(payload.salary || 0);
    payload.experience = Number(payload.experience || 0);
    if (!payload.username && payload.idCardNumber) {
      payload.username = payload.idCardNumber;
    }
    payload.username = String(payload.username || '').toLowerCase().trim();
    if (!payload.password) delete payload.password;
    delete payload.confirmPassword;
    delete payload.idCardNumber;
    payload.jobTitle = payload.jobTitle || staffRoleLabel(payload.role);
    await api(editMode ? `/admin/staff/${staffId}` : '/admin/staff', { method: editMode ? 'PUT' : 'POST', body: payload });
    await load();
    navigate('/admin/staff');
  };

  const edit = (staff) => {
    navigate(`/admin/staff/${staff.id}/edit`);
  };

  if (addMode) {
    return (
      <section className="admin-page staff-page staff-create-page">
        <PageHeader
          title="Add New Employee"
          subtitle="Create accounts for Receptionists, Kitchen Staff, etc."
          action={<Link className="ghost-button staff-back-button" to="/admin/staff"><ChevronLeft size={16} /> Back</Link>}
        />
        {error && <div className="notice danger">{error}</div>}
        {formError && <div className="notice danger">{formError}</div>}
        <section className="staff-form-shell staff-create-shell">
          <div className="staff-form-strip" />
          <form
            className="staff-form-stack staff-create-stack"
            onSubmit={submit}
          >
            <section className="staff-section">
              <h2><Lock size={18} /> Account Credentials</h2>
              <div className="staff-grid staff-grid-2 staff-create-grid">
                <Field label="Username">
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                </Field>
                <Field label="Password">
                  <div className="staff-password-wrap">
                    <input className="staff-password-input" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="new-password" />
                    <button type="button" className="staff-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password" className="staff-confirm-field">
                  <div className="staff-password-wrap">
                    <input className="staff-password-input" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                    <button type="button" className="staff-password-toggle" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
              </div>
            </section>

            <section className="staff-section">
              <h2><UserRound size={18} /> Personal Information</h2>
              <div className="staff-grid staff-grid-2 staff-create-grid">
                <Field label="First Name">
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </Field>
                <Field label="Last Name">
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </Field>
                <Field label="Email Address">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label="Mobile Number">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    title="Enter exactly 10 digits"
                    value={form.phone}
                    onChange={(e) => updatePhone(e.target.value)}
                    required
                  />
                </Field>
              </div>
            </section>

            <section className="staff-section">
              <h2><Briefcase size={18} /> Job Details</h2>
              <div className="staff-grid staff-grid-2 staff-create-grid">
                <Field label="Job Role">
                  <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, jobTitle: form.jobTitle || staffRoleLabel(e.target.value) })}>
                    <option value="frontdesk">Receptionist</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="housekeeping">Housekeeping</option>
                    <option value="admin">Admin Manager</option>
                  </select>
                </Field>
                <Field label="Monthly Salary ($)">
                  <input type="number" min="0" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} required />
                </Field>
                <Field label="ID Card Number">
                  <input value={form.idCardNumber} onChange={(e) => setForm({ ...form, idCardNumber: e.target.value })} required />
                </Field>
                <Field label="Experience (Years)">
                  <input type="number" min="0" step="1" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} required />
                </Field>
              </div>
            </section>

            <section className="staff-section">
              <h2><Upload size={18} /> Profile Picture</h2>
              <label
                className={`staff-dropzone ${dragActive ? 'is-active' : ''}`}
                onDragEnter={() => setDragActive(true)}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onAvatarDrop}
              >
                <Upload size={34} />
                <span>Click to upload or drag and drop</span>
                <input type="file" accept="image/*" onChange={setAvatarFromFile} />
              </label>
            </section>

            <div className="staff-editor-actions staff-editor-actions-bottom staff-create-actions">
              <button className="primary-button">Create Employee</button>
            </div>
          </form>
        </section>
      </section>
    );
  }

  if (editMode) {
    return (
      <section className="admin-page staff-page staff-editor-page">
        <PageHeader
          title="Edit Employee"
          subtitle={<>Update details for <span className="staff-accent-name">{selectedStaff?.firstName || form.firstName || 'employee'}</span></>}
          action={<Link className="ghost-button staff-back-button" to="/admin/staff"><ChevronLeft size={16} /> Back to List</Link>}
        />
        {error && <div className="notice danger">{error}</div>}
        <section className="staff-form-shell">
          <div className="staff-form-strip" />
          <form className="staff-form-stack" onSubmit={submit}>
            <section className="staff-section">
              <h2><UserRound size={18} /> Personal Information</h2>
              <div className="staff-grid staff-grid-2">
                <Field label="First Name">
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                </Field>
                <Field label="Last Name">
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label="Mobile">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
            </section>

            <section className="staff-section">
              <h2><Briefcase size={18} /> Job & Salary</h2>
              <div className="staff-grid staff-grid-2">
                <Field label="Job Role">
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, jobTitle: form.jobTitle || staffRoleLabel(e.target.value) })}>
                    <option value="frontdesk">Receptionist</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="housekeeping">Housekeeping</option>
                    <option value="admin">Admin Manager</option>
                  </select>
                </Field>
                <Field label="Salary ($)">
                  <input type="number" step="0.01" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
                </Field>
                <Field label="ID Card No">
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required={!editMode} />
                </Field>
                <Field label="Experience (Years)">
                  <input type="number" step="1" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
                </Field>
              </div>
            </section>

            <section className="staff-section">
              <h2><Upload size={18} /> Update Profile Picture</h2>
              <div className="staff-upload-box">
                <div className="staff-upload-avatar">
                  {staffAvatarUrl(form)
                    ? <img src={staffAvatarUrl(form)} alt={form.firstName || 'Employee'} />
                    : <span>{initialsFromPerson(form)}</span>}
                </div>
                <div className="staff-upload-copy">
                  <label className="staff-file-trigger">
                    <Upload size={15} />
                    Choose file
                    <input type="file" accept="image/*" onChange={setAvatarFromFile} />
                  </label>
                  <p>PNG, JPG, or WEBP. Use a clear portrait so the staff card feels like the reference.</p>
                </div>
              </div>
            </section>

            <div className="staff-editor-actions staff-editor-actions-bottom">
              <button className="ghost-button" type="button" onClick={() => navigate('/admin/staff')}>Cancel</button>
              <button className="primary-button">Save Changes</button>
            </div>
          </form>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-page staff-page">
      <PageHeader title="Staff Management" subtitle="View and manage all hotel employees." action={<Link className="primary-button staff-add-button" to="/admin/staff/add"><Plus size={16} /> Add New Employee</Link>} />
      {error && <div className="notice danger">{error}</div>}
      <TableShell className="staff-table-shell">
        <thead><tr><th>Employee</th><th>Role</th><th>Contact</th><th>Salary</th><th>EXP (YRS)</th><th>Actions</th></tr></thead>
        <tbody>
          {data.staff.map((staff) => (
            <tr key={staff.id} className="staff-row">
              <td className="staff-employee-cell">
                <span className="staff-avatar">
                  {staffAvatarUrl(staff)
                    ? <img src={staffAvatarUrl(staff)} alt={`${staff.firstName} ${staff.lastName}`} />
                    : <span>{initialsFromPerson(staff)}</span>}
                </span>
                <span className="staff-employee-copy">
                  <strong>{staff.firstName} {staff.lastName}</strong>
                  <small>ID: {staff.username || staff.id}</small>
                </span>
              </td>
              <td><StatusPill status={staff.role} label={staffRoleLabel(staff.role)} /></td>
              <td className="staff-contact-cell">
                <span><Phone size={14} /> {staff.phone}</span>
                <small><Mail size={14} /> {staff.email}</small>
              </td>
              <td>{money(staff.salary)}</td>
              <td>{staff.experience}</td>
              <td className="table-actions staff-actions">
                <button type="button" className="staff-icon-button edit" onClick={() => edit(staff)}><Edit size={15} /></button>
                <button type="button" className="staff-icon-button delete" onClick={async () => { await api(`/admin/staff/${staff.id}`, { method: 'DELETE' }); load(); }}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </section>
  );
}

function StaffCleaningHistory() {
  const { data } = useLoad('/housekeeping/history', { logs: [] }, { refreshMs: 15000 });
  const historyLogs = data.logs || [];
  return (
    <section className="admin-page staff-page staff-history-page">
      <PageHeader
        title="Cleaning History"
        subtitle="Audit log of all room cleaning activities."
      />
      <TableShell className="staff-history-shell">
        <thead><tr><th>Date &amp; Time</th><th>Room</th><th>Housekeeper</th><th>Verification</th></tr></thead>
        <tbody>
          {historyLogs.map((log) => (
            <tr key={log.id}>
              <td className="history-date-cell">
                <strong>{dateText(log.completedAt)}</strong>
                <small>{timeText(log.completedAt)}</small>
              </td>
              <td>
                <span className="history-room-chip">Room {log.room?.number || '-'}</span>
              </td>
              <td className="history-housekeeper-cell">
                <span className="history-housekeeper-avatar">
                  {log.housekeeper?.avatar
                    ? <img src={log.housekeeper.avatar} alt={`${log.housekeeper?.firstName || 'Housekeeper'} ${log.housekeeper?.lastName || ''}`} />
                    : <span>{initialsFromPerson(log.housekeeper)}</span>}
                </span>
                <strong>{log.housekeeper?.firstName} {log.housekeeper?.lastName}</strong>
              </td>
              <td>
                <span className={`status-pill history-status-pill ${log.verified ? 'status-completed' : 'status-pending'}`}>
                  {log.verified ? <CheckCircle2 size={14} /> : <Shield size={14} />}
                  {log.verified ? 'Verified' : 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </section>
  );
}

function timeText(value) {
  return value
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value))
    : '-';
}

function monthDayText(value) {
  return value
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' }).format(new Date(value))
    : '-';
}

function militaryTimeText(value) {
  return value
    ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
    : '-';
}

function invoiceFilename(invoice) {
  const guestName = `${invoice?.booking?.guest?.firstName || ''} ${invoice?.booking?.guest?.lastName || ''}`.trim() || 'guest';
  const guestSlug = guestName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
  const roomNumber = invoice?.booking?.room?.number || 'room';
  return `utkal-reserve-invoice-room-${roomNumber}-${guestSlug}.pdf`;
}

function invoiceLineItems(invoice) {
  const roomType = invoice?.booking?.room?.type || 'Room';
  const nights = Number(invoice?.nights || 0);
  const roomRate = Number(invoice?.booking?.roomRate || 0);
  const roomTotal = Number(invoice?.roomTotal || 0);
  const roomLine = {
    description: `Room Charges (${roomType})`,
    quantity: `${nights} night${nights === 1 ? '' : 's'}`,
    unitPrice: roomRate,
    amount: roomTotal
  };

  const orderLines = (invoice?.orders || []).map((order, index) => {
    const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0) || 1;
    const itemLabel = (order.items || [])
      .map((item) => `${item.name}${Number(item.quantity || 1) > 1 ? ` x${item.quantity}` : ''}`)
      .join(', ') || `Room Service ${index + 1}`;

    return {
      description: `Room Service: ${itemLabel}`,
      quantity: `${itemCount} item${itemCount === 1 ? '' : 's'}`,
      unitPrice: Number(order.total || 0),
      amount: Number(order.total || 0)
    };
  });

  return [roomLine, ...orderLines];
}

async function downloadInvoiceDocument(invoice) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const palette = {
    ink: [15, 23, 42],
    heading: [30, 41, 59],
    muted: [100, 116, 139],
    line: [226, 232, 240],
    card: [248, 250, 252],
    blue: [41, 82, 225],
    cyan: [30, 197, 234],
    pink: [244, 114, 182],
    gold: [251, 191, 36],
    paidBg: [217, 249, 157],
    paidText: [63, 98, 18],
    pendingBg: [255, 244, 214],
    pendingText: [180, 83, 9]
  };

  const guestName = `${invoice?.booking?.guest?.firstName || ''} ${invoice?.booking?.guest?.lastName || ''}`.trim() || 'Guest';
  const roomNumber = invoice?.booking?.room?.number || '-';
  const roomType = invoice?.booking?.room?.type || 'Room';
  const guestEmail = invoice?.booking?.guest?.email || '-';
  const guestPhone = invoice?.booking?.guest?.phone || '-';
  const statusPaid = invoice?.booking?.status === 'completed';
  const statusLabel = statusPaid ? 'PAID' : 'PENDING';
  const issueDate = dateText(new Date());
  const lineItems = invoiceLineItems(invoice);
  const subtotal = Number(invoice?.roomTotal || 0) + Number(invoice?.foodTotal || 0);
  const taxTotal = Number(invoice?.taxTotal || 0);
  const grandTotal = Number(invoice?.grandTotal || 0);
  const stayDates = `${dateText(invoice?.booking?.checkIn)} - ${dateText(invoice?.booking?.checkOut)}`;
  const paymentLabel = invoice?.booking?.paymentMethod || (statusPaid ? 'Settled at front desk' : 'Pending confirmation');
  let y = margin;

  const setColor = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const writeText = (text, x, top, options = {}) => {
    doc.setFont('helvetica', options.weight || 'normal');
    doc.setFontSize(options.size || 12);
    setColor(options.color || palette.ink);
    doc.text(Array.isArray(text) ? text : String(text), x, top, {
      align: options.align || 'left',
      maxWidth: options.maxWidth
    });
  };

  const drawCard = (x, top, width, height, title, lines) => {
    doc.setFillColor(palette.card[0], palette.card[1], palette.card[2]);
    doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]);
    doc.roundedRect(x, top, width, height, 16, 16, 'FD');
    writeText(title, x + 18, top + 24, { size: 11, weight: 'bold', color: palette.muted });
    let lineY = top + 50;
    lines.forEach((line, index) => {
      writeText(line, x + 18, lineY, {
        size: index === 0 ? 14 : 11,
        weight: index === 0 ? 'bold' : 'normal',
        color: index === 0 ? palette.heading : palette.muted,
        maxWidth: width - 36
      });
      lineY += index === 0 ? 18 : 16;
    });
  };

  const drawTableHeader = (top) => {
    doc.setFillColor(244, 247, 252);
    doc.roundedRect(margin, top, contentWidth, 32, 10, 10, 'F');
    writeText('DESCRIPTION', margin + 14, top + 20, { size: 10, weight: 'bold', color: palette.muted });
    writeText('QTY / DAYS', margin + 302, top + 20, { size: 10, weight: 'bold', color: palette.muted });
    writeText('UNIT PRICE', margin + 392, top + 20, { size: 10, weight: 'bold', color: palette.muted });
    writeText('AMOUNT', pageWidth - margin - 14, top + 20, { size: 10, weight: 'bold', color: palette.muted, align: 'right' });
  };

  const ensureSpace = (required, repeatTableHeader = false) => {
    if (y + required <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
    if (repeatTableHeader) {
      writeText('Invoice Continued', margin, y + 8, { size: 16, weight: 'bold', color: palette.heading });
      y += 24;
      drawTableHeader(y);
      y += 42;
    }
  };

  doc.setFillColor(palette.ink[0], palette.ink[1], palette.ink[2]);
  doc.roundedRect(margin, y, contentWidth, 124, 20, 20, 'F');
  doc.setFillColor(palette.blue[0], palette.blue[1], palette.blue[2]);
  doc.roundedRect(margin + 1.5, y + 1.5, contentWidth * 0.72, 121, 18, 18, 'F');
  doc.setFillColor(palette.cyan[0], palette.cyan[1], palette.cyan[2]);
  doc.roundedRect(pageWidth - margin - 160, y + 1.5, 158.5, 121, 18, 18, 'F');
  doc.setFillColor(palette.pink[0], palette.pink[1], palette.pink[2]);
  doc.rect(margin + 24, y + 105, 210, 4, 'F');
  doc.setFillColor(palette.gold[0], palette.gold[1], palette.gold[2]);
  doc.circle(pageWidth - margin - 42, y + 26, 9, 'F');

  writeText('Utkal Reserve', margin + 24, y + 38, { size: 25, weight: 'bold', color: [255, 255, 255] });
  writeText('Your Stay, Our Priority', margin + 24, y + 58, { size: 12, weight: 'bold', color: [255, 255, 255] });
  writeText('Delta Square, Baramunda, Bhubaneswar, Khordha, PIN - 751003', margin + 24, y + 78, {
    size: 11,
    color: [239, 246, 255],
    maxWidth: 300
  });

  const badgeWidth = statusPaid ? 58 : 78;
  doc.setFillColor(...(statusPaid ? palette.paidBg : palette.pendingBg));
  doc.roundedRect(pageWidth - margin - 136, y + 18, badgeWidth, 24, 12, 12, 'F');
  writeText(statusLabel, pageWidth - margin - 136 + badgeWidth / 2, y + 35, {
    size: 10,
    weight: 'bold',
    color: statusPaid ? palette.paidText : palette.pendingText,
    align: 'center'
  });
  writeText('INVOICE', pageWidth - margin - 24, y + 66, { size: 24, weight: 'bold', color: [255, 255, 255], align: 'right' });
  writeText(`Room ${roomNumber}`, pageWidth - margin - 24, y + 88, { size: 12, weight: 'bold', color: [239, 246, 255], align: 'right' });
  writeText(issueDate, pageWidth - margin - 24, y + 106, { size: 11, color: [239, 246, 255], align: 'right' });

  y += 146;
  const cardWidth = (contentWidth - 16) / 2;
  drawCard(margin, y, cardWidth, 112, 'BILL TO', [guestName, guestEmail, guestPhone]);
  drawCard(margin + cardWidth + 16, y, cardWidth, 112, 'STAY DETAILS', [
    `Room ${roomNumber} - ${roomType}`,
    stayDates,
    `${invoice?.nights || 0} night(s) | ${paymentLabel}`
  ]);

  y += 136;
  writeText('Invoice Summary', margin, y, { size: 18, weight: 'bold', color: palette.heading });
  y += 18;
  writeText('A downloadable PDF copy for guest records and front office reconciliation.', margin, y, {
    size: 11,
    color: palette.muted
  });
  y += 20;

  drawTableHeader(y);
  y += 42;

  lineItems.forEach((item) => {
    const descriptionLines = doc.splitTextToSize(item.description, 270);
    const rowHeight = Math.max(38, 16 + descriptionLines.length * 14);
    ensureSpace(rowHeight + 6, true);
    doc.setDrawColor(palette.line[0], palette.line[1], palette.line[2]);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    writeText(descriptionLines, margin + 14, y + 18, { size: 11, weight: 'bold', color: palette.heading, maxWidth: 270 });
    writeText(item.quantity, margin + 302, y + 18, { size: 11, color: palette.muted, maxWidth: 74 });
    writeText(money(item.unitPrice), margin + 392, y + 18, { size: 11, color: palette.heading, maxWidth: 74 });
    writeText(money(item.amount), pageWidth - margin - 14, y + 18, { size: 11, weight: 'bold', color: palette.heading, align: 'right' });
    y += rowHeight;
  });

  y += 20;
  ensureSpace(134);
  const totalsWidth = 214;
  const totalsX = pageWidth - margin - totalsWidth;
  doc.setFillColor(238, 244, 255);
  doc.roundedRect(totalsX, y, totalsWidth, 110, 18, 18, 'F');
  doc.setFillColor(255, 241, 248);
  doc.roundedRect(totalsX + totalsWidth - 54, y, 54, 110, 18, 18, 'F');
  writeText('Subtotal', totalsX + 18, y + 26, { size: 11, color: palette.muted, weight: 'bold' });
  writeText(money(subtotal), totalsX + totalsWidth - 18, y + 26, { size: 11, weight: 'bold', color: palette.heading, align: 'right' });
  writeText('Taxes', totalsX + 18, y + 52, { size: 11, color: palette.muted, weight: 'bold' });
  writeText(money(taxTotal), totalsX + totalsWidth - 18, y + 52, { size: 11, weight: 'bold', color: palette.heading, align: 'right' });
  doc.setDrawColor(210, 221, 243);
  doc.line(totalsX + 18, y + 68, totalsX + totalsWidth - 18, y + 68);
  writeText('Total Due', totalsX + 18, y + 92, { size: 13, color: palette.blue, weight: 'bold' });
  writeText(money(grandTotal), totalsX + totalsWidth - 18, y + 92, { size: 20, color: palette.blue, weight: 'bold', align: 'right' });

  writeText(`Payment: ${paymentLabel}`, margin, y + 28, { size: 11, color: palette.muted, weight: 'bold' });
  writeText(`Generated on ${issueDate}`, margin, y + 48, { size: 11, color: palette.muted });
  writeText('Thank you for choosing Utkal Reserve.', margin, y + 80, { size: 14, color: palette.heading, weight: 'bold' });
  writeText('This PDF invoice was generated directly from your live booking and room service data.', margin, y + 100, {
    size: 10,
    color: palette.muted,
    maxWidth: 250
  });

  doc.save(invoiceFilename(invoice));
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.Razorpay || src !== 'https://checkout.razorpay.com/v1/checkout.js') resolve(true);
      else existing.addEventListener('load', () => resolve(true), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load the payment gateway right now.'));
    document.body.appendChild(script);
  });
}

function TableShell({ children, className = '' }) {
  return (
    <div className={`table-shell ${className}`.trim()}>
      <table>{children}</table>
    </div>
  );
}

const roomBlank = { number: '', type: 'Single Room', price: 71, capacity: 1, status: 'available', image: roomImages.single, description: '', amenities: '' };

function AdminRooms() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const addMode = pathname.endsWith('/add');
  const editMode = Boolean(roomId);
  const { data, load, error } = useLoad('/admin/rooms', { rooms: [] }, { refreshMs: 15000 });
  const [form, setForm] = useState(roomBlank);
  const [formError, setFormError] = useState('');
  const selectedRoom = editMode ? data.rooms.find((room) => room.id === roomId) : null;

  useEffect(() => {
    if (addMode) {
      setForm(roomBlank);
      setFormError('');
      return;
    }
    if (editMode && selectedRoom) {
      setForm({ ...roomBlank, ...selectedRoom, amenities: (selectedRoom.amenities || []).join(', ') });
      setFormError('');
    }
  }, [addMode, editMode, selectedRoom?.id]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.number || !form.type || String(form.price).trim() === '' || !form.image || !form.description) {
      setFormError('Please complete the room profile before saving it.');
      return;
    }
    const payload = { ...form, amenities: String(form.amenities || '').split(',').map((item) => item.trim()).filter(Boolean) };
    await api(editMode ? `/admin/rooms/${roomId}` : '/admin/rooms', { method: editMode ? 'PUT' : 'POST', body: payload });
    setForm(roomBlank);
    await load();
    navigate('/admin/rooms');
  };

  const edit = (room) => {
    navigate(`/admin/rooms/${room.id}/edit`);
  };

  if (addMode || editMode) {
    const previewAmenities = String(form.amenities || '').split(',').map((item) => item.trim()).filter(Boolean);
    return (
      <section className="admin-page room-form-page">
        <PageHeader
          title={editMode ? 'Edit Room' : 'Add New Room'}
          subtitle={editMode ? 'Refine pricing, status, and presentation for this room.' : 'Create a room profile that feels ready for booking and front-desk operations.'}
          action={<Link className="ghost-button room-back-button" to="/admin/rooms">Back</Link>}
        />
        {error && <div className="notice danger">{error}</div>}
        {formError && <div className="notice danger">{formError}</div>}
        <section className="room-editor-shell">
          <div className="room-form-strip" />
          <div className="room-editor-layout">
            <form className="room-editor-main" onSubmit={submit}>
              <section className="room-editor-section">
                <h2>Room Identity</h2>
                <div className="room-editor-grid room-editor-grid-3">
                  <Field label="Room Number">
                    <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
                  </Field>
                  <Field label="Room Type">
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {roomTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="available">Available</option>
                      <option value="occupied">Occupied</option>
                      <option value="dirty">Dirty</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section className="room-editor-section">
                <h2>Stay Details</h2>
                <div className="room-editor-grid room-editor-grid-2">
                  <Field label="Nightly Price ($)">
                    <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                  </Field>
                  <Field label="Guest Capacity">
                    <input type="number" min="1" step="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
                  </Field>
                  <Field label="Amenities" className="room-field-span">
                    <input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="Wi-Fi, Breakfast, Balcony" />
                  </Field>
                  <Field label="Image URL" className="room-field-span">
                    <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} required />
                  </Field>
                </div>
              </section>

              <section className="room-editor-section">
                <h2>Guest-Facing Description</h2>
                <Field label="Description" className="room-field-span">
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required />
                </Field>
              </section>

              <div className="room-editor-actions">
                <button className="ghost-button" type="button" onClick={() => navigate('/admin/rooms')}>Cancel</button>
                <button className="primary-button">{editMode ? 'Save Room Changes' : 'Add Room'}</button>
              </div>
            </form>

            <aside className="room-preview-card">
              <div className="room-preview-hero">
                <img src={form.image || roomImages.single} alt={form.type || 'Room preview'} />
                <span className="room-preview-price">{money(form.price || 0)} / night</span>
              </div>
              <div className="room-preview-copy">
                <div className="room-preview-head">
                  <div>
                    <strong>{form.type || 'Room Type'}</strong>
                    <small>Room {form.number || '--'}</small>
                  </div>
                  <StatusPill status={form.status || 'available'} />
                </div>
                <p>{form.description || 'Add a room description to see the guest-facing summary here.'}</p>
                <div className="room-preview-meta">
                  <span>{form.capacity || 1} guest{Number(form.capacity || 1) > 1 ? 's' : ''}</span>
                  {previewAmenities.length ? previewAmenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>) : <span>Amenities preview</span>}
                </div>
              </div>
            </aside>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-page rooms-page">
      <PageHeader title="Room Management" subtitle="Browse rooms and move into the add-room screen for new inventory." action={<Link className="primary-button rooms-add-button" to="/admin/rooms/add"><Plus size={16} /> Add New Room</Link>} />
      {error && <div className="notice danger">{error}</div>}
      <div className="room-grid admin-room-grid">
        {data.rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            compact
            action={
              <div className="split-actions">
                <button className="outline-button" onClick={() => edit(room)}>Edit</button>
                <button className="danger-button" onClick={async () => { await api(`/admin/rooms/${room.id}`, { method: 'DELETE' }); load(); }}>Delete</button>
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}

const menuBlank = { name: '', category: '', price: '', image: '', description: '', available: true };
const menuPrice = (value = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

function AdminMenu() {
  const { pathname } = useLocation();
  const { menuId } = useParams();
  const navigate = useNavigate();
  const addMode = pathname.endsWith('/add');
  const editMode = Boolean(menuId);
  const { data, load, error } = useLoad('/admin/menu', { menu: [] }, { refreshMs: 15000 });
  const [form, setForm] = useState(menuBlank);
  const [formError, setFormError] = useState('');

  const selectedMenu = editMode ? data.menu.find((entry) => entry.id === menuId) : null;
  const menuTotals = useMemo(() => {
    const items = data.menu || [];
    return {
      total: items.length,
      available: items.filter((item) => item.available).length,
      categories: new Set(items.map((item) => String(item.category || '').trim()).filter(Boolean)).size
    };
  }, [data.menu]);
  const previewPrice = String(form.price || '').trim() === '' ? '$--.--' : menuPrice(form.price);
  const previewImage = form.image || roomImages.paneer;
  const previewName = form.name || 'Chef Signature';
  const previewCategory = form.category || 'Room Service Favorite';

  useEffect(() => {
    if (addMode) {
      setForm(menuBlank);
      setFormError('');
      return;
    }
    if (editMode && selectedMenu) {
      setForm({ ...menuBlank, ...selectedMenu, price: selectedMenu.price ?? '', category: selectedMenu.category || '' });
      setFormError('');
    }
  }, [addMode, editMode, selectedMenu?.id]);

  const setImageFromFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, image: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!form.name || !form.category || String(form.price || '').trim() === '' || !form.image) {
      setFormError('Please complete every field before saving the menu item.');
      return;
    }
    const payload = {
      ...form,
      name: String(form.name).trim(),
      category: String(form.category).trim(),
      price: Number(form.price || 0),
      image: String(form.image || '').trim(),
      description: String(form.description || '').trim(),
      available: Boolean(form.available)
    };
    await api(editMode ? `/admin/menu/${menuId}` : '/admin/menu', { method: editMode ? 'PUT' : 'POST', body: payload });
    setForm(menuBlank);
    load();
    navigate('/admin/kitchen/menu');
  };

  if (addMode || editMode) {
    return (
      <section className="admin-page staff-page menu-page menu-form-page">
        <PageHeader
          title={editMode ? 'Edit Menu Item' : 'Add Menu Item'}
          subtitle="Update restaurant menu details."
          action={<Link className="ghost-button staff-back-button menu-back-button" to="/admin/kitchen/menu"><ChevronLeft size={16} /> Back</Link>}
        />
        <section className="kitchen-page-lead kitchen-form-lead">
          <div className="kitchen-page-badge"><Sparkles size={16} /> Menu Creation Studio</div>
          <div className="kitchen-page-stat-row">
            <article className="kitchen-page-stat-card accent-orange">
              <span>{editMode ? 'Editing Item' : 'New Draft'}</span>
              <strong>{previewName}</strong>
              <small>{previewCategory}</small>
            </article>
            <article className="kitchen-page-stat-card accent-blue">
              <span>Current Price</span>
              <strong>{previewPrice}</strong>
              <small>Live preview of room service pricing</small>
            </article>
            <article className="kitchen-page-stat-card accent-emerald">
              <span>Availability</span>
              <strong>{form.available ? 'Ready to Serve' : 'Paused'}</strong>
              <small>{form.available ? 'Guests can order this item now.' : 'Guests will not see this item yet.'}</small>
            </article>
          </div>
        </section>
        {formError && <div className="notice danger">{formError}</div>}
        {error && <div className="notice danger">{error}</div>}
        <section className="menu-form-shell">
          <div className="staff-form-strip menu-form-strip" />
          <div className="menu-form-layout">
            <form className="menu-form-stack" onSubmit={submit}>
              <Field label="Item Name" className="menu-span-full">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <div className="menu-two-col menu-span-full">
                <Field label="Category">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="" disabled>---------</option>
                    <option value="Starter">Starter</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Beverage">Beverage</option>
                  </select>
                </Field>
                <Field label="Price ($)">
                  <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </Field>
              </div>
              <Field label="Food Image" className="menu-span-full">
                <input type="file" accept="image/*" onChange={setImageFromFile} required={!editMode || !form.image} />
              </Field>
              <label className="menu-availability-box menu-span-full">
                <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                <span className="menu-availability-copy">
                  <strong>Available to Order</strong>
                  <small>Uncheck if you are out of stock of ingredients.</small>
                </span>
              </label>
              <div className="menu-form-actions menu-span-full">
                <button className="primary-button menu-save-button">{editMode ? 'Save Item' : 'Save Item'}</button>
              </div>
            </form>
            <aside className="menu-preview-panel">
              <div className="menu-preview-card">
                <div className="menu-preview-image">
                  <img src={previewImage} alt={previewName} />
                  <StatusPill status={form.available ? 'available' : 'dirty'} label={form.available ? 'Available' : 'Unavailable'} />
                </div>
                <div className="menu-preview-copy">
                  <span>{String(previewCategory).toUpperCase()}</span>
                  <strong>{previewName}</strong>
                  <b>{previewPrice}</b>
                  <p>This live card helps you judge how the dish will feel inside the admin menu before you save it.</p>
                </div>
              </div>
              <div className="menu-preview-note">
                <Sparkles size={16} />
                <div>
                  <strong>Presentation Preview</strong>
                  <small>Images, pricing, and availability update here as you edit the form.</small>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-page staff-page menu-page menu-list-page">
      <PageHeader title="Restaurant Menu" subtitle="Manage food items available for Room Service." action={<Link className="primary-button menu-add-button" to="/admin/kitchen/menu/add"><Plus size={16} /> Add Item</Link>} />
      <section className="kitchen-page-lead kitchen-menu-lead">
        <div className="kitchen-page-badge"><Utensils size={16} /> Menu Control Room</div>
        <div className="kitchen-page-stat-row">
          <article className="kitchen-page-stat-card accent-orange">
            <span>Total Items</span>
            <strong>{menuTotals.total}</strong>
            <small>Live dishes listed for room service</small>
          </article>
          <article className="kitchen-page-stat-card accent-emerald">
            <span>Available Now</span>
            <strong>{menuTotals.available}</strong>
            <small>Items guests can order right away</small>
          </article>
          <article className="kitchen-page-stat-card accent-blue">
            <span>Categories</span>
            <strong>{menuTotals.categories}</strong>
            <small>Starters, mains, desserts, and beverages</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <div className="menu-grid admin-menu-grid">
        {data.menu.map((item) => (
          <article className="admin-menu-card" key={item.id}>
            <div className="admin-menu-card-image">
              <img src={item.image || roomImages.burger} alt={item.name} />
              <StatusPill status={item.available ? 'available' : 'dirty'} label={item.available ? 'Available' : 'Unavailable'} />
            </div>
            <div className="admin-menu-card-body">
              <div className="admin-menu-card-head">
                <div>
                  <strong>{item.name}</strong>
                  <span>{String(item.category || '').toUpperCase()}</span>
                </div>
                <b>{menuPrice(item.price)}</b>
              </div>
              <div className="admin-menu-card-actions">
                <button type="button" className="outline-button menu-edit-button" onClick={() => navigate(`/admin/kitchen/menu/${item.id}/edit`)}>Edit</button>
                <button type="button" className="menu-delete-button" onClick={async () => { await api(`/admin/menu/${item.id}`, { method: 'DELETE' }); load(); }}><Trash2 size={16} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminKitchenMonitor() {
  const { data: ordersData } = useLoad('/orders', { orders: [] }, { refreshMs: 10000 });
  const active = ordersData.orders.filter((order) => order.status !== 'delivered');
  const orderSummary = useMemo(() => {
    const rooms = new Set();
    let dishes = 0;
    let ready = 0;
    let cooking = 0;
    let pending = 0;

    active.forEach((order) => {
      if (order.room?.number) rooms.add(order.room.number);
      dishes += order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      if (order.status === 'ready') ready += 1;
      else if (order.status === 'cooking') cooking += 1;
      else pending += 1;
    });

    return {
      activeOrders: active.length,
      rooms: rooms.size,
      dishes,
      ready,
      cooking,
      pending
    };
  }, [active]);

  return (
    <section className="admin-page kitchen-performance-page kitchen-monitor-page">
      <PageHeader className="kitchen-performance-header" title="Kitchen Monitor" subtitle="Live view of active room service orders." />
      <section className="kitchen-page-lead kitchen-monitor-lead">
        <div className="kitchen-page-badge"><ChefHat size={16} /> Active Kitchen Flow</div>
        <div className="kitchen-page-stat-row">
          <article className="kitchen-page-stat-card accent-orange">
            <span>Active Orders</span>
            <strong>{orderSummary.activeOrders}</strong>
            <small>Orders currently moving through the kitchen</small>
          </article>
          <article className="kitchen-page-stat-card accent-blue">
            <span>Rooms Serving</span>
            <strong>{orderSummary.rooms}</strong>
            <small>Distinct rooms with live requests</small>
          </article>
          <article className="kitchen-page-stat-card accent-emerald">
            <span>Dishes in Queue</span>
            <strong>{orderSummary.dishes}</strong>
            <small>{orderSummary.ready} ready, {orderSummary.cooking} cooking, {orderSummary.pending} pending</small>
          </article>
        </div>
      </section>
      {active.length ? (
        <div className="order-grid">
          {active.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      ) : <EmptyState icon={ChefHat} title="No active orders in the kitchen." text="New guest orders will appear here instantly after refresh." />}
    </section>
  );
}

function AdminKitchenDeliveryHistory() {
  const { data: perf } = useLoad('/admin/kitchen-performance', { totals: { pending: 0, delivered: 0 }, topServers: [], deliveryLog: [] }, { refreshMs: 15000 });
  const topServers = perf.topServers?.length
    ? perf.topServers
    : perf.totals.delivered
      ? [{ id: 'unknown', name: 'None', count: perf.totals.delivered, rank: 1, initials: '?', avatar: '', unknown: true }]
      : [];
  const historySummary = useMemo(() => {
    const rooms = new Set();
    let revenue = 0;

    perf.deliveryLog.forEach((order) => {
      if (order.room?.number) rooms.add(order.room.number);
      revenue += Number(order.total || 0);
    });

    return {
      delivered: perf.totals.delivered || perf.deliveryLog.length,
      rooms: rooms.size,
      revenue
    };
  }, [perf.deliveryLog, perf.totals.delivered]);

  return (
    <section className="admin-page kitchen-performance-page">
      <section className="kitchen-page-lead kitchen-history-lead">
        <div className="kitchen-page-badge"><ClipboardList size={16} /> Delivery Intelligence</div>
        <div className="kitchen-page-stat-row">
          <article className="kitchen-page-stat-card accent-orange">
            <span>Total Deliveries</span>
            <strong>{historySummary.delivered}</strong>
            <small>Completed room service drops tracked here</small>
          </article>
          <article className="kitchen-page-stat-card accent-emerald">
            <span>Rooms Served</span>
            <strong>{historySummary.rooms}</strong>
            <small>Unique rooms covered in the current log</small>
          </article>
          <article className="kitchen-page-stat-card accent-blue">
            <span>Delivery Value</span>
            <strong>{menuPrice(historySummary.revenue)}</strong>
            <small>Gross value across completed orders</small>
          </article>
        </div>
      </section>
      <section className="kitchen-performance-block">
        <PageHeader className="kitchen-performance-header" title="Kitchen Performance" subtitle="Delivery history and staff statistics." />
        <div className="kitchen-server-section">
          <h2>Top Servers</h2>
          {topServers.length ? (
            <div className="kitchen-server-grid">
              {topServers.map((server) => (
                <article className="kitchen-server-card" key={server.id}>
                  <div className={`kitchen-server-avatar ${server.unknown ? 'is-unknown' : ''}`}>
                    {server.avatar
                      ? <img src={server.avatar} alt={server.name} />
                      : <span>{server.initials || '?'}</span>}
                    <small>#{server.rank}</small>
                  </div>
                  <div className="kitchen-server-copy">
                    <strong>{server.name}</strong>
                    <span>{server.count} {server.count === 1 ? 'Order' : 'Orders'} Delivered</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="kitchen-server-empty">No delivery records yet.</div>
          )}
        </div>
        <section className="kitchen-delivery-shell">
          <div className="kitchen-delivery-heading">Delivery Log</div>
          {perf.deliveryLog.length ? (
            <div className="kitchen-delivery-scroll">
              <table className="kitchen-delivery-table">
                <thead>
                  <tr>
                    <th>DATE &amp; TIME</th>
                    <th>ROOM</th>
                    <th>ITEMS</th>
                    <th>DELIVERED BY (STAFF)</th>
                    <th>VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.deliveryLog.map((order) => {
                    const deliveredAt = order.updatedAt || order.createdAt;
                    const deliveredByName = `${order.deliveredBy?.firstName || ''} ${order.deliveredBy?.lastName || ''}`.trim() || order.deliveredBy?.username || 'Unknown';
                    const deliveredByInitials = order.deliveredBy
                      ? userInitials(order.deliveredBy)
                      : '?';

                    return (
                      <tr key={order.id}>
                        <td className="kitchen-date-cell">
                          <strong>{dateText(deliveredAt)}</strong>
                          <small>{timeText(deliveredAt)}</small>
                        </td>
                        <td>
                          <span className="kitchen-room-chip">Room {order.room?.number || '-'}</span>
                        </td>
                        <td className="kitchen-items-cell">
                          {order.items.map((item) => String(item.name || '').toLowerCase()).join(', ')}
                        </td>
                        <td>
                          {order.deliveredBy ? (
                            <div className="kitchen-staff-cell">
                              <span className="kitchen-staff-avatar">
                                {order.deliveredBy.avatar
                                  ? <img src={order.deliveredBy.avatar} alt={deliveredByName} />
                                  : <span>{deliveredByInitials}</span>}
                              </span>
                              <span className="kitchen-staff-name"><UserRound size={15} /> {deliveredByName}</span>
                            </div>
                          ) : (
                            <span className="kitchen-staff-unknown">Unknown</span>
                          )}
                        </td>
                        <td className="kitchen-value-cell">{menuPrice(order.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ChefHat} title="No deliveries logged yet." text="Completed room service orders will appear here." />
          )}
        </section>
      </section>
    </section>
  );
}

function OrderCard({ order, action }) {
  return (
    <article className="order-card">
      <div>
        <span>Room {order.room?.number}</span>
        <h3>{order.items.map((item) => `${item.quantity} ${item.name}`).join(', ')}</h3>
        <small>{order.guest?.firstName} {order.guest?.lastName}</small>
      </div>
      <StatusPill status={order.status} />
      <b>{money(order.total)}</b>
      {action}
    </article>
  );
}

function OrdersTable({ orders }) {
  if (!orders.length) return <EmptyState />;
  return (
    <TableShell>
      <thead><tr><th>Date</th><th>Room</th><th>Items</th><th>Status</th><th>Total</th></tr></thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td>{dateText(order.createdAt)}</td>
            <td>Room {order.room?.number}</td>
            <td>{order.items.map((item) => `${item.quantity} ${item.name}`).join(', ')}</td>
            <td><StatusPill status={order.status} /></td>
            <td>{money(order.total)}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function AdminBookings() {
  const { data, load } = useLoad('/bookings', { bookings: [] }, { refreshMs: 15000 });
  return (
    <section className="admin-page booking-page">
      <PageHeader title="Booking Desk" subtitle="Manage guest arrivals, departures, and checkout." />
      <BookingsTable bookings={data.bookings} onChanged={load} admin />
    </section>
  );
}

function BookingsTable({ bookings, onChanged, admin = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceBasePath = location.pathname.startsWith('/admin') ? '/admin' : '/frontdesk';

  if (!bookings.length) return <EmptyState title="No bookings found" />;

  if (admin) {
    return (
      <TableShell className="booking-table-shell">
        <thead>
          <tr>
            <th>GUEST INFO</th>
            <th>ROOM</th>
            <th>CHECK IN (PLAN/ACTUAL)</th>
            <th>CHECK OUT (PLAN/ACTUAL)</th>
            <th>STATUS</th>
            <th>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking, index) => {
            const guestName = `${booking.guest?.firstName || ''} ${booking.guest?.lastName || ''}`.trim() || booking.guest?.username || 'Guest';
            const guestId = booking.id ? booking.id.slice(-4).toUpperCase() : String(index + 1);
            const statusLabel = {
              confirmed: 'Confirmed',
              'checked-in': 'Checked In',
              completed: 'Completed',
              cancelled: 'Cancelled'
            }[booking.status] || booking.status;
            return (
              <tr key={booking.id}>
                <td>
                  <div className="booking-guest-cell">
                    <span className="booking-avatar">
                      {booking.guest?.avatar
                        ? <img src={booking.guest.avatar} alt={guestName} />
                        : <span>{userInitials(booking.guest)}</span>}
                    </span>
                    <div className="booking-guest-copy">
                      <strong>{guestName}</strong>
                      <small>ID: {guestId}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="booking-room-cell">
                    <span className="booking-room-chip">Room {booking.room?.number}</span>
                    <small>{booking.room?.type || '-'}</small>
                  </div>
                </td>
                <td>
                  <div className="booking-schedule-cell">
                    <span className="booking-schedule-label">PLAN</span>
                    <strong>{monthDayText(booking.checkIn)}</strong>
                    <span className="booking-schedule-label booking-schedule-label-actual">ACTUAL</span>
                    {booking.checkedInAt
                      ? <span className="booking-actual-tag checkin">{militaryTimeText(booking.checkedInAt)} {monthDayText(booking.checkedInAt)}</span>
                      : <span className="booking-actual-tag missing">Pending</span>}
                  </div>
                </td>
                <td>
                  <div className="booking-schedule-cell">
                    <span className="booking-schedule-label">PLAN</span>
                    <strong>{monthDayText(booking.checkOut)}</strong>
                    <span className="booking-schedule-label booking-schedule-label-actual">ACTUAL</span>
                    {booking.checkedOutAt
                      ? <span className="booking-actual-tag checkout">{militaryTimeText(booking.checkedOutAt)} {monthDayText(booking.checkedOutAt)}</span>
                      : <span className="booking-actual-tag missing">{booking.status === 'completed' ? 'Pending' : 'Not Yet'}</span>}
                  </div>
                </td>
                <td>
                  <StatusPill status={booking.status} label={statusLabel} className="booking-status-pill" />
                </td>
                <td className="booking-action-cell">
                  {booking.status === 'confirmed' && (
                    <button className="booking-action-button booking-checkin-button" onClick={async () => { await api(`/bookings/${booking.id}/check-in`, { method: 'PATCH' }); onChanged?.(); }}>
                      <DoorOpen size={15} /> Check In
                    </button>
                  )}
                  {['checked-in', 'completed'].includes(booking.status) && (
                    <button
                      type="button"
                      className="booking-action-button booking-invoice-button"
                      onClick={() => navigate(`${invoiceBasePath}/invoice/${booking.id}`)}
                    >
                      <Receipt size={15} /> {booking.status === 'checked-in' ? 'Bill & Checkout' : 'View Invoice'}
                    </button>
                  )}
                  {!['confirmed', 'checked-in', 'completed'].includes(booking.status) && <span className="booking-action-empty">-</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>
    );
  }

  return (
    <TableShell>
      <thead><tr><th>Guest</th><th>Room</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <td><strong>{booking.guest?.firstName} {booking.guest?.lastName}</strong><small>{booking.guest?.email}</small></td>
            <td><strong>Room {booking.room?.number}</strong><small>{booking.room?.type}</small></td>
            <td>{dateText(booking.checkIn)}</td>
            <td>{dateText(booking.checkOut)}</td>
            <td><StatusPill status={booking.status} /></td>
            <td className="table-actions">
              {['confirmed'].includes(booking.status) && admin && <button onClick={async () => { await api(`/bookings/${booking.id}/check-in`, { method: 'PATCH' }); onChanged?.(); }}>Check In</button>}
              {['checked-in'].includes(booking.status) && admin && <button type="button" onClick={() => navigate(`${invoiceBasePath}/invoice/${booking.id}`)}>Bill & Checkout</button>}
              {!admin && <span>{money(booking.grandTotal)}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function GuestBookingsTable({ bookings, compact = false }) {
  const rows = [...bookings].sort((left, right) => new Date(right.checkIn || right.createdAt || 0) - new Date(left.checkIn || left.createdAt || 0));
  const visibleRows = compact ? rows.slice(0, 4) : rows;
  if (!visibleRows.length) {
    return <EmptyState title={compact ? 'No guest activity yet' : 'No bookings found'} text="Your confirmed and completed stays will appear here." />;
  }

  return (
    <TableShell className="guest-stay-shell">
      <thead>
        <tr>
          <th>Stay</th>
          <th>Schedule</th>
          <th>Guests</th>
          <th>Status</th>
          <th>Bill</th>
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((booking) => {
          const nights = Math.max(1, Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / 86400000) || 1);
          return (
            <tr key={booking.id}>
              <td className="guest-stay-cell">
                <div className="guest-stay-room">
                  <span className="booking-room-chip">Room {booking.room?.number || '-'}</span>
                  <div>
                    <strong>{booking.room?.type || 'Room stay'}</strong>
                    <small>{booking.source === 'walk-in' ? 'Walk-in' : 'Online reservation'}</small>
                  </div>
                </div>
              </td>
              <td className="guest-stay-schedule">
                <strong>{monthDayText(booking.checkIn)} - {monthDayText(booking.checkOut)}</strong>
                <small>{nights} night{nights === 1 ? '' : 's'} · created {dateText(booking.createdAt)}</small>
              </td>
              <td className="guest-stay-guests">
                <strong>{booking.guests || 1} guest{Number(booking.guests || 1) === 1 ? '' : 's'}</strong>
                <small>{booking.checkedInAt ? `Checked in ${timeText(booking.checkedInAt)}` : 'Ready for arrival'}</small>
              </td>
              <td>
                <StatusPill status={booking.status} />
              </td>
              <td className="guest-stay-bill">
                <strong>{money(booking.grandTotal)}</strong>
                <small>{booking.paymentMethod || 'Pay at hotel'}</small>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

function GuestOrdersTable({ orders, compact = false }) {
  const rows = [...orders].sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
  const visibleRows = compact ? rows.slice(0, 4) : rows;
  if (!visibleRows.length) {
    return <EmptyState title={compact ? 'No room service yet' : 'No food orders found'} text="Your kitchen tickets will appear here once you place an order." />;
  }

  return (
    <TableShell className="guest-order-shell">
      <thead>
        <tr>
          <th>Date &amp; Time</th>
          <th>Room</th>
          <th>Items</th>
          <th>Status</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {visibleRows.map((order) => (
          <tr key={order.id}>
            <td className="guest-order-date">
              <strong>{dateText(order.updatedAt || order.createdAt)}</strong>
              <small>{timeText(order.updatedAt || order.createdAt)}</small>
            </td>
            <td className="guest-order-room">
              <span className="booking-room-chip">Room {order.room?.number || '-'}</span>
              <small>{order.room?.type || 'Room service'}</small>
            </td>
            <td className="guest-order-items">
              <strong>{order.items.map((item) => item.name).join(', ')}</strong>
              <small>{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} item{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) === 1 ? '' : 's'}</small>
            </td>
            <td><StatusPill status={order.status} /></td>
            <td className="guest-order-total">{money(order.total)}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function AdminGuests() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, load, error } = useLoad('/admin/guests', { guests: [] }, { refreshMs: 15000 });
  const canManage = user?.role === 'admin' && location.pathname.startsWith('/admin');
  const [editingGuest, setEditingGuest] = useState(null);
  const [guestForm, setGuestForm] = useState({ firstName: '', lastName: '', username: '', phone: '', email: '', address: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const openEditGuest = useCallback((guest) => {
    setEditingGuest(guest);
    setGuestForm({
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      username: guest.username || '',
      phone: String(guest.phone || '').replace(/^\+91/, ''),
      email: guest.email || '',
      address: guest.address || ''
    });
    setActionError('');
    setNotice('');
  }, []);

  useEffect(() => {
    const guestId = searchParams.get('guestId');
    if (!guestId) return;
    const guest = data.guests.find((entry) => entry.id === guestId);
    if (guest) {
      openEditGuest(guest);
    }
  }, [searchParams, data.guests, openEditGuest]);

  const closeGuestEditor = () => {
    setEditingGuest(null);
    setActionError('');
    const next = new URLSearchParams(searchParams);
    next.delete('guestId');
    setSearchParams(next, { replace: true });
  };

  const editGuest = (guest) => {
    const next = new URLSearchParams(searchParams);
    next.set('guestId', guest.id);
    setSearchParams(next, { replace: true });
    openEditGuest(guest);
  };

  const saveGuest = async (event) => {
    event.preventDefault();
    if (!editingGuest) return;
    setSaving(true);
    setActionError('');
    try {
      await api(`/admin/guests/${editingGuest.id}`, {
        method: 'PUT',
        body: {
          ...guestForm,
          username: String(guestForm.username || '').trim().toLowerCase(),
          phone: guestForm.phone ? `+91${String(guestForm.phone || '').replace(/\D/g, '').slice(0, 10)}` : ''
        }
      });
      await load();
      setNotice('Guest details updated successfully.');
      closeGuestEditor();
    } catch (editError) {
      setActionError(editError.message || 'Unable to update guest.');
    } finally {
      setSaving(false);
    }
  };

  const deleteGuest = (guest) => {
    setDeleteTarget(guest);
    setActionError('');
    setNotice('');
  };

  const confirmDeleteGuest = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setActionError('');
    try {
      await api(`/admin/guests/${deleteTarget.id}`, { method: 'DELETE' });
      await load();
      setDeleteTarget(null);
      setNotice('Guest removed successfully.');
    } catch (deleteError) {
      setActionError(deleteError.message || 'Unable to delete guest.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-page guests-page">
      <PageHeader title="Guest Management" subtitle="View registered and walk-in guests." />
      {error && <div className="notice danger">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}
      {actionError && !editingGuest && !deleteTarget && <div className="notice danger">{actionError}</div>}
      <TableShell className="guest-table-shell">
        <thead>
          <tr>
            <th>GUEST</th>
            <th>CONTACT INFO</th>
            <th>ADDRESS</th>
            <th>JOINED DATE</th>
            {canManage && <th>ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {data.guests.map((guest) => (
            <tr key={guest.id}>
              <td>
                <div className="booking-guest-cell guest-guest-cell">
                  <span className="booking-avatar guest-avatar">
                    {guest.avatar
                      ? <img src={guest.avatar} alt={`${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'Guest'} />
                      : <span>{userInitials(guest)}</span>}
                  </span>
                  <div className="booking-guest-copy guest-guest-copy">
                    <strong>{guest.firstName} {guest.lastName}</strong>
                    <small>@{guest.username || 'guest'}</small>
                  </div>
                </div>
              </td>
              <td>
                <div className="guest-contact-cell">
                  <span><Phone size={15} /> {guest.phone || '-'}</span>
                  <small><Mail size={15} /> {guest.email || '-'}</small>
                </div>
              </td>
              <td>{guest.address || 'Walk-in Guest'}</td>
              <td>{dateText(guest.createdAt)}</td>
              {canManage && (
                <td>
                  <div className="guest-actions">
                    <button type="button" className="staff-icon-button edit" onClick={() => editGuest(guest)} aria-label={`Edit ${guest.firstName || 'guest'}`}>
                      <Edit size={17} />
                    </button>
                    <button type="button" className="staff-icon-button delete" onClick={() => deleteGuest(guest)} aria-label={`Delete ${guest.firstName || 'guest'}`}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </TableShell>
      {editingGuest && (
        <div className="admin-modal-backdrop" onClick={closeGuestEditor}>
          <div className="admin-modal guest-editor-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-head guest-editor-head">
              <div>
                <span className="guest-editor-kicker">Guest Profile</span>
                <h2>Edit Guest</h2>
                <p>Update contact details for {fullName(editingGuest)}.</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={closeGuestEditor} aria-label="Close guest editor">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="notice danger">{actionError}</div>}
            <div className="guest-editor-layout">
              <aside className="guest-editor-summary">
                <div className="guest-editor-summary-card">
                  <span className="guest-editor-avatar">
                    {editingGuest.avatar
                      ? <img src={editingGuest.avatar} alt={fullName(editingGuest)} />
                      : <span>{userInitials(editingGuest)}</span>}
                  </span>
                  <strong>{fullName(editingGuest)}</strong>
                  <small>@{guestForm.username || editingGuest.username || 'guest'}</small>
                  <div className="guest-editor-summary-list">
                    <div className="guest-editor-summary-item">
                      <CalendarCheck size={16} />
                      <div>
                        <span>Joined</span>
                        <strong>{dateText(editingGuest.createdAt)}</strong>
                      </div>
                    </div>
                    <div className="guest-editor-summary-item">
                      <Phone size={16} />
                      <div>
                        <span>Mobile</span>
                        <strong>{guestForm.phone ? `+91 ${guestForm.phone}` : 'Not added'}</strong>
                      </div>
                    </div>
                    <div className="guest-editor-summary-item">
                      <Mail size={16} />
                      <div>
                        <span>Email</span>
                        <strong>{guestForm.email || 'Not added'}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="guest-editor-sync">
                    <Shield size={15} />
                    <span>Changes save directly to the backend guest record.</span>
                  </div>
                </div>
              </aside>
              <form className="guest-editor-form" onSubmit={saveGuest}>
                <div className="guest-editor-section-head">
                  <div>
                    <span>Guest Details</span>
                    <strong>Keep contact data current for bookings, billing, and front desk operations.</strong>
                  </div>
                </div>
                <div className="guest-editor-grid">
                  <Field label="First Name">
                    <input value={guestForm.firstName} onChange={(event) => setGuestForm({ ...guestForm, firstName: event.target.value })} required />
                  </Field>
                  <Field label="Last Name">
                    <input value={guestForm.lastName} onChange={(event) => setGuestForm({ ...guestForm, lastName: event.target.value })} />
                  </Field>
                  <Field label="Username">
                    <input value={guestForm.username} onChange={(event) => setGuestForm({ ...guestForm, username: event.target.value })} required />
                  </Field>
                  <Field label="Mobile Number">
                    <div className="auth-input-shell auth-phone-shell guest-phone-shell">
                      <Phone size={18} />
                      <span className="auth-prefix">+91</span>
                      <input value={guestForm.phone} onChange={(event) => setGuestForm({ ...guestForm, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" placeholder="9876543210" />
                    </div>
                  </Field>
                  <Field label="Email Address">
                    <input type="email" value={guestForm.email} onChange={(event) => setGuestForm({ ...guestForm, email: event.target.value })} required />
                  </Field>
                  <Field label="Address" className="room-field-span">
                    <textarea value={guestForm.address} onChange={(event) => setGuestForm({ ...guestForm, address: event.target.value })} rows={4} />
                  </Field>
                </div>
                <div className="admin-modal-actions guest-editor-actions">
                  <button type="button" className="ghost-button" onClick={closeGuestEditor}>Cancel</button>
                  <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Saving...' : 'Save Guest'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-modal admin-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <h2>Delete Guest</h2>
                <p>Remove {fullName(deleteTarget)} from the guest list.</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => setDeleteTarget(null)} aria-label="Close delete confirmation">
                <X size={18} />
              </button>
            </div>
            {actionError && <div className="notice danger">{actionError}</div>}
            <p className="admin-confirm-copy">Guests with booking or order history will stay protected, and you will see that message here instead of a silent failure.</p>
            <div className="admin-modal-actions">
              <button type="button" className="ghost-button" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="danger-button" onClick={confirmDeleteGuest} disabled={saving}>{saving ? 'Deleting...' : 'Delete Guest'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GuestDashboard() {
  const { data, error } = useLoad('/guests/dashboard', { stats: { currentBill: 0, membershipTier: 'Silver', loyaltyPoints: 0 }, bookings: [], active: null, user: null }, { refreshMs: 15000 });
  const { data: orders } = useLoad('/orders', { orders: [] }, { refreshMs: 15000 });
  const activeOrders = orders.orders.filter((order) => ['pending', 'cooking', 'ready'].includes(order.status));
  const completedBookings = data.bookings.filter((booking) => booking.status === 'completed').length;
  return (
    <section className="guest-page guest-dashboard-page">
      {error && <div className="notice danger">{error}</div>}
      <PageHeader title={`Welcome, ${data.user?.firstName || 'Guest'}!`} subtitle="A live view of your stay, billing snapshot, room history, and room-service activity." action={<Link className="primary-button guest-header-button" to="/guest/book-room"><Plus size={16} /> Book New Room</Link>} />
      <section className="guest-page-lead">
        <div className="guest-page-kicker"><Sparkles size={15} /> Stay Snapshot</div>
        <div className="guest-stat-grid">
          <article className="guest-stat-card accent-blue">
            <span>Current Bill</span>
            <strong>{money(data.stats.currentBill)}</strong>
            <small>Combined room and food charges for your active stay.</small>
          </article>
          <article className="guest-stat-card accent-violet">
            <span>Membership Tier</span>
            <strong>{data.stats.membershipTier}</strong>
            <small>Your loyalty tier now steps up every 6000 points.</small>
          </article>
          <article className="guest-stat-card accent-emerald">
            <span>Loyalty Points</span>
            <strong>{data.stats.loyaltyPoints}</strong>
            <small>Points earned from bookings and completed hotel activity.</small>
          </article>
        </div>
      </section>
      <div className="guest-dashboard-layout">
        <section className="guest-surface-panel guest-current-stay-panel">
          <div className="guest-panel-head">
            <div>
              <strong>Current Stay</strong>
              <small>{data.active ? 'Live room and booking summary from your guest record.' : 'You do not have an active stay at the moment.'}</small>
            </div>
            {data.active && <StatusPill status={data.active.status} />}
          </div>
          {data.active ? (
            <div className="guest-current-stay-card">
              <div className="guest-current-stay-room">
                <span className="booking-room-chip">Room {data.active.room?.number || '-'}</span>
                <div>
                  <h3>{data.active.room?.type || 'Room stay'}</h3>
                  <p>{dateText(data.active.checkIn)} to {dateText(data.active.checkOut)}</p>
                </div>
              </div>
              <div className="guest-current-stay-metrics">
                <div>
                  <span>Guests</span>
                  <strong>{data.active.guests || 1}</strong>
                </div>
                <div>
                  <span>Room Total</span>
                  <strong>{money(data.active.grandTotal)}</strong>
                </div>
                <div>
                  <span>Food Orders</span>
                  <strong>{activeOrders.length}</strong>
                </div>
              </div>
            </div>
          ) : <EmptyState icon={Hotel} title="No active stay" text="Book a new room to unlock live stay tracking and room service." />}
        </section>
        <section className="guest-surface-panel guest-quick-panel">
          <div className="guest-panel-head">
            <div>
              <strong>Quick Actions</strong>
              <small>Jump into the parts of your stay you use most often.</small>
            </div>
          </div>
          <div className="guest-quick-grid">
            <Link className="guest-quick-link" to="/guest/book-room"><BedDouble size={18} /><span>Book a Room</span></Link>
            <Link className="guest-quick-link" to="/guest/order-food"><Utensils size={18} /><span>Order Food</span></Link>
            <Link className="guest-quick-link" to="/guest/bookings"><CalendarCheck size={18} /><span>Booking History</span></Link>
            <Link className="guest-quick-link" to="/guest/profile"><Settings size={18} /><span>Profile Settings</span></Link>
          </div>
          <div className="guest-mini-summary">
            <div>
              <span>Completed stays</span>
              <strong>{completedBookings}</strong>
            </div>
            <div>
              <span>Active food tickets</span>
              <strong>{activeOrders.length}</strong>
            </div>
          </div>
        </section>
      </div>
      <div className="two-col guest-dashboard-bottom">
        <section className="guest-surface-panel">
          <div className="guest-panel-head">
            <div>
              <strong>Recent Bookings</strong>
              <small>Your latest room reservations and stay status.</small>
            </div>
            <Link to="/guest/bookings">View all</Link>
          </div>
          <GuestBookingsTable bookings={data.bookings} compact />
        </section>
        <section className="guest-surface-panel">
          <div className="guest-panel-head">
            <div>
              <strong>Room Service Activity</strong>
              <small>Latest kitchen tickets and delivery updates tied to your stay.</small>
            </div>
            <Link to="/guest/food-orders">View all</Link>
          </div>
          <GuestOrdersTable orders={orders.orders} compact />
        </section>
      </div>
    </section>
  );
}

function GuestBookings() {
  const { data, error } = useLoad('/bookings', { bookings: [] }, { refreshMs: 15000 });
  const activeCount = data.bookings.filter((booking) => ['confirmed', 'checked-in'].includes(booking.status)).length;
  const totalSpend = data.bookings.reduce((sum, booking) => sum + Number(booking.grandTotal || 0), 0);
  return (
    <section className="guest-page guest-bookings-page">
      <PageHeader title="My Bookings" subtitle="Track your reservations, stay windows, and booking totals in one place." action={<Link className="ghost-button guest-link-button" to="/guest/book-room">Book Another Room</Link>} />
      <section className="guest-page-lead">
        <div className="guest-page-kicker"><CalendarCheck size={15} /> Stay Ledger</div>
        <div className="guest-stat-grid">
          <article className="guest-stat-card accent-violet">
            <span>Total Bookings</span>
            <strong>{data.bookings.length}</strong>
            <small>Every confirmed and completed stay attached to your account.</small>
          </article>
          <article className="guest-stat-card accent-blue">
            <span>Active Bookings</span>
            <strong>{activeCount}</strong>
            <small>Reservations that are upcoming or currently checked in.</small>
          </article>
          <article className="guest-stat-card accent-emerald">
            <span>Total Spend</span>
            <strong>{money(totalSpend)}</strong>
            <small>Room charges recorded across your bookings so far.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <GuestBookingsTable bookings={data.bookings} />
    </section>
  );
}

function GuestBookRoom() {
  const [query, setQuery] = useState({ checkIn: '', checkOut: '', guests: 1 });
  const [appliedQuery, setAppliedQuery] = useState({ checkIn: '', checkOut: '', guests: 1 });
  const searchPath = useMemo(() => {
    if (!appliedQuery.checkIn || !appliedQuery.checkOut) return '/public/rooms';
    const params = new URLSearchParams({ checkIn: appliedQuery.checkIn, checkOut: appliedQuery.checkOut });
    return `/public/rooms?${params.toString()}`;
  }, [appliedQuery]);
  const { data, error, loading } = useLoad(searchPath, { rooms: fallbackRooms }, { refreshMs: 15000 });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const stayNights = query.checkIn && query.checkOut ? Math.max(1, Math.round((new Date(query.checkOut) - new Date(query.checkIn)) / 86400000) || 1) : 0;
  const roomResults = Array.isArray(data.rooms) ? data.rooms : fallbackRooms;
  const visibleRooms = roomResults.filter((room) => Number(query.guests || 1) <= Number(room.capacity || 2));
  const averageNightly = visibleRooms.length ? visibleRooms.reduce((sum, room) => sum + Number(room.price || 0), 0) / visibleRooms.length : 0;

  const submitSearch = async (event) => {
    event.preventDefault();
    setActionError('');
    if (!query.checkIn || !query.checkOut) {
      setActionError('Choose both check-in and check-out dates before searching.');
      return;
    }
    if (new Date(query.checkOut) <= new Date(query.checkIn)) {
      setActionError('Check-out must be after check-in.');
      return;
    }
    setSelected(null);
    setAppliedQuery({ ...query });
  };

  const book = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setNotice('');
    setActionError('');
    setBookingBusy(true);
    try {
      const result = await api('/bookings', { method: 'POST', body: { ...query, roomId: selected.id } });
      setSelected(null);
      setNotice(`Room ${result.booking.room.number} booked successfully.`);
    } catch (bookError) {
      setActionError(bookError.message || 'Unable to complete this booking right now.');
    } finally {
      setBookingBusy(false);
    }
  };

  return (
    <section className="guest-page guest-book-room-page">
      <PageHeader title="Book New Room" subtitle="Search date-based availability, compare rooms, and confirm your next stay." action={<span className="soft-badge">{visibleRooms.length} rooms</span>} />
      <section className="guest-page-lead">
        <div className="guest-page-kicker"><BedDouble size={15} /> Availability Finder</div>
        <div className="guest-stat-grid">
          <article className="guest-stat-card accent-blue">
            <span>Visible Rooms</span>
            <strong>{visibleRooms.length}</strong>
            <small>Rooms currently matching your guest count and selected dates.</small>
          </article>
          <article className="guest-stat-card accent-violet">
            <span>Stay Length</span>
            <strong>{stayNights || 0} night{stayNights === 1 ? '' : 's'}</strong>
            <small>Duration based on the dates in your booking search.</small>
          </article>
          <article className="guest-stat-card accent-emerald">
            <span>Average Rate</span>
            <strong>{money(averageNightly)}</strong>
            <small>Average nightly rate across the current room list.</small>
          </article>
        </div>
      </section>
      {notice && <div className="notice success">{notice}</div>}
      {actionError && <div className="notice danger">{actionError}</div>}
      {error && <div className="notice warning">{error}</div>}
      <form className="search-row guest-search-shell" onSubmit={submitSearch}>
        <Field label="Check In"><input type="date" value={query.checkIn} onChange={(e) => setQuery({ ...query, checkIn: e.target.value })} required /></Field>
        <Field label="Check Out"><input type="date" value={query.checkOut} onChange={(e) => setQuery({ ...query, checkOut: e.target.value })} required /></Field>
        <Field label="Guests"><input type="number" min="1" value={query.guests} onChange={(e) => setQuery({ ...query, guests: e.target.value })} /></Field>
        <button className="primary-button guest-header-button">{loading ? 'Loading...' : 'Search Availability'}</button>
      </form>
      {selected ? (
        <section className="confirm-layout guest-confirm-layout">
          <div className="guest-surface-panel">
            <RoomCard room={selected} compact action={<span className="soft-badge">Selected Room</span>} />
          </div>
          <form className="form-panel guest-confirm-panel" onSubmit={book}>
            <div className="guest-panel-head">
              <div>
                <strong>Confirm Booking</strong>
                <small>Review your stay details before sending them to the booking system.</small>
              </div>
            </div>
            <div className="guest-confirm-summary">
              <div>
                <span>Stay Window</span>
                <strong>{dateText(query.checkIn)} - {dateText(query.checkOut)}</strong>
              </div>
              <div>
                <span>Guests</span>
                <strong>{query.guests}</strong>
              </div>
              <div>
                <span>Estimated Total</span>
                <strong>{money(Number(selected.price || 0) * stayNights)}</strong>
              </div>
            </div>
            <button className="primary-button wide guest-header-button" disabled={bookingBusy}>{bookingBusy ? 'Booking...' : 'Confirm & Book Now'}</button>
            <button type="button" className="ghost-button wide" onClick={() => setSelected(null)}>Cancel</button>
          </form>
        </section>
      ) : (
        <div className="room-grid public-room-grid guest-room-grid">
          {visibleRooms.length ? visibleRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              action={<button className="primary-button wide guest-header-button" disabled={room.availableForDates === false} onClick={() => setSelected(room)}>{room.availableForDates === false ? 'Unavailable' : 'Select Room'}</button>}
            />
          )) : <EmptyState icon={BedDouble} title="No rooms match this search" text="Try adjusting your dates or guest count to find more availability." />}
        </div>
      )}
    </section>
  );
}

function GuestOrderFood() {
  const { data, error } = useLoad('/public/menu', { menu: fallbackMenu }, { refreshMs: 15000 });
  const { data: dashboard } = useLoad('/guests/dashboard', { stats: { currentBill: 0, membershipTier: 'Silver', loyaltyPoints: 0 }, bookings: [], active: null, checkedInBooking: null, user: null }, { refreshMs: 15000 });
  const [cart, setCart] = useState({});
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const menuItems = Array.isArray(data.menu) ? data.menu : fallbackMenu;
  const checkedInBooking = dashboard.checkedInBooking || dashboard.bookings.find((booking) => booking.status === 'checked-in') || null;
  const pendingCheckInBooking = dashboard.bookings.find((booking) => booking.status === 'confirmed') || null;
  const canOrderFood = Boolean(checkedInBooking);

  const updateCart = (item, delta) => {
    if (!canOrderFood) return;
    setCart((current) => {
      const next = { ...current };
      const value = Math.max(0, (next[item.id] || 0) + delta);
      if (value === 0) delete next[item.id];
      else next[item.id] = value;
      return next;
    });
  };

  const items = Object.entries(cart).map(([menuItem, quantity]) => ({ menuItem, quantity }));
  const cartRows = menuItems.filter((item) => cart[item.id]).map((item) => ({ ...item, quantity: cart[item.id] }));
  const cartTotal = cartRows.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

  const submit = async () => {
    setNotice('');
    setActionError('');
    if (!canOrderFood) {
      setActionError(
        pendingCheckInBooking
          ? 'Food ordering opens after front desk confirms your check-in.'
          : 'You need a checked-in stay before ordering room service.'
      );
      return;
    }
    if (!items.length) {
      setActionError('Add at least one menu item before placing an order.');
      return;
    }
    setSubmitting(true);
    try {
      await api('/orders', { method: 'POST', body: { items, notes } });
      setCart({});
      setNotes('');
      setNotice('Order placed successfully. The kitchen is preparing your food.');
    } catch (submitError) {
      setActionError(submitError.message || 'Unable to place your food order right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="guest-page guest-food-page">
      <PageHeader title="Order Food" subtitle="Browse room-service favorites, build your tray, and send it straight to the kitchen." action={<span className="soft-badge">{cartRows.length} selected</span>} />
      <section className="guest-page-lead">
        <div className="guest-page-kicker"><Utensils size={15} /> Room Service</div>
        <div className="guest-stat-grid">
          <article className="guest-stat-card accent-blue">
            <span>Menu Items</span>
            <strong>{menuItems.length}</strong>
            <small>Items currently available for room-service ordering.</small>
          </article>
          <article className="guest-stat-card accent-violet">
            <span>Check-In Status</span>
            <strong>{checkedInBooking ? `Room ${checkedInBooking.room?.number || '-'}` : pendingCheckInBooking ? 'Awaiting Front Desk' : 'No stay'}</strong>
            <small>{checkedInBooking ? 'Orders will route to your checked-in room automatically.' : pendingCheckInBooking ? 'Front desk confirmation is still pending before food ordering unlocks.' : 'Book and check in to unlock room service.'}</small>
          </article>
          <article className="guest-stat-card accent-emerald">
            <span>Tray Total</span>
            <strong>{money(cartTotal)}</strong>
            <small>Live total for the items currently in your tray.</small>
          </article>
        </div>
      </section>
      {!canOrderFood && (
        <div className="notice warning">
          {pendingCheckInBooking
            ? `Your booking for Room ${pendingCheckInBooking.room?.number || '-'} is confirmed, but room service will unlock only after front desk completes check-in.`
            : 'Room service is available only for checked-in guests. Please complete booking and front desk check-in first.'}
        </div>
      )}
      {notice && <div className="notice success">{notice}</div>}
      {actionError && <div className="notice danger">{actionError}</div>}
      {error && <div className="notice warning">{error}</div>}
      <div className="guest-food-layout">
        <div className="menu-grid guest-menu-grid">
          {menuItems.map((item) => (
            <article className="guest-menu-card" key={item.id}>
              <img src={item.image || roomImages.burger} alt={item.name} />
              <div className="guest-menu-card-body">
                <div className="guest-menu-copy">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.category}</span>
                  </div>
                  <b>{money(item.price)}</b>
                </div>
                <p>{item.description || `Freshly prepared ${item.category.toLowerCase()} for room delivery.`}</p>
                <div className="guest-menu-actions">
                  <div className="guest-qty-control">
                    <button type="button" disabled={!canOrderFood} onClick={() => updateCart(item, -1)} aria-label={`Remove ${item.name}`}><span>-</span></button>
                    <strong>{cart[item.id] || 0}</strong>
                    <button type="button" disabled={!canOrderFood} onClick={() => updateCart(item, 1)} aria-label={`Add ${item.name}`}><span>+</span></button>
                  </div>
                  <button className="primary-button guest-header-button" type="button" disabled={!canOrderFood} onClick={() => updateCart(item, 1)}>
                    {canOrderFood ? 'Add to Tray' : 'Check-In Required'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <aside className="guest-cart-panel">
          <div className="guest-panel-head">
            <div>
              <strong>Your Tray</strong>
              <small>Review quantities and send the order to the kitchen.</small>
            </div>
          </div>
          <div className="guest-cart-list">
            {cartRows.length ? cartRows.map((item) => (
              <div className="guest-cart-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.quantity} x {money(item.price)}</small>
                </div>
                <b>{money(item.quantity * item.price)}</b>
              </div>
            )) : <EmptyState icon={Utensils} title="Your tray is empty" text="Add a few dishes and they will appear here with a live total." />}
          </div>
          <Field label="Notes for the Kitchen">
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Any dietary note, spice preference, or delivery request..." />
          </Field>
          <div className="guest-cart-total">
            <span>Total</span>
            <strong>{money(cartTotal)}</strong>
          </div>
          <button className="primary-button wide guest-header-button" disabled={!canOrderFood || !cartRows.length || submitting} onClick={submit}>
            {submitting ? 'Sending Order...' : canOrderFood ? 'Place Room-Service Order' : 'Front Desk Check-In Pending'}
          </button>
        </aside>
      </div>
    </section>
  );
}

function GuestFoodOrders() {
  const { data, error } = useLoad('/orders', { orders: [] }, { refreshMs: 15000 });
  const activeCount = data.orders.filter((order) => ['pending', 'cooking', 'ready'].includes(order.status)).length;
  const totalSpent = data.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  return (
    <section className="guest-page guest-food-orders-page">
      <PageHeader title="Food Orders" subtitle="Follow every room-service order from kitchen prep to final delivery." action={<Link className="ghost-button guest-link-button" to="/guest/order-food">Order Again</Link>} />
      <section className="guest-page-lead">
        <div className="guest-page-kicker"><ClipboardList size={15} /> Kitchen Tracker</div>
        <div className="guest-stat-grid">
          <article className="guest-stat-card accent-violet">
            <span>Total Orders</span>
            <strong>{data.orders.length}</strong>
            <small>All room-service orders linked to your guest account.</small>
          </article>
          <article className="guest-stat-card accent-blue">
            <span>Active Tickets</span>
            <strong>{activeCount}</strong>
            <small>Orders still moving through prep or delivery.</small>
          </article>
          <article className="guest-stat-card accent-emerald">
            <span>Total Spend</span>
            <strong>{money(totalSpent)}</strong>
            <small>Total food value currently stored in your order history.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <GuestOrdersTable orders={data.orders} />
    </section>
  );
}

function ProfileSettings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ firstName: user.firstName || '', lastName: user.lastName || '', phone: user.phone || '', address: user.address || '', avatar: user.avatar || '' });
  const [notice, setNotice] = useState('');
  const profileTitle = user.role === 'guest'
    ? 'Profile Settings'
    : ['housekeeping', 'kitchen'].includes(user.role)
      ? 'My Profile'
      : 'Account Settings';
  const roleSubtitle = user.role === 'housekeeping'
    ? 'Keep your housekeeping identity, contact details, and shift profile up to date.'
    : user.role === 'kitchen'
      ? 'Keep your kitchen identity, delivery contact details, and service profile ready for the next rush.'
      : user.role === 'guest'
        ? 'Manage your stay identity, booking contact details, and room-service preferences.'
        : 'Manage your personal information and contact details.';
  const heroBadge = user.role === 'kitchen' ? 'Kitchen Identity' : user.role === 'guest' ? 'Guest Identity' : 'Profile Spotlight';
  const completionCopy = user.role === 'kitchen'
    ? 'Keep your kitchen profile filled out so order handoffs, delivery logs, and team coordination stay sharp.'
    : user.role === 'guest'
      ? 'A complete guest profile keeps booking confirmation, room delivery, and hotel communication smooth.'
      : 'Keep your profile filled out so staff coordination stays clean and current.';
  const roleCopy = user.role === 'kitchen'
    ? 'Kitchen tools, delivery history, and ticket actions are tied to this account.'
    : user.role === 'guest'
      ? 'Your bookings, room-service activity, and loyalty details are linked to this profile.'
      : 'Role-aware tools and access are linked to this identity.';
  const contactHeadline = user.role === 'kitchen'
    ? form.phone ? 'Dispatch Ready' : 'Needs Update'
    : user.role === 'guest'
      ? form.phone ? 'Stay Ready' : 'Needs Update'
      : form.phone ? 'Ready' : 'Needs Update';
  const contactCopy = user.role === 'kitchen'
    ? form.phone ? 'Your kitchen line is ready for delivery coordination and shift handoffs.' : 'Add a reachable phone number for smoother delivery coordination.'
    : user.role === 'guest'
      ? form.phone ? 'Your booking contact line is ready for stay updates and room-service coordination.' : 'Add a phone number so the hotel can reach you smoothly during your stay.'
      : form.phone ? 'Your contact line is available for ops coordination.' : 'Add a phone number for smoother reach-outs.';
  const completionValues = [form.firstName, form.lastName, form.phone, form.address, form.avatar];
  const completion = Math.round((completionValues.filter((value) => String(value || '').trim()).length / completionValues.length) * 100);

  const submit = async (event) => {
    event.preventDefault();
    const data = await api('/users/me', { method: 'PATCH', body: form });
    setUser(data.user);
    setNotice('Profile updated.');
  };

  return (
    <section className={`profile-page ${user.role}-profile-page`}>
      <PageHeader title={profileTitle} subtitle={roleSubtitle} />
      {notice && <div className="notice success">{notice}</div>}
      <section className="profile-hero-strip">
        <div className="profile-hero-badge"><Sparkles size={15} /> {heroBadge}</div>
        <div className="profile-hero-grid">
          <article className="profile-hero-card accent-emerald">
            <span>Profile Completion</span>
            <strong>{completion}%</strong>
            <small>{completionCopy}</small>
          </article>
          <article className="profile-hero-card accent-blue">
            <span>Active Role</span>
            <strong>{roleLabel(user.role)}</strong>
            <small>{roleCopy}</small>
          </article>
          <article className="profile-hero-card accent-gold">
            <span>Contact Status</span>
            <strong>{contactHeadline}</strong>
            <small>{contactCopy}</small>
          </article>
        </div>
      </section>
      <section className="profile-layout enhanced-profile-layout">
        <div className="profile-card role-profile-card">
          <div className="role-profile-cover" />
          <div className="role-profile-avatar-shell">
            <img src={form.avatar || roomImages.login} alt={user.firstName} />
          </div>
          <h3>{user.firstName} {user.lastName}</h3>
          <div className="role-profile-pill-row">
            <StatusPill status={user.role} />
            <span className="profile-mail-chip">{user.email}</span>
          </div>
          <div className="profile-summary-list">
            <div className="profile-summary-item">
              <Phone size={16} />
              <div>
                <span>Phone</span>
                <strong>{form.phone || 'Not updated yet'}</strong>
              </div>
            </div>
            <div className="profile-summary-item">
              <Mail size={16} />
              <div>
                <span>Email</span>
                <strong>{user.email || 'Not available'}</strong>
              </div>
            </div>
            <div className="profile-summary-item">
              <Shield size={16} />
              <div>
                <span>Role</span>
                <strong>{roleLabel(user.role)}</strong>
              </div>
            </div>
          </div>
        </div>
        <form className="form-panel profile-form-panel" onSubmit={submit}>
          <div className="profile-form-head">
            <span>Personal Details</span>
            <strong>These details are saved to your backend profile record immediately after you submit.</strong>
            <div className="profile-form-progress">
              <div className="profile-form-progress-bar">
                <span style={{ width: `${completion}%` }} />
              </div>
              <small>{completion}% complete</small>
            </div>
          </div>
          <div className="profile-form-grid">
            <Field label="First Name">
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Last Name">
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="Phone Number">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Avatar URL">
              <input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
            </Field>
            <Field label="Address" className="room-field-span">
              <textarea rows={4} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
          </div>
          <div className="profile-actions">
            <button className="primary-button">Save Changes</button>
          </div>
        </form>
      </section>
    </section>
  );
}

function FrontOverview() {
  const { data, load, error } = useLoad('/frontdesk/overview', { stats: { expectedArrivals: 0, pendingDepartures: 0, totalOccupancy: 0 }, arrivals: [], departures: [], date: null }, { refreshMs: 15000 });
  const { data: rooms } = useLoad('/rooms/status', { rooms: [] }, { refreshMs: 15000 });
  const [processingId, setProcessingId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const availableRooms = rooms.rooms.filter((room) => room.status === 'available').length;
  const dirtyRooms = rooms.rooms.filter((room) => room.status === 'dirty').length;
  return (
    <section className="frontdesk-page frontdesk-dashboard-page">
      <PageHeader title="Front Desk Overview" subtitle={`Today's operations: ${dateText(data.date)}`} action={<Link className="primary-button frontdesk-add-button" to="/frontdesk/walk-in"><Plus size={16} /> New Walk-In</Link>} />
      <section className="frontdesk-lead">
        <div className="frontdesk-kicker"><DoorOpen size={15} /> Live Lobby Flow</div>
        <div className="frontdesk-stat-grid">
          <article className="frontdesk-stat-card accent-blue">
            <span>Arrivals Today</span>
            <strong>{data.stats.expectedArrivals}</strong>
            <small>Guests expected to reach the desk today.</small>
          </article>
          <article className="frontdesk-stat-card accent-violet">
            <span>Available Rooms</span>
            <strong>{availableRooms}</strong>
            <small>Rooms ready for new check-ins right now.</small>
          </article>
          <article className="frontdesk-stat-card accent-amber">
            <span>Dirty Rooms</span>
            <strong>{dirtyRooms}</strong>
            <small>Rooms waiting for housekeeping turnaround.</small>
          </article>
        </div>
      </section>
      {notice && <div className="notice success">{notice}</div>}
      {actionError && <div className="notice danger">{actionError}</div>}
      {error && <div className="notice danger">{error}</div>}
      <div className="dashboard-grid frontdesk-dashboard-metrics">
        <StatCard icon={CalendarCheck} label="Expected Arrivals" value={data.stats.expectedArrivals} />
        <StatCard icon={DoorOpen} label="Pending Departures" value={data.stats.pendingDepartures} />
        <StatCard icon={BarChart3} label="Total Occupancy" value={`${data.stats.totalOccupancy}%`} />
      </div>
      <div className="two-col frontdesk-queue-grid">
        <section className="form-panel frontdesk-queue-panel">
          <h2>Arrival Queue</h2>
          {data.arrivals.length ? data.arrivals.map((booking) => (
            <div className="queue-row frontdesk-queue-row" key={booking.id}>
              <span>
                {booking.guest?.firstName} {booking.guest?.lastName}
                <small>Room {booking.room?.number} · {booking.room?.type}</small>
              </span>
              <button
                className="primary-button"
                disabled={processingId === booking.id}
                onClick={async () => {
                  setProcessingId(booking.id);
                  setActionError('');
                  try {
                    await api(`/bookings/${booking.id}/check-in`, { method: 'PATCH' });
                    await load();
                    setNotice(`${fullName(booking.guest)} checked in to Room ${booking.room?.number}.`);
                  } catch (checkInError) {
                    setActionError(checkInError.message || 'Unable to check in this booking right now.');
                  } finally {
                    setProcessingId('');
                  }
                }}
              >
                {processingId === booking.id ? 'Checking In...' : 'Check In'}
              </button>
            </div>
          )) : <EmptyState />}
        </section>
        <section className="form-panel frontdesk-queue-panel">
          <h2>Departure Queue</h2>
          {data.departures.length ? data.departures.map((booking) => (
            <div className="queue-row frontdesk-queue-row" key={booking.id}>
              <span>
                {booking.guest?.firstName} {booking.guest?.lastName}
                <small>Room {booking.room?.number} · Checkout due {dateText(booking.checkOut)}</small>
              </span>
              <Link className="primary-button" to={`/frontdesk/invoice/${booking.id}`}>Bill</Link>
            </div>
          )) : <EmptyState />}
        </section>
      </div>
    </section>
  );
}

function WalkInBooking() {
  const { data, load, error } = useLoad('/rooms/status', { rooms: [] }, { refreshMs: 15000 });
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', roomId: '', checkIn: '', checkOut: '', guests: 1 });
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');
  const availableRooms = data.rooms.filter((room) => room.status === 'available');
  const roomTypes = Array.from(new Set(availableRooms.map((room) => room.type).filter(Boolean)));
  const uniqueRoomTypes = roomTypes.length;
  const filteredAvailableRooms = availableRooms.filter((room) => {
    const matchesType = roomTypeFilter === 'all' || room.type === roomTypeFilter;
    const haystack = `${room.number} ${room.type} ${room.capacity || ''} ${room.price || ''}`.toLowerCase();
    const matchesQuery = !roomQuery.trim() || haystack.includes(roomQuery.trim().toLowerCase());
    return matchesType && matchesQuery;
  });
  const selectedRoom = availableRooms.find((room) => room.id === form.roomId) || null;
  const stayNights = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return 0;
    const start = new Date(form.checkIn);
    const end = new Date(form.checkOut);
    const diff = Math.ceil((end - start) / 86400000);
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [form.checkIn, form.checkOut]);
  const estimatedTotal = selectedRoom && stayNights ? stayNights * Number(selectedRoom.price || 0) : 0;
  const guestName = `${form.firstName} ${form.lastName}`.trim() || 'Walk-in Guest';

  const submit = async (event) => {
    event.preventDefault();
    if (form.checkIn && form.checkOut && new Date(form.checkOut) <= new Date(form.checkIn)) {
      setFormError('Check-out must be later than check-in.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const result = await api('/bookings/walk-in', { method: 'POST', body: form });
      setNotice(`Guest checked in to Room ${result.booking.room.number}.`);
      setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', roomId: '', checkIn: '', checkOut: '', guests: 1 });
      await load();
    } catch (submitError) {
      setFormError(submitError.message || 'Unable to create walk-in booking.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="frontdesk-page frontdesk-walkin-page">
      <PageHeader title="Walk-In Booking" subtitle="Manual booking and guest creation in one step." />
      <section className="frontdesk-lead">
        <div className="frontdesk-kicker"><Plus size={15} /> Front Office Intake</div>
        <div className="frontdesk-stat-grid">
          <article className="frontdesk-stat-card accent-blue">
            <span>Available Rooms</span>
            <strong>{availableRooms.length}</strong>
            <small>Rooms open for immediate walk-in assignment.</small>
          </article>
          <article className="frontdesk-stat-card accent-violet">
            <span>Room Types</span>
            <strong>{uniqueRoomTypes}</strong>
            <small>Different room categories currently available.</small>
          </article>
          <article className="frontdesk-stat-card accent-amber">
            <span>Desk Mode</span>
            <strong>Live</strong>
            <small>Bookings are written straight into the backend and room inventory.</small>
          </article>
        </div>
      </section>
      {notice && <div className="notice success">{notice}</div>}
      {formError && <div className="notice danger">{formError}</div>}
      {error && <div className="notice danger">{error}</div>}
      <div className="frontdesk-composer-grid">
        <form className="form-panel grid-form frontdesk-form-shell frontdesk-form-shell-rich" onSubmit={submit}>
          <div className="frontdesk-form-heading">
            <div>
              <strong>Live Booking Composer</strong>
              <small>Every submission writes straight to the active booking inventory and guest database.</small>
            </div>
            <span className="frontdesk-data-pill success">DB Connected</span>
          </div>

          <div className="frontdesk-form-section-title">Guest Details</div>
          <Field label="First Name">
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </Field>
          <Field label="Last Name">
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </Field>
          <Field label="Email Address">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Phone Number">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </Field>
          <Field label="Address" className="frontdesk-field-full">
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Walk-in address or city" required />
          </Field>

          <div className="frontdesk-form-section-title">Stay Details</div>
          <Field label="Check In">
            <input type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} required />
          </Field>
          <Field label="Check Out">
            <input type="date" min={form.checkIn || undefined} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} required />
          </Field>
          <Field label="Guests">
            <input type="number" min="1" max={selectedRoom?.capacity || 8} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} required />
          </Field>

          <div className="frontdesk-form-section-title">Room Assignment</div>
          <div className="frontdesk-room-picker-toolbar frontdesk-field-full">
            <label className="frontdesk-search-control">
              <Search size={16} />
              <input
                value={roomQuery}
                onChange={(e) => setRoomQuery(e.target.value)}
                placeholder="Search room number or type"
              />
            </label>
            <div className="frontdesk-filter-row">
              <button type="button" className={`frontdesk-filter-chip ${roomTypeFilter === 'all' ? 'active' : ''}`.trim()} onClick={() => setRoomTypeFilter('all')}>All Types</button>
              {roomTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`frontdesk-filter-chip ${roomTypeFilter === type ? 'active' : ''}`.trim()}
                  onClick={() => setRoomTypeFilter(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <Field label="Select Room" className="frontdesk-field-full">
            <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} required>
              <option value="">Select Available Room</option>
              {filteredAvailableRooms.map((room) => <option key={room.id} value={room.id}>{room.number} - {room.type}</option>)}
            </select>
          </Field>
          <div className="frontdesk-room-picker frontdesk-field-full">
            {filteredAvailableRooms.slice(0, 6).map((room) => (
              <button
                key={room.id}
                type="button"
                className={`frontdesk-room-choice ${form.roomId === room.id ? 'active' : ''}`.trim()}
                onClick={() => setForm({ ...form, roomId: room.id })}
              >
                <strong>Room {room.number}</strong>
                <span>{room.type}</span>
                <small>{money(room.price)} / night · {room.capacity || 2} guests</small>
              </button>
            ))}
          </div>
          {!filteredAvailableRooms.length && (
            <div className="frontdesk-grid-empty frontdesk-field-full">
              <EmptyState icon={BedDouble} title="No rooms match this filter" text="Try another room type or search term." />
            </div>
          )}

          <button className="primary-button frontdesk-submit-button frontdesk-field-full" disabled={saving}>{saving ? 'Creating...' : 'Create Booking & Check In'}</button>
        </form>

        <aside className="frontdesk-preview-stack">
          <article className="frontdesk-preview-card frontdesk-preview-primary">
            <div className="frontdesk-preview-head">
              <div>
                <span>Booking Preview</span>
                <strong>{guestName}</strong>
              </div>
              <span className="frontdesk-data-pill">{selectedRoom ? 'Ready to Submit' : 'Select a Room'}</span>
            </div>
            {selectedRoom ? (
              <>
                <div className="frontdesk-preview-grid">
                  <div className="frontdesk-preview-metric">
                    <span>Assigned Room</span>
                    <strong>Room {selectedRoom.number}</strong>
                    <small>{selectedRoom.type}</small>
                  </div>
                  <div className="frontdesk-preview-metric">
                    <span>Stay Length</span>
                    <strong>{stayNights || '-'}</strong>
                    <small>{stayNights === 1 ? 'night' : 'nights'}</small>
                  </div>
                  <div className="frontdesk-preview-metric">
                    <span>Estimated Total</span>
                    <strong>{estimatedTotal ? money(estimatedTotal) : '-'}</strong>
                    <small>Room rate only</small>
                  </div>
                  <div className="frontdesk-preview-metric">
                    <span>Capacity</span>
                    <strong>{selectedRoom.capacity || 2}</strong>
                    <small>guest slots</small>
                  </div>
                </div>
                <div className="frontdesk-sync-note">
                  <Shield size={16} />
                  <span>This room will switch to occupied the moment the booking is created.</span>
                </div>
              </>
            ) : (
              <EmptyState icon={Hotel} title="Room preview waiting" text="Choose a room to preview stay details and live rate." />
            )}
          </article>

          <article className="frontdesk-preview-card">
            <div className="frontdesk-preview-head">
              <div>
                <span>Desk Snapshot</span>
                <strong>Available Inventory</strong>
              </div>
              <span className="frontdesk-data-pill">{availableRooms.length} open</span>
            </div>
            <div className="frontdesk-preview-list">
              {availableRooms.slice(0, 4).map((room) => (
                <div key={room.id} className="frontdesk-preview-list-item">
                  <div>
                    <strong>Room {room.number}</strong>
                    <small>{room.type}</small>
                  </div>
                  <span>{money(room.price)}</span>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function RoomStatus() {
  const { data, error } = useLoad('/rooms/status', { rooms: [] }, { refreshMs: 15000 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const counts = {
    available: data.rooms.filter((room) => room.status === 'available').length,
    occupied: data.rooms.filter((room) => room.status === 'occupied').length,
    dirty: data.rooms.filter((room) => room.status === 'dirty').length,
    maintenance: data.rooms.filter((room) => room.status === 'maintenance').length
  };
  const occupancyRate = data.rooms.length ? Math.round((counts.occupied / data.rooms.length) * 100) : 0;
  const filteredRooms = data.rooms.filter((room) => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'attention' && ['dirty', 'maintenance'].includes(room.status))
      || room.status === statusFilter;
    const haystack = `${room.number} ${room.type} ${room.status} ${room.housekeepingNote || ''}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesStatus && matchesQuery;
  });
  const attentionRooms = data.rooms.filter((room) => ['dirty', 'maintenance'].includes(room.status)).slice(0, 5);
  return (
    <section className="frontdesk-page frontdesk-roomstatus-page">
      <PageHeader title="Room Status" subtitle="Live view of room occupancy and housekeeping status." />
      <section className="frontdesk-lead">
        <div className="frontdesk-kicker"><BedDouble size={15} /> Inventory Snapshot</div>
        <div className="frontdesk-stat-grid">
          <article className="frontdesk-stat-card accent-blue">
            <span>Available</span>
            <strong>{counts.available}</strong>
            <small>Ready for immediate assignment or reservation.</small>
          </article>
          <article className="frontdesk-stat-card accent-violet">
            <span>Occupied</span>
            <strong>{counts.occupied}</strong>
            <small>Rooms currently checked in and active.</small>
          </article>
          <article className="frontdesk-stat-card accent-amber">
            <span>Attention Needed</span>
            <strong>{counts.dirty + counts.maintenance}</strong>
            <small>Dirty or maintenance rooms requiring follow-up.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <div className="frontdesk-control-shell">
        <label className="frontdesk-search-control">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search room number, type, or note" />
        </label>
        <div className="frontdesk-filter-row">
          <button type="button" className={`frontdesk-filter-chip ${statusFilter === 'all' ? 'active' : ''}`.trim()} onClick={() => setStatusFilter('all')}>All</button>
          <button type="button" className={`frontdesk-filter-chip ${statusFilter === 'available' ? 'active' : ''}`.trim()} onClick={() => setStatusFilter('available')}>Available</button>
          <button type="button" className={`frontdesk-filter-chip ${statusFilter === 'occupied' ? 'active' : ''}`.trim()} onClick={() => setStatusFilter('occupied')}>Occupied</button>
          <button type="button" className={`frontdesk-filter-chip ${statusFilter === 'attention' ? 'active' : ''}`.trim()} onClick={() => setStatusFilter('attention')}>Attention Needed</button>
        </div>
      </div>
      <div className="frontdesk-room-layout">
        <div>
          <div className="legend-row">
            <StatusPill status="available" />
            <StatusPill status="occupied" />
            <StatusPill status="dirty" />
            <StatusPill status="maintenance" />
          </div>
          <div className="status-grid frontdesk-status-grid">
            {filteredRooms.length ? filteredRooms.map((room) => (
              <article key={room.id} className={`status-room frontdesk-status-room ${room.status}`}>
                <div className="frontdesk-status-card-top">
                  <div>
                    <strong>Room {room.number}</strong>
                    <span>{room.type}</span>
                  </div>
                  <StatusPill status={room.status} />
                </div>
                <div className="frontdesk-room-meta">
                  <span>{money(room.price)} / night</span>
                  <span>{room.capacity || 2} guests</span>
                </div>
                <p className="frontdesk-status-note">
                  {room.housekeepingNote || (room.status === 'available'
                    ? 'Ready for assignment right now.'
                    : room.status === 'occupied'
                      ? 'Currently in-house with an active guest.'
                      : room.status === 'dirty'
                        ? 'Needs housekeeping turnover before reuse.'
                        : 'Waiting for maintenance follow-up.')}
                </p>
                <div className="frontdesk-status-foot">
                  <small>Desk visibility</small>
                  <strong>{room.status[0].toUpperCase()}{room.status.slice(1)}</strong>
                </div>
              </article>
            )) : (
              <div className="frontdesk-grid-empty">
                <EmptyState icon={BedDouble} title="No rooms match these filters" text="Try another status or search term to widen the desk view." />
              </div>
            )}
          </div>
        </div>

        <aside className="frontdesk-room-rail">
          <article className="frontdesk-preview-card">
            <div className="frontdesk-preview-head">
              <div>
                <span>Live Occupancy</span>
                <strong>{occupancyRate}%</strong>
              </div>
              <span className="frontdesk-data-pill">Auto Refresh</span>
            </div>
            <div className="frontdesk-progress-track">
              <div className="frontdesk-progress-bar" style={{ width: `${occupancyRate}%` }} />
            </div>
            <div className="frontdesk-preview-grid compact">
              <div className="frontdesk-preview-metric">
                <span>Total Rooms</span>
                <strong>{data.rooms.length}</strong>
              </div>
              <div className="frontdesk-preview-metric">
                <span>Open Now</span>
                <strong>{counts.available}</strong>
              </div>
            </div>
          </article>

          <article className="frontdesk-preview-card">
            <div className="frontdesk-preview-head">
              <div>
                <span>Attention Board</span>
                <strong>Immediate Follow-Up</strong>
              </div>
              <span className="frontdesk-data-pill warning">{attentionRooms.length}</span>
            </div>
            <div className="frontdesk-alert-list">
              {attentionRooms.length ? attentionRooms.map((room) => (
                <div key={room.id} className="frontdesk-alert-item">
                  <div>
                    <strong>Room {room.number}</strong>
                    <small>{room.type}</small>
                  </div>
                  <StatusPill status={room.status} />
                </div>
              )) : <EmptyState icon={Sparkles} title="All rooms stable" text="No dirty or maintenance rooms need attention right now." />}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function FrontGuests() {
  const { data, error } = useLoad('/admin/guests', { guests: [] }, { refreshMs: 15000 });
  const [query, setQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState('all');
  const guestsWithPhone = data.guests.filter((guest) => guest.phone).length;
  const guestsWithEmail = data.guests.filter((guest) => guest.email).length;
  const walkIns = data.guests.filter((guest) => !guest.address).length;
  const filteredGuests = data.guests.filter((guest) => {
    const matchesFilter = guestFilter === 'all'
      || (guestFilter === 'walk-in' && !guest.address)
      || (guestFilter === 'contact-ready' && (guest.phone || guest.email))
      || (guestFilter === 'email-missing' && !guest.email);
    const haystack = `${fullName(guest)} ${guest.username || ''} ${guest.email || ''} ${guest.phone || ''} ${guest.address || ''}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <section className="frontdesk-page frontdesk-guests-page guests-page">
      <PageHeader title="Guest List" subtitle="Front desk view of registered guests and walk-ins." />
      <section className="frontdesk-lead">
        <div className="frontdesk-kicker"><Users size={15} /> Guest Directory</div>
        <div className="frontdesk-stat-grid">
          <article className="frontdesk-stat-card accent-blue">
            <span>Total Guests</span>
            <strong>{data.guests.length}</strong>
            <small>Guest records currently available to the desk.</small>
          </article>
          <article className="frontdesk-stat-card accent-violet">
            <span>With Phone</span>
            <strong>{guestsWithPhone}</strong>
            <small>Records ready for direct front-office contact.</small>
          </article>
          <article className="frontdesk-stat-card accent-amber">
            <span>Walk-Ins</span>
            <strong>{walkIns}</strong>
            <small>Guest records created without a saved address.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <div className="frontdesk-directory-shell">
        <div className="frontdesk-control-shell frontdesk-directory-controls">
          <label className="frontdesk-search-control">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guest name, username, phone, or email" />
          </label>
          <div className="frontdesk-filter-row">
            <button type="button" className={`frontdesk-filter-chip ${guestFilter === 'all' ? 'active' : ''}`.trim()} onClick={() => setGuestFilter('all')}>All Guests</button>
            <button type="button" className={`frontdesk-filter-chip ${guestFilter === 'walk-in' ? 'active' : ''}`.trim()} onClick={() => setGuestFilter('walk-in')}>Walk-Ins</button>
            <button type="button" className={`frontdesk-filter-chip ${guestFilter === 'contact-ready' ? 'active' : ''}`.trim()} onClick={() => setGuestFilter('contact-ready')}>Contact Ready</button>
            <button type="button" className={`frontdesk-filter-chip ${guestFilter === 'email-missing' ? 'active' : ''}`.trim()} onClick={() => setGuestFilter('email-missing')}>Missing Email</button>
          </div>
        </div>

        {filteredGuests.length ? (
          <TableShell className="guest-table-shell frontdesk-guests-shell">
            <thead>
              <tr>
                <th>GUEST</th>
                <th>CONTACT INFO</th>
                <th>ADDRESS</th>
                <th>JOINED DATE</th>
                <th>COMM STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    <div className="booking-guest-cell guest-guest-cell">
                      <span className="booking-avatar guest-avatar">
                        {guest.avatar
                          ? <img src={guest.avatar} alt={fullName(guest)} />
                          : <span>{userInitials(guest)}</span>}
                      </span>
                      <div className="booking-guest-copy guest-guest-copy">
                        <strong>{fullName(guest)}</strong>
                        <small>@{guest.username || 'guest'}</small>
                        <span className={`frontdesk-guest-badge ${guest.address ? 'registered' : 'walk-in'}`.trim()}>
                          {guest.address ? 'Registered' : 'Walk-In'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="guest-contact-cell">
                      {guest.phone ? <a className="frontdesk-contact-link" href={`tel:${guest.phone}`}><Phone size={15} /> {guest.phone}</a> : <span><Phone size={15} /> -</span>}
                      {guest.email ? <a className="frontdesk-contact-link" href={`mailto:${guest.email}`}><Mail size={15} /> {guest.email}</a> : <small><Mail size={15} /> -</small>}
                    </div>
                  </td>
                  <td>{guest.address || 'Walk-in Guest'}</td>
                  <td>
                    <div className="frontdesk-date-stack">
                      <strong>{dateText(guest.createdAt)}</strong>
                      <small>{timeAgoText(guest.createdAt)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="frontdesk-status-stack">
                      <StatusPill status={guest.email || guest.phone ? 'available' : 'maintenance'} label={guest.email || guest.phone ? 'Reachable' : 'Missing Contact'} />
                      <small>{guest.email ? 'Email ready' : 'Desk follow-up needed'}</small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <div className="frontdesk-grid-empty">
            <EmptyState icon={Users} title="No guests match this view" text="Change the filter or search term to widen the guest directory." />
          </div>
        )}
      </div>
    </section>
  );
}

function FrontBookings() {
  const { data, load, error } = useLoad('/bookings', { bookings: [] }, { refreshMs: 15000 });
  const confirmed = data.bookings.filter((booking) => booking.status === 'confirmed').length;
  const checkedIn = data.bookings.filter((booking) => booking.status === 'checked-in').length;
  const completed = data.bookings.filter((booking) => booking.status === 'completed').length;
  return (
    <section className="frontdesk-page frontdesk-bookings-page booking-page">
      <PageHeader title="All Bookings" subtitle="Complete history of reservations and billing status." />
      <section className="frontdesk-lead">
        <div className="frontdesk-kicker"><CalendarCheck size={15} /> Reservation Timeline</div>
        <div className="frontdesk-stat-grid">
          <article className="frontdesk-stat-card accent-blue">
            <span>Confirmed</span>
            <strong>{confirmed}</strong>
            <small>Reservations waiting for arrival and check-in.</small>
          </article>
          <article className="frontdesk-stat-card accent-violet">
            <span>Checked In</span>
            <strong>{checkedIn}</strong>
            <small>Guests currently staying in-house.</small>
          </article>
          <article className="frontdesk-stat-card accent-amber">
            <span>Completed</span>
            <strong>{completed}</strong>
            <small>Stays already checked out and billed.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      <BookingsTable bookings={data.bookings} onChanged={load} admin />
    </section>
  );
}

function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, load } = useLoad(`/bookings/${id}/invoice`, { invoice: null });
  const [paymentMethod, setPaymentMethod] = useState('Credit/Debit Card');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const invoice = data.invoice;
  const backPath = location.pathname.startsWith('/admin/') ? '/admin/bookings' : '/frontdesk';

  useEffect(() => {
    if (invoice?.booking?.paymentMethod) setPaymentMethod(invoice.booking.paymentMethod);
  }, [invoice?.booking?.paymentMethod]);

  const checkout = async () => {
    setPaymentBusy(true);
    setPaymentError('');
    setPaymentNotice('');
    try {
      const result = await api(`/bookings/${id}/checkout`, { method: 'PATCH', body: { paymentMethod } });
      if (result.mail?.sent) setPaymentNotice('Checkout completed and bill emailed to the guest.');
      else if (result.mail?.configured) setPaymentNotice('Checkout completed, but the bill email could not be sent.');
      await load();
      navigate(backPath);
    } catch (error) {
      setPaymentError(error.message || 'Unable to complete checkout.');
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadInvoiceDocument(invoice);
    } catch (error) {
      window.alert(error.message || 'Unable to download invoice.');
    }
  };

  const handleRazorpayCheckout = async () => {
    setPaymentBusy(true);
    setPaymentError('');
    setPaymentNotice('');

    try {
      await loadExternalScript('https://checkout.razorpay.com/v1/checkout.js');
      if (!window.Razorpay) throw new Error('Razorpay checkout did not load.');

      const orderData = await api('/payments/razorpay/order', {
        method: 'POST',
        body: { bookingId: id }
      });

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Utkal Reserve',
        description: `Checkout for Room ${orderData.invoice.roomNumber}`,
        order_id: orderData.order.id,
        prefill: orderData.prefill,
        notes: orderData.order.notes,
        theme: { color: '#2952e1' },
        handler: async (response) => {
          try {
            const verification = await api('/payments/razorpay/verify', {
              method: 'POST',
              body: {
                bookingId: id,
                ...response
              }
            });
            if (verification.mail?.sent) setPaymentNotice('Payment successful and the checkout bill was emailed to the guest.');
            else if (verification.mail?.configured) setPaymentNotice('Payment successful, but the checkout bill email could not be sent.');
            await load();
            navigate(backPath);
          } catch (error) {
            setPaymentError(error.message || 'Payment verification failed.');
          } finally {
            setPaymentBusy(false);
          }
        },
        modal: {
          ondismiss: () => setPaymentBusy(false)
        }
      });

      razorpay.on('payment.failed', (response) => {
        const message = response?.error?.description || response?.error?.reason || 'Payment failed before checkout could complete.';
        setPaymentError(message);
        setPaymentBusy(false);
      });

      razorpay.open();
    } catch (error) {
      setPaymentError(error.message || 'Unable to launch Razorpay checkout.');
      setPaymentBusy(false);
    }
  };

  if (!invoice) return <EmptyState title="Invoice loading" />;
  return (
    <section className="invoice-page">
      <div className="invoice-actions">
        <Link to={backPath}>Back to Dashboard</Link>
        <div className="invoice-action-buttons">
          <button className="outline-button invoice-download-button" onClick={handleDownload}><Download size={15} /> Download Invoice</button>
          <button className="outline-button" onClick={() => window.print()}>Print Invoice</button>
        </div>
      </div>
      <article className="invoice">
        <div className="invoice-head">
          <div>
            <h1>Utkal Reserve</h1>
            <p>Your Stay, Our Priority</p>
            <p>123 Luxury Avenue, Bhubaneswar</p>
          </div>
          <div className="invoice-head-side">
            <span className={`invoice-badge ${invoice.booking.status === 'completed' ? 'paid' : 'pending'}`}>
              {invoice.booking.status === 'completed' ? 'PAID' : 'PENDING'}
            </span>
            <strong>INVOICE</strong>
            <span>Room {invoice.booking.room.number}</span>
            <span>{dateText(new Date())}</span>
          </div>
        </div>
        <div className="invoice-body">
          {paymentError && <div className="notice danger">{paymentError}</div>}
          {paymentNotice && <div className="notice success">{paymentNotice}</div>}
          <div className="invoice-meta">
            <div><b>Bill To</b><span>{invoice.booking.guest.firstName} {invoice.booking.guest.lastName}</span><small>{invoice.booking.guest.email}</small></div>
            <div><b>Stay Details</b><span>Room {invoice.booking.room.number} - {invoice.booking.room.type}</span><small>{dateText(invoice.booking.checkIn)} - {dateText(invoice.booking.checkOut)}</small><small>{invoice.nights} night(s)</small></div>
          </div>
          <table>
            <thead><tr><th>Description</th><th>Qty / Days</th><th>Unit Price</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Room Charges ({invoice.booking.room.type})</td><td>{invoice.nights}</td><td>{money(invoice.booking.roomRate)}</td><td>{money(invoice.roomTotal)}</td></tr>
              {invoice.orders.map((order) => <tr key={order.id}><td>Room Service: {order.items.map((item) => item.name).join(', ')}</td><td>1</td><td>{money(order.total)}</td><td>{money(order.total)}</td></tr>)}
            </tbody>
          </table>
          <div className="invoice-total">
            <span><b>Subtotal</b><b>{money(invoice.roomTotal + invoice.foodTotal)}</b></span>
            <span><b>Taxes</b><b>{money(invoice.taxTotal)}</b></span>
            <strong><span>Total Due</span><span>{money(invoice.grandTotal)}</span></strong>
          </div>
          {invoice.booking.status !== 'completed' && (
            <div className="checkout-box">
              <Field label="Payment Method">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option>Credit/Debit Card</option>
                  <option>Cash</option>
                  <option>Online Transfer</option>
                  <option>Razorpay</option>
                </select>
              </Field>
              <button className="primary-button" onClick={paymentMethod === 'Razorpay' ? handleRazorpayCheckout : checkout} disabled={paymentBusy}>
                {paymentBusy ? 'Processing...' : paymentMethod === 'Razorpay' ? 'Pay with Razorpay & Checkout' : 'Confirm Paid'}
              </button>
            </div>
          )}
          {invoice.booking.status === 'completed' && <div className="notice success">PAID - Thank you for staying with us.</div>}
        </div>
      </article>
    </section>
  );
}

function KitchenBoard() {
  const { user } = useAuth();
  const { data, load, error } = useLoad('/orders?active=true', { orders: [] }, { refreshMs: 10000 });
  const [workingId, setWorkingId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const nextStatus = { pending: 'cooking', cooking: 'ready', ready: 'delivered' };
  const label = { pending: 'Start Cooking', cooking: 'Mark Ready', ready: 'Complete' };
  const pendingCount = data.orders.filter((order) => order.status === 'pending').length;
  const readyCount = data.orders.filter((order) => order.status === 'ready').length;
  const totalItems = data.orders.reduce((sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + Number(item.quantity || 0), 0), 0);
  const activeRooms = new Set(data.orders.map((order) => order.room?.number).filter(Boolean)).size;
  const recentOrders = [...data.orders]
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
    .slice(0, 5);

  const advanceOrder = async (order) => {
    setWorkingId(order.id);
    setNotice('');
    setActionError('');
    try {
      await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: nextStatus[order.status] } });
      await load();
      setNotice(`Room ${order.room?.number || '-'} moved to ${nextStatus[order.status]}.`);
    } catch (err) {
      setActionError(err.message || 'Unable to update this order.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="kitchen-role-page kitchen-active-page">
      <PageHeader title="Active Orders" subtitle="Live kitchen queue for room service preparation and delivery handoff." action={<span className="soft-badge">{data.orders.length} live tickets</span>} />
      <section className="kitchen-page-lead">
        <div className="kitchen-page-badge"><ChefHat size={15} /> Kitchen Command</div>
        <div className="kitchen-page-stat-row">
          <article className="kitchen-page-stat-card accent-orange">
            <span>Active Tickets</span>
            <strong>{data.orders.length}</strong>
            <small>Orders currently moving through the kitchen line.</small>
          </article>
          <article className="kitchen-page-stat-card accent-blue">
            <span>Ready For Delivery</span>
            <strong>{readyCount}</strong>
            <small>Orders plated and waiting for the final handoff.</small>
          </article>
          <article className="kitchen-page-stat-card accent-emerald">
            <span>Queue Load</span>
            <strong>{totalItems} items</strong>
            <small>{activeRooms} room{activeRooms === 1 ? '' : 's'} are currently requesting service.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      {actionError && <div className="notice danger">{actionError}</div>}
      {notice && <div className="notice success">{notice}</div>}
      {data.orders.length ? (
        <div className="kitchen-role-layout">
          <div className="order-grid kitchen-active-grid">
            {data.orders.map((order) => {
              const itemCount = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
              return (
                <article key={order.id} className={`kitchen-ticket-card ticket-${order.status}`}>
                  <div className="kitchen-ticket-top">
                    <div>
                      <span className="kitchen-ticket-kicker">Room {order.room?.number || '-'}</span>
                      <h3>{fullName(order.guest)}</h3>
                      <small>{order.room?.type || 'Room service'} · {itemCount} item{itemCount === 1 ? '' : 's'}</small>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="kitchen-ticket-meta">
                    <span><Receipt size={14} /> {money(order.total)}</span>
                    <span><ClipboardList size={14} /> {dateText(order.createdAt)}</span>
                    <span><CheckCircle2 size={14} /> {timeText(order.updatedAt || order.createdAt)}</span>
                  </div>
                  <div className="kitchen-ticket-items">
                    {order.items.map((item) => (
                      <div className="kitchen-ticket-item" key={`${order.id}-${item.name}`}>
                        <strong>{item.quantity}x</strong>
                        <span>{item.name}</span>
                        <small>{money(item.price)}</small>
                      </div>
                    ))}
                  </div>
                  {order.notes && <p className="kitchen-ticket-note">{order.notes}</p>}
                  <div className="kitchen-ticket-foot">
                    <div className="kitchen-ticket-assignee">
                      <span>{userInitials(user)}</span>
                      <div>
                        <strong>{fullName(user)}</strong>
                        <small>Kitchen station owner</small>
                      </div>
                    </div>
                    <button className="primary-button kitchen-action-button" disabled={workingId === order.id} onClick={() => advanceOrder(order)}>
                      {workingId === order.id ? 'Saving...' : label[order.status]}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="kitchen-role-rail">
            <article className="kitchen-feed-card">
              <div className="kitchen-feed-card-head">
                <strong>Queue Snapshot</strong>
                <small>Live board refreshes automatically.</small>
              </div>
              <div className="kitchen-feed-card-grid">
                <div>
                  <span>Pending</span>
                  <strong>{pendingCount}</strong>
                </div>
                <div>
                  <span>Cooking</span>
                  <strong>{data.orders.filter((order) => order.status === 'cooking').length}</strong>
                </div>
                <div>
                  <span>Ready</span>
                  <strong>{readyCount}</strong>
                </div>
                <div>
                  <span>Avg Ticket</span>
                  <strong>{data.orders.length ? money(data.orders.reduce((sum, order) => sum + Number(order.total || 0), 0) / data.orders.length) : money(0)}</strong>
                </div>
              </div>
            </article>
            <article className="kitchen-feed-card">
              <div className="kitchen-feed-card-head">
                <strong>Latest Rooms</strong>
                <small>Recent tickets that still need kitchen attention.</small>
              </div>
              <div className="kitchen-feed-card-list">
                {recentOrders.map((order) => (
                  <button type="button" key={`room-${order.id}`} className="kitchen-feed-list-item">
                    <div>
                      <strong>Room {order.room?.number || '-'}</strong>
                      <small>{fullName(order.guest)} · {order.items.map((item) => item.name).join(', ')}</small>
                    </div>
                    <StatusPill status={order.status} />
                  </button>
                ))}
              </div>
            </article>
          </aside>
        </div>
      ) : <EmptyState icon={ChefHat} title="All caught up" text="There are no active room service orders." />}
    </section>
  );
}

function KitchenHistory() {
  const { data, error } = useLoad('/orders?history=true', { orders: [] }, { refreshMs: 15000 });
  const totalRevenue = data.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const averageTicket = data.orders.length ? totalRevenue / data.orders.length : 0;
  const uniqueRooms = new Set(data.orders.map((order) => order.room?.number).filter(Boolean)).size;
  const topServers = Object.values(
    data.orders.reduce((acc, order) => {
      const key = order.deliveredBy?.id || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: order.deliveredBy ? fullName(order.deliveredBy) : 'Unknown',
          avatar: order.deliveredBy ? staffAvatarUrl(order.deliveredBy) : '',
          initials: order.deliveredBy ? initialsFromPerson(order.deliveredBy) : '?',
          count: 0
        };
      }
      acc[key].count += 1;
      return acc;
    }, {})
  )
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 3);

  return (
    <section className="kitchen-role-page kitchen-history-page">
      <PageHeader title="Delivery History" subtitle="Delivered room service records synced from the backend order log." />
      <section className="kitchen-page-lead">
        <div className="kitchen-page-badge"><ClipboardList size={15} /> Delivery Ledger</div>
        <div className="kitchen-page-stat-row">
          <article className="kitchen-page-stat-card accent-emerald">
            <span>Delivered Orders</span>
            <strong>{data.orders.length}</strong>
            <small>Completed tickets currently stored in kitchen history.</small>
          </article>
          <article className="kitchen-page-stat-card accent-blue">
            <span>Total Value</span>
            <strong>{money(totalRevenue)}</strong>
            <small>Combined value of delivered room service orders.</small>
          </article>
          <article className="kitchen-page-stat-card accent-orange">
            <span>Average Ticket</span>
            <strong>{money(averageTicket)}</strong>
            <small>{uniqueRooms} room{uniqueRooms === 1 ? '' : 's'} have been served from this log.</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      {topServers.length > 0 && (
        <section className="kitchen-top-servers">
          {topServers.map((server, index) => (
            <article key={server.id} className="kitchen-server-card">
              <span className="kitchen-server-rank">#{index + 1}</span>
              <span className="kitchen-server-avatar">
                {server.avatar
                  ? <img src={server.avatar} alt={server.name} />
                  : <span>{server.initials}</span>}
              </span>
              <div>
                <strong>{server.name}</strong>
                <small>{server.count} order{server.count === 1 ? '' : 's'} delivered</small>
              </div>
            </article>
          ))}
        </section>
      )}
      {data.orders.length ? (
        <TableShell className="kitchen-history-shell">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Room</th>
              <th>Guest</th>
              <th>Items</th>
              <th>Delivered By</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="kitchen-history-date">
                  <strong>{dateText(order.updatedAt || order.createdAt)}</strong>
                  <small>{timeText(order.updatedAt || order.createdAt)}</small>
                </td>
                <td className="kitchen-history-room">
                  <span className="booking-room-chip">Room {order.room?.number || '-'}</span>
                  <small>{order.room?.type || 'Room service'}</small>
                </td>
                <td className="kitchen-history-guest">
                  <strong>{fullName(order.guest)}</strong>
                  <small>{order.guest?.email || 'Guest profile'}</small>
                </td>
                <td className="kitchen-history-items">
                  <strong>{order.items.map((item) => item.name).join(', ')}</strong>
                  <small>{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} total items</small>
                </td>
                <td className="kitchen-history-staff">
                  <span className="kitchen-history-avatar">
                    {order.deliveredBy?.avatar
                      ? <img src={order.deliveredBy.avatar} alt={fullName(order.deliveredBy)} />
                      : <span>{order.deliveredBy ? initialsFromPerson(order.deliveredBy) : '?'}</span>}
                  </span>
                  <div>
                    <strong>{order.deliveredBy ? fullName(order.deliveredBy) : 'Unknown'}</strong>
                    <small>{order.deliveredBy?.role ? roleLabel(order.deliveredBy.role) : 'Delivery handoff'}</small>
                  </div>
                </td>
                <td className="kitchen-history-value">{money(order.total)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <EmptyState icon={ClipboardList} title="No delivered orders yet" text="Completed room service tickets will appear here once orders are handed off." />}
    </section>
  );
}

function HousekeepingBoard() {
  const { data, load, error } = useLoad('/housekeeping/tasks', { rooms: [], pending: 0 }, { refreshMs: 10000 });
  const [workingId, setWorkingId] = useState('');
  const [notice, setNotice] = useState('');
  const dirtyCount = data.rooms.filter((room) => room.status === 'dirty').length;
  const maintenanceCount = data.rooms.filter((room) => room.status === 'maintenance').length;

  const markClean = async (room) => {
    setWorkingId(room.id);
    setNotice('');
    try {
      await api(`/housekeeping/rooms/${room.id}/clean`, { method: 'PATCH' });
      await load();
      setNotice(`Room ${room.number} marked as clean.`);
    } finally {
      setWorkingId('');
    }
  };

  return (
    <section className="housekeeping-page housekeeping-board-page">
      <PageHeader title="Cleaning Tasks" subtitle="Overview of rooms requiring cleaning service." action={<span className="soft-badge">{data.pending} tasks</span>} />
      <section className="housekeeping-lead">
        <div className="housekeeping-kicker"><Sparkles size={15} /> Live Task Board</div>
        <div className="housekeeping-stat-grid">
          <article className="housekeeping-stat-card">
            <span>Pending Rooms</span>
            <strong>{data.pending}</strong>
            <small>Rooms still waiting for housekeeping action</small>
          </article>
          <article className="housekeeping-stat-card">
            <span>Dirty</span>
            <strong>{dirtyCount}</strong>
            <small>Rooms that need standard cleaning turnaround</small>
          </article>
          <article className="housekeeping-stat-card">
            <span>Maintenance</span>
            <strong>{maintenanceCount}</strong>
            <small>Rooms flagged for engineering or special follow-up</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}
      {data.rooms.length ? (
        <div className="task-grid housekeeping-task-grid">
          {data.rooms.map((room) => (
            <article className="task-card housekeeping-task-card" key={room.id}>
              <div className="housekeeping-task-head">
                <div>
                  <h3>Room {room.number}</h3>
                  <small>{room.type}</small>
                </div>
                <StatusPill status={room.status} />
              </div>
              <div className="housekeeping-task-meta">
                <span><BedDouble size={15} /> {room.type}</span>
                <span><Sparkles size={15} /> {room.status === 'maintenance' ? 'Needs engineering review' : 'Needs cleaning attention'}</span>
              </div>
              <p className="housekeeping-task-note">{room.housekeepingNote || `${room.type} requires verification.`}</p>
              <div className="housekeeping-task-actions">
                <button className="primary-button housekeeping-action-button" disabled={workingId === room.id} onClick={() => markClean(room)}>
                  {workingId === room.id ? 'Saving...' : 'Mark as Clean'}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={Sparkles} title="All caught up" text="There are no dirty rooms at this moment." />}
    </section>
  );
}

function HousekeepingHistory() {
  const { data, error } = useLoad('/housekeeping/history', { logs: [] }, { refreshMs: 15000 });
  const verifiedCount = data.logs.filter((log) => log.verified).length;
  const roomsCovered = new Set(data.logs.map((log) => log.room?.number).filter(Boolean)).size;
  return (
    <section className="housekeeping-page housekeeping-history-page">
      <PageHeader title="My Cleaning History" subtitle="Record of rooms cleaned and verified." />
      <section className="housekeeping-lead">
        <div className="housekeeping-kicker"><ClipboardList size={15} /> Verified Activity</div>
        <div className="housekeeping-stat-grid">
          <article className="housekeeping-stat-card">
            <span>Total Logs</span>
            <strong>{data.logs.length}</strong>
            <small>Cleaning actions currently stored in history</small>
          </article>
          <article className="housekeeping-stat-card">
            <span>Verified</span>
            <strong>{verifiedCount}</strong>
            <small>Logs that completed with verification enabled</small>
          </article>
          <article className="housekeeping-stat-card">
            <span>Rooms Covered</span>
            <strong>{roomsCovered}</strong>
            <small>Unique rooms included in your current history</small>
          </article>
        </div>
      </section>
      {error && <div className="notice danger">{error}</div>}
      {data.logs.length ? (
        <TableShell className="housekeeping-history-shell">
          <thead><tr><th>Date Complete</th><th>Room</th><th>Housekeeper</th><th>Status</th></tr></thead>
          <tbody>
            {data.logs.map((log) => (
              <tr key={log.id}>
                <td className="housekeeping-history-date">
                  <strong>{dateText(log.completedAt)}</strong>
                  <small>{timeText(log.completedAt)}</small>
                </td>
                <td className="housekeeping-history-room">
                  <span className="housekeeping-history-room-chip">Room {log.room?.number || '-'}</span>
                  <small>{log.room?.type || 'Room record'}</small>
                </td>
                <td>
                  <div className="history-housekeeper-cell">
                    <span className="history-housekeeper-avatar">
                      {log.housekeeper?.avatar
                        ? <img src={log.housekeeper.avatar} alt={fullName(log.housekeeper)} />
                        : <span>{userInitials(log.housekeeper)}</span>}
                    </span>
                    <strong>{fullName(log.housekeeper)}</strong>
                  </div>
                </td>
                <td><StatusPill status={log.status} label={log.verified ? 'Verified' : log.status} /></td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      ) : <EmptyState icon={ClipboardList} title="No cleaning history yet" text="Completed room cleaning records will appear here." />}
    </section>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="rooms" element={<PublicRoomsPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<RoleShell nav={adminNav} theme="admin-theme" title="Admin Panel" icon={Shield} />}>
          <Route index element={<AdminDashboard />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="staff/history" element={<StaffCleaningHistory />} />
          <Route path="staff/add" element={<StaffManagement />} />
          <Route path="staff/:staffId/edit" element={<StaffManagement />} />
          <Route path="rooms" element={<AdminRooms />} />
          <Route path="rooms/add" element={<AdminRooms />} />
          <Route path="rooms/:roomId/edit" element={<AdminRooms />} />
          <Route path="kitchen/menu" element={<AdminMenu />} />
          <Route path="kitchen/menu/add" element={<AdminMenu />} />
          <Route path="kitchen/menu/:menuId/edit" element={<AdminMenu />} />
          <Route path="kitchen/monitor" element={<AdminKitchenMonitor />} />
          <Route path="kitchen/history" element={<AdminKitchenDeliveryHistory />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="invoice/:id" element={<InvoicePage />} />
          <Route path="guests" element={<AdminGuests />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['guest']} />}>
        <Route path="/guest" element={<RoleShell nav={guestNav} theme="guest-theme" title="Guest Portal" icon={Hotel} />}>
          <Route index element={<GuestDashboard />} />
          <Route path="bookings" element={<GuestBookings />} />
          <Route path="book-room" element={<GuestBookRoom />} />
          <Route path="order-food" element={<GuestOrderFood />} />
          <Route path="food-orders" element={<GuestFoodOrders />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['frontdesk']} />}>
        <Route path="/frontdesk" element={<RoleShell nav={frontNav} theme="front-theme" title="Front Desk" icon={DoorOpen} />}>
          <Route index element={<FrontOverview />} />
          <Route path="bookings" element={<FrontBookings />} />
          <Route path="walk-in" element={<WalkInBooking />} />
          <Route path="rooms" element={<RoomStatus />} />
          <Route path="guests" element={<FrontGuests />} />
          <Route path="invoice/:id" element={<InvoicePage />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['kitchen']} />}>
        <Route path="/kitchen" element={<RoleShell nav={kitchenNav} theme="kitchen-theme" title="Kitchen" icon={ChefHat} />}>
          <Route index element={<KitchenBoard />} />
          <Route path="history" element={<KitchenHistory />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['housekeeping']} />}>
        <Route path="/housekeeping" element={<RoleShell nav={housekeepingNav} theme="housekeeping-theme" title="Housekeeping" icon={Sparkles} />}>
          <Route index element={<HousekeepingBoard />} />
          <Route path="history" element={<HousekeepingHistory />} />
          <Route path="profile" element={<ProfileSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
