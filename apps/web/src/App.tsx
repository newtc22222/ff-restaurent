import { useEffect, useMemo, useState } from 'react';
import { LayoutDashboard, Store, BarChart2, Users, type LucideIcon } from 'lucide-react';
import { ApiClient, Bill, RestaurantEntry, Stats, User } from './api.js';
import { useI18n } from './i18n.js';
import { useTheme } from './theme.js';
import { uniqueUsers, canChef, isHead } from './utils/helpers.js';

// Layout components
import AppHeader from './components/layout/AppHeader.js';
import Sidebar from './components/layout/Sidebar.js';

// Screen views
import LoginScreen from './components/views/LoginScreen.js';
import ProfilePage from './components/views/ProfilePage.js';
import CreateBillPage from './components/views/CreateBillPage.js';
import BillDetailPage from './components/views/BillDetailPage.js';
import RestaurantDetailPage from './components/views/RestaurantDetailPage.js';
import BillsView from './components/views/BillsView.js';
import RestaurantsView from './components/views/RestaurantsView.js';
import StatsView from './components/views/StatsView.js';
import AdminView from './components/views/AdminView.js';

type Tab = 'bills' | 'restaurants' | 'stats' | 'admin';
type Screen =
  | 'dashboard'
  | 'create-bill'
  | 'edit-bill'
  | 'bill-detail'
  | 'profile'
  | 'restaurant-detail';

/**
 * App is the core container component of the application, managing authentication, global data state,
 * and page routing (tab & screen states).
 */
export function App() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [token, setToken] = useState(() => localStorage.getItem('ff-token'));
  const api = useMemo(() => new ApiClient(token), [token]);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('bills');
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Refreshes the global data of the application.
   */
  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [me, billData, restaurantData, statsData, memberData] =
        await Promise.all([
          api.request<User>('/me'),
          api.request<Bill[]>('/bills?includeArchived=true'),
          api.request<RestaurantEntry[]>('/restaurants?includeArchived=true'),
          api.request<Stats>('/stats/me?range=monthly'),
          api.request<User[]>('/members'),
        ]);
      setUser(me);
      setBills(billData);
      setRestaurants(restaurantData);
      setStats(statsData);
      setUsers(
        me.chefRole === 'HEAD_CHEF'
          ? await api.request<User[]>('/users')
          : memberData,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load app data');
      localStorage.removeItem('ff-token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [token]);

  /**
   * Handles user sign-in.
   */
  const login = async (identifier: string, password: string) => {
    const result = await api.login(identifier, password);
    localStorage.setItem('ff-token', result.token);
    setToken(result.token);
    api.setToken(result.token);
    setUser(result.user);
    setScreen('dashboard');
  };

  /**
   * Handles user registration.
   */
  const register = async (
    name: string,
    username: string,
    phone: string,
    password: string,
  ) => {
    const result = await api.register(name, username, phone, password);
    localStorage.setItem('ff-token', result.token);
    setToken(result.token);
    api.setToken(result.token);
    setUser(result.user);
    setScreen('dashboard');
  };

  /**
   * Clears session and logs user out.
   */
  const logout = () => {
    localStorage.removeItem('ff-token');
    setToken(null);
    setUser(null);
    setScreen('dashboard');
    setSelectedBillId(null);
  };

  // 1. Non-authenticated guard
  if (!token || !user) {
    return (
      <LoginScreen
        onLogin={login}
        onRegister={register}
        error={error}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  const selectedBill = bills.find((b) => b.id === selectedBillId);
  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const teamMembers = uniqueUsers(users, user);

  // 2. Full-page views (profile, create/edit bill, details pages)
  if (screen === 'profile') {
    return (
      <ProfilePage
        api={api}
        user={user}
        onBack={() => setScreen('dashboard')}
        onSignOut={logout}
        refresh={refresh}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  if ((screen === 'create-bill' || screen === 'edit-bill') && canChef(user)) {
    return (
      <CreateBillPage
        api={api}
        user={user}
        members={teamMembers}
        restaurants={restaurants}
        refresh={refresh}
        onBack={() => setScreen('dashboard')}
        onSignOut={logout}
        setError={setError}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        editBill={screen === 'edit-bill' ? selectedBill : undefined}
      />
    );
  }

  if (screen === 'bill-detail' && selectedBill) {
    return (
      <BillDetailPage
        api={api}
        user={user}
        bill={selectedBill}
        refresh={refresh}
        onBack={() => setScreen('dashboard')}
        onSignOut={logout}
        setError={setError}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        onEditBill={() => setScreen('edit-bill')}
      />
    );
  }

  if (screen === 'restaurant-detail' && selectedRestaurant) {
    return (
      <RestaurantDetailPage
        api={api}
        user={user}
        restaurant={selectedRestaurant}
        refresh={refresh}
        onBack={() => setScreen('dashboard')}
        onSignOut={logout}
        setError={setError}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
    );
  }

  // 3. Tab navigation layout
  const nav: readonly (readonly [Tab, LucideIcon, string])[] = [
    ['bills', LayoutDashboard, t('nav.bills')],
    ['restaurants', Store, t('nav.restaurants')],
    ['stats', BarChart2, t('nav.stats')],
    ...(isHead(user)
      ? ([['admin', Users, t('nav.members')]] as [Tab, LucideIcon, string][])
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={logout}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
        onProfile={() => setScreen('profile')}
      />
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <Sidebar nav={nav} active={tab} onSelect={setTab} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div
            className={
              tab === 'bills' ? 'mx-auto max-w-2xl' : 'mx-auto max-w-5xl'
            }
          >
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}
            {loading && (
              <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-slate-500">
                {t('common.loading')}
              </div>
            )}
            {tab === 'bills' && (
              <BillsView
                api={api}
                user={user}
                bills={bills}
                refresh={refresh}
                setError={setError}
                onCreateBill={() => setScreen('create-bill')}
                onViewBill={(bill) => {
                  setSelectedBillId(bill.id);
                  setScreen('bill-detail');
                }}
                t={t}
              />
            )}
            {tab === 'restaurants' && (
              <RestaurantsView
                api={api}
                user={user}
                restaurants={restaurants}
                refresh={refresh}
                setError={setError}
                t={t}
                locale={locale}
                onViewDetail={(r) => {
                  setSelectedRestaurantId(r.id);
                  setScreen('restaurant-detail');
                }}
              />
            )}
            {tab === 'stats' && <StatsView stats={stats} t={t} />}
            {tab === 'admin' && isHead(user) && (
              <AdminView
                api={api}
                users={users}
                refresh={refresh}
                setError={setError}
                t={t}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
