import { useRef, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Aperture, BookOpen, Camera, ChevronLeft, ChevronRight, Clapperboard, Code2,
  FileText, FolderKanban, Heart, Images, LayoutDashboard, LogOut, Mail, Menu,
  Search, Settings as SettingsIcon, Tags, UserRound, UsersRound, Video, WandSparkles, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from './api';
import CustomCursor from '../../shared/CustomCursor.jsx';
import { ProfilePhotoCrop } from './components/DropUpload';
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
      { label: 'Hero', path: '/pro/hero', icon: WandSparkles },
      { label: 'About', path: '/pro/about', icon: UserRound },
      { label: 'Skills', path: '/pro/skills', icon: Code2 },
      { label: 'Projects', path: '/pro/projects', icon: FolderKanban },
      { label: 'Hobby', path: '/pro/hobby', icon: Heart },
      { label: 'Resume', path: '/pro/resume', icon: FileText },
      { label: 'SEO & sharing', path: '/pro/seo', icon: Search }
    ]
  },
  {
    label: 'Photo portfolio',
    links: [
      { label: 'Hero', path: '/photo/hero', icon: Aperture },
      { label: 'Gallery', path: '/photo/gallery', icon: Images },
      { label: 'Stories', path: '/photo/stories', icon: BookOpen },
      { label: 'Reels', path: '/photo/reels', icon: Clapperboard },
      { label: 'Videos', path: '/photo/videos', icon: Video },
      { label: 'Categories', path: '/photo/categories', icon: Tags },
      { label: 'Clients', path: '/photo/clients', icon: UsersRound },
      { label: 'About', path: '/photo/about', icon: Camera },
      { label: 'SEO & sharing', path: '/photo/seo', icon: Search }
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
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef(null);
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

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      toast.error('Choose a JPG, PNG, WebP or AVIF image.');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('The photo exceeds the 200 MB upload limit.');
      return;
    }
    setAvatarFile(file);
  }

  async function saveAvatar(file) {
    setAvatarFile(null);
    setAvatarBusy(true);
    const formData = new FormData();
    formData.append('folder', 'admin-profile');
    formData.append('file', file);
    try {
      const { data: uploaded } = await api.post('/api/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      const { data: updated } = await api.patch('/api/auth/me/avatar', { mediaId: uploaded.media._id });
      queryClient.setQueryData(['auth-me'], (current) => current
        ? { ...current, data: { ...current.data, user: updated.user } }
        : current);
      toast.success('Account photo updated.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Account photo could not be updated.');
    } finally {
      setAvatarBusy(false);
    }
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
                  <NavLink key={link.path} to={link.path} end={link.path === '/'} onClick={closeDrawer} title={collapsed ? link.label : undefined} aria-label={link.label} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
                    {Icon ? <Icon size={17} /> : <span className="nav-bullet" />}
                    {!collapsed && <span>{link.label}</span>}
                  </NavLink>
                );
              })}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="collapse-button" type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : undefined}>{collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Collapse sidebar</span></>}</button>
          <div className="admin-user">
            <button type="button" className="admin-avatar-button" onClick={() => avatarInputRef.current?.click()} disabled={avatarBusy} aria-label="Change account photo" title={avatarBusy ? 'Uploading account photo' : 'Change account photo'}>
              <AccountAvatar key={user.avatar} avatar={user.avatar} name={user.name} />
              <span className="admin-avatar-edit" aria-hidden="true"><Camera size={11} /></span>
            </button>
            <input ref={avatarInputRef} className="admin-avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectAvatar} aria-label="Choose account photo" />
            {!collapsed && <div className="user-copy"><strong>{user.name}</strong><small>{user.email}</small></div>}
            <button type="button" className="logout-button" onClick={() => logout.mutate()} disabled={logout.isPending} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
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
      {avatarFile && <ProfilePhotoCrop file={avatarFile} onCancel={() => setAvatarFile(null)} onCrop={saveAvatar} />}
    </div>
  );
}

function AccountAvatar({ avatar, name }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="admin-avatar">
      {avatar && !failed
        ? <img src={avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : <span className="user-initial">{name?.[0] || 'A'}</span>}
    </span>
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
  return <BrowserRouter><CustomCursor theme="cms" /><RouteTable /></BrowserRouter>;
}
