import { useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Aperture, ChevronLeft, ChevronRight, Images, LayoutDashboard, LogOut, Mail,
  Menu, Settings as SettingsIcon, Tags, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import MediaLibrary from './pages/MediaLibrary';
import Settings from './pages/Settings';
import ContentEditor from './components/ContentEditor';
import './styles.css';

const navigation = [
  {
    label: 'Overview',
    links: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }]
  },
  {
    label: 'Pro portfolio',
    links: [
      { label: 'Hero', path: '/pro/hero' },
      { label: 'About', path: '/pro/about' },
      { label: 'Skills', path: '/pro/skills' },
      { label: 'Projects', path: '/pro/projects' },
      { label: 'Hobby', path: '/pro/hobby' },
      { label: 'Resume', path: '/pro/resume' },
      { label: 'SEO & sharing', path: '/pro/seo' }
    ]
  },
  {
    label: 'Photo portfolio',
    links: [
      { label: 'Hero', path: '/photo/hero' },
      { label: 'Gallery', path: '/photo/gallery' },
      { label: 'Stories', path: '/photo/stories' },
      { label: 'Reels', path: '/photo/reels' },
      { label: 'Videos', path: '/photo/videos' },
      { label: 'Categories', path: '/photo/categories', icon: Tags },
      { label: 'Clients', path: '/photo/clients' },
      { label: 'About', path: '/photo/about' },
      { label: 'SEO & sharing', path: '/photo/seo' }
    ]
  },
  {
    label: 'General',
    links: [
      { label: 'Contacts', path: '/general/contacts', icon: Mail },
      { label: 'Media library', path: '/general/media', icon: Images },
      { label: 'Settings', path: '/general/settings', icon: SettingsIcon }
    ]
  }
];

const contentTitles = {
  'pro/hero': 'Hero', 'pro/about': 'About', 'pro/skills': 'Skills', 'pro/projects': 'Projects', 'pro/hobby': 'Hobby', 'pro/resume': 'Resume', 'pro/seo': 'SEO & sharing',
  'photo/hero': 'Hero', 'photo/gallery': 'Gallery', 'photo/stories': 'Stories', 'photo/reels': 'Reels', 'photo/videos': 'Videos', 'photo/categories': 'Categories', 'photo/clients': 'Clients', 'photo/about': 'About', 'photo/seo': 'SEO & sharing'
};

function ProtectedRoute() {
  const auth = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/api/auth/me'),
    retry: false,
    staleTime: 30000
  });
  const location = useLocation();

  if (auth.isPending) return <div className="auth-loading">Checking admin session…</div>;
  if (auth.isError) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AdminLayout user={auth.data.data.user} />;
}

function AdminLayout({ user }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSettled: async () => {
      await queryClient.clear();
      navigate('/login', { replace: true });
    },
    onError: () => toast.error('The session could not be revoked; cookies will expire automatically.')
  });
  const title = navigation.flatMap((group) => group.links).find((link) => link.path === location.pathname)?.label || 'Dashboard';

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className={`admin-layout ${collapsed ? 'sidebar-collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
      {drawerOpen && <button className="drawer-scrim" onClick={closeDrawer} aria-label="Close navigation" />}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><Aperture size={19} /></div>
          {!collapsed && <div><strong>Portfolio CMS</strong><small>Content studio</small></div>}
          <button className="mobile-close" onClick={closeDrawer} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navigation.map((group) => (
            <section key={group.label} className="nav-group">
              {!collapsed && <h2>{group.label}</h2>}
              {group.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink key={link.path} to={link.path} end={link.path === '/'} onClick={closeDrawer} title={collapsed ? link.label : undefined} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
                    {Icon ? <Icon size={17} /> : <span className="nav-bullet" />}
                    {!collapsed && <span>{link.label}</span>}
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="collapse-button" type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Collapse sidebar</span></>}</button>
          <div className="admin-user">
            {user.avatar ? <img src={user.avatar} alt="" /> : <span className="user-initial">{user.name?.[0] || 'A'}</span>}
            {!collapsed && <div className="user-copy"><strong>{user.name}</strong><small>{user.email}</small></div>}
            <button type="button" className="logout-button" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div>
          <div className="topbar-actions"><a href={import.meta.env.VITE_PRO_URL || '#'} target="_blank" rel="noreferrer">Developer site <ArrowUpRightIcon /></a><a href={import.meta.env.VITE_PHOTO_URL || '#'} target="_blank" rel="noreferrer">Photo site <ArrowUpRightIcon /></a></div>
        </header>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}

function ArrowUpRightIcon() {
  return <span aria-hidden="true">↗</span>;
}

function ContentRoute({ route }) {
  const [site, section] = route.split('/');
  return <ContentEditor site={site} section={section} title={`${site === 'pro' ? 'Developer portfolio' : 'Photo portfolio'} · ${contentTitles[route]}`} />;
}

function AuthenticatedLogin() {
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: () => api.get('/api/auth/me'), retry: false });
  if (auth.isSuccess) return <Navigate to="/" replace />;
  return <Login />;
}

function RouteTable() {
  return (
    <Routes>
      <Route path="/login" element={<AuthenticatedLogin />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        {Object.keys(contentTitles).map((route) => <Route key={route} path={`/${route}`} element={<ContentRoute route={route} />} />)}
        <Route path="/general/contacts" element={<Contacts />} />
        <Route path="/general/media" element={<MediaLibrary />} />
        <Route path="/general/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><RouteTable /></BrowserRouter>;
}
