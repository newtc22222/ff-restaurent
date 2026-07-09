import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Edit3,
  ExternalLink,
  Globe,
  Heart,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plus,
  PlusCircle,
  Store,
  Sun,
  ThumbsUp,
  UserCircle,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AdjustmentType } from '@ff-restaurent/shared';
import {
  ApiClient,
  Bill,
  BillParticipant,
  ChefRole,
  money,
  RestaurantEntry,
  Stats,
  User,
} from './api.js';
import { useI18n, type Locale } from './i18n.js';
import { useTheme, type Theme } from './theme.js';
import CurrencyInput from 'react-currency-input-field';


type Tab = 'bills' | 'restaurants' | 'stats' | 'admin';
type Screen =
  | 'dashboard'
  | 'create-bill'
  | 'edit-bill'
  | 'bill-detail'
  | 'profile'
  | 'restaurant-detail';

const CUISINE_OPTIONS = [
  'Phở',
  'Bún bò Huế',
  'Bánh mì',
  'Cơm tấm',
  'Bún chả',
  'Gỏi cuốn',
  'Chả giò',
  'Hủ tiếu',
  'Mì Quảng',
  'Bánh xèo',
  'Lẩu',
  'Trà sữa',
  'Cà phê',
  'Ăn vặt',
  'Đồ nướng',
  'Hải sản',
  'Chay',
  'Nhật Bản',
  'Hàn Quốc',
  'Thái',
  'Ý',
  'Trung Hoa',
  'Ấn Độ',
  'Pháp',
  'Mỹ',
];

const TYPE_OPTIONS_VI = [
  'Nhà hàng',
  'Quán ăn',
  'Quán cà phê',
  'Quán nước',
  'Tiệm bánh',
];
const TYPE_OPTIONS_EN = [
  'Restaurant',
  'Eatery',
  'Café',
  'Drink shop',
  'Bakery',
];

const PIE_COLORS = [
  '#10b981',
  '#f59e0b',
  '#6366f1',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#8b5cf6',
];

type Option = {
  value: string;
  label: string;
};

const seededUsers = [
  ['customer', 'role.customer'],
  ['sous', 'role.souschef'],
  ['head', 'role.headchef'],
] as const;

const roleLabel = (user?: User | null, t?: (key: string) => string) => {
  if (!user) return t?.('role.customer') ?? 'Customer';
  if (user.chefRole === 'HEAD_CHEF')
    return t?.('role.headchef') ?? 'Executive chef';
  if (user.chefRole === 'SOUS_CHEF') return t?.('role.souschef') ?? 'Sous chef';
  return t?.('role.customer') ?? 'Customer';
};

const canChef = (user: User | null) =>
  user?.chefRole === 'SOUS_CHEF' || user?.chefRole === 'HEAD_CHEF';
const isHead = (user: User | null) => user?.chefRole === 'HEAD_CHEF';
const canManageBill = (bill: Bill, user: User) =>
  isHead(user) || bill.createdById === user.id;

const uniqueUsers = (users: User[], fallback: User) => {
  const byId = new Map<string, User>();
  [...users, fallback].forEach((member) => byId.set(member.id, member));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function App() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const [token, setToken] = useState(() => localStorage.getItem('ff-token'));
  const api = useMemo(() => new ApiClient(token), [token]);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('bills');
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    string | null
  >(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const login = async (identifier: string, password: string) => {
    const result = await api.login(identifier, password);
    localStorage.setItem('ff-token', result.token);
    setToken(result.token);
    api.setToken(result.token);
    setUser(result.user);
    setScreen('dashboard');
  };

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

  const logout = () => {
    localStorage.removeItem('ff-token');
    setToken(null);
    setUser(null);
    setScreen('dashboard');
    setSelectedBillId(null);
  };

  if (!token || !user)
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

  const selectedBill = bills.find((bill) => bill.id === selectedBillId);
  const selectedRestaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId,
  );
  const teamMembers = uniqueUsers(users, user);

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

function BrandIcon({ size = 48 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg bg-[#e9900c] text-white"
      style={{ width: size, height: size }}
    >
      <UtensilsCrossed size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </div>
  );
}

function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const icons: Record<Theme, LucideIcon> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  const next: Record<Theme, Theme> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };
  const Icon = icons[theme];
  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink"
      onClick={() => setTheme(next[theme])}
      title={theme}
    >
      <Icon size={16} />
    </button>
  );
}

function LocaleToggle({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
}) {
  return (
    <button
      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-muted hover:text-ink"
      onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
      title={locale === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
    >
      <Globe size={14} />
      {locale === 'vi' ? '🇻🇳' : '🇬🇧'}
    </button>
  );
}

type HeaderProps = {
  user: User;
  onSignOut: () => void;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onProfile?: () => void;
};

function AppHeader({
  user,
  onSignOut,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  onProfile,
}: HeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-5">
        <BrandIcon size={32} />
        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-bold text-ink">
            {t('app.name')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle locale={locale} setLocale={setLocale} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button
            className="hidden items-center gap-2 rounded-md px-2 py-1 text-[13px] text-slate-500 transition-colors hover:bg-muted hover:text-ink sm:flex"
            onClick={onProfile}
          >
            <UserCircle size={16} />
            <span className="font-semibold">{user.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
              {roleLabel(user, t)}
            </span>
          </button>
          <button
            className="btn btn-soft h-8 px-3 text-[13px]"
            onClick={() => setShowConfirm(true)}
          >
            <LogOut size={13} /> {t('auth.signOut')}
          </button>
        </div>
      </header>
      {showConfirm && (
        <ConfirmDialog
          title={t('auth.confirmSignOutTitle')}
          message={t('auth.confirmSignOut')}
          onConfirm={() => {
            setShowConfirm(false);
            onSignOut();
          }}
          onCancel={() => setShowConfirm(false)}
          t={t}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  t,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-[16px] font-bold text-ink">{title}</h3>
        <p className="mb-5 text-[14px] text-slate-500">{message}</p>
        <div className="flex gap-3">
          <button className="btn btn-soft flex-1" onClick={onCancel}>
            {t('auth.cancel')}
          </button>
          <button className="btn btn-primary flex-1" onClick={onConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  nav,
  active,
  onSelect,
}: {
  nav: readonly (readonly [Tab, LucideIcon, string])[];
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface p-2 md:w-56 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-4">
      {nav.map(([id, Icon, label]) => (
        <button
          key={id}
          className={`flex h-10 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-[14px] font-semibold transition-all md:mx-2 ${
            active === id
              ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
              : 'text-slate-500 hover:bg-muted hover:text-ink'
          }`}
          onClick={() => onSelect(id)}
        >
          <Icon size={16} /> {label}
        </button>
      ))}
    </aside>
  );
}

function LoginScreen({
  onLogin,
  onRegister,
  error,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
}: {
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRegister: (
    name: string,
    username: string,
    phone: string,
    password: string,
  ) => Promise<void>;
  error: string | null;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('head');
  const [password, setPassword] = useState('password123');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await onLogin(identifier, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await onRegister(regName, regUsername, regPhone, regPassword);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const activeSeed =
    seededUsers.find(([seedId]) => seedId === identifier)?.[0] ?? 'head';

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="mb-4 flex items-center justify-end gap-2">
          <LocaleToggle locale={locale} setLocale={setLocale} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {mode === 'login' ? (
          <form
            className="rounded-xl border border-border bg-surface p-8 shadow-panel"
            onSubmit={submitLogin}
          >
            <div className="mb-7">
              <BrandIcon size={48} />
              <h1 className="mt-3 text-[24px] font-bold leading-tight text-ink">
                {t('app.name')}
              </h1>
              <p className="mt-1 text-[14px] text-slate-500">
                {t('app.tagline')}
              </p>
            </div>
            {(localError || error) && (
              <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {localError || error}
              </div>
            )}
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.identifier')}</span>
              <input
                className="field w-full"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="btn btn-primary mb-5 w-full" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
            <div className="mb-4">
              <div className="label mb-2">{t('auth.role')}</div>
              <div className="grid grid-cols-3 gap-2">
                {seededUsers.map(([seedId, labelKey]) => {
                  const isActive = activeSeed === seedId;
                  return (
                    <button
                      key={seedId}
                      type="button"
                      className={`btn px-2 ${isActive ? 'border border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]' : 'btn-soft'}`}
                      onClick={() => setIdentifier(seedId)}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-[13px] text-slate-500">
              {t('auth.noAccount')}{' '}
              <button
                type="button"
                className="font-semibold text-ink underline"
                onClick={() => setMode('register')}
              >
                {t('auth.register')}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="rounded-xl border border-border bg-surface p-8 shadow-panel"
            onSubmit={submitRegister}
          >
            <div className="mb-7">
              <BrandIcon size={48} />
              <h1 className="mt-3 text-[24px] font-bold leading-tight text-ink">
                {t('auth.register')}
              </h1>
            </div>
            {localError && (
              <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {localError}
              </div>
            )}
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.name')}</span>
              <input
                className="field w-full"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.username')}</span>
              <input
                className="field w-full"
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.phone')}</span>
              <input
                className="field w-full"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <button className="btn btn-primary mb-5 w-full" disabled={busy}>
              {busy ? t('auth.registering') : t('auth.register')}
            </button>
            <div className="text-center text-[13px] text-slate-500">
              {t('auth.haveAccount')}{' '}
              <button
                type="button"
                className="font-semibold text-ink underline"
                onClick={() => setMode('login')}
              >
                {t('auth.signIn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

function BillsView({
  api,
  user,
  bills,
  refresh,
  setError,
  onCreateBill,
  onViewBill,
  t,
}: {
  api: ApiClient;
  user: User;
  bills: Bill[];
  refresh: () => Promise<void>;
  setError: (error: string | null) => void;
  onCreateBill: () => void;
  onViewBill: (bill: Bill) => void;
  t: (key: string) => string;
}) {
  const [filterRestaurant, setFilterRestaurant] = useState('');
  const [filterMembers, setFilterMembers] = useState<string[]>([]);
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>(
    'all',
  );

  const restaurantOptions = Array.from(
    new Map(
      bills.map((bill) => [
        bill.restaurant.id,
        { value: bill.restaurant.id, label: bill.restaurant.name },
      ]),
    ).values(),
  );
  const memberOptions = Array.from(
    new Map(
      bills.flatMap((bill) =>
        bill.participants.map((participant) => [
          participant.memberId,
          { value: participant.memberId, label: participant.member.name },
        ]),
      ),
    ).values(),
  );

  const filtered = bills.filter((bill) => {
    if (filterRestaurant && bill.restaurant.id !== filterRestaurant)
      return false;
    if (
      filterMembers.length > 0 &&
      !filterMembers.every((memberId) =>
        bill.participants.some(
          (participant) => participant.memberId === memberId,
        ),
      )
    ) {
      return false;
    }
    if (filterPayment !== 'all') {
      const myPart = bill.participants.find((p) => p.memberId === user.id);
      if (filterPayment === 'paid' && myPart?.paymentStatus !== 'PAID')
        return false;
      if (filterPayment === 'unpaid' && myPart?.paymentStatus !== 'WAITING')
        return false;
    }
    return true;
  });
  const activeFilterCount =
    (filterRestaurant ? 1 : 0) +
    (filterMembers.length > 0 ? 1 : 0) +
    (filterPayment !== 'all' ? 1 : 0);

  const runAction = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-bold text-ink">{t('bills.title')}</h2>
        {canChef(user) && (
          <button
            className="btn btn-primary h-9 px-4 text-[13px]"
            onClick={onCreateBill}
          >
            <Plus size={14} /> {t('bills.createBill')}
          </button>
        )}
      </div>
      <p className="mb-4 text-[13px] text-slate-500">{t('bills.scopeNote')}</p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SelectDropdown
          label={t('bills.filterRestaurant')}
          value={filterRestaurant}
          options={restaurantOptions}
          onChange={setFilterRestaurant}
        />
        {canChef(user) && (
          <MultiSelectDropdown
            label={t('bills.filterMember')}
            values={filterMembers}
            options={memberOptions}
            onChange={setFilterMembers}
          />
        )}
        {!canChef(user) && (
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(['all', 'paid', 'unpaid'] as const).map((val) => (
              <button
                key={val}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${filterPayment === val ? 'bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]' : 'text-slate-500 hover:text-ink'}`}
                onClick={() => setFilterPayment(val)}
              >
                {val === 'all'
                  ? t('bills.title')
                  : val === 'paid'
                    ? t('bills.filterPaid')
                    : t('bills.filterUnpaid')}
              </button>
            ))}
          </div>
        )}
        {activeFilterCount > 0 && (
          <button
            className="ml-1 text-[12px] text-slate-400 transition-colors hover:text-red-400"
            onClick={() => {
              setFilterRestaurant('');
              setFilterMembers([]);
              setFilterPayment('all');
            }}
          >
            {t('bills.clearAll')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {bills.length === 0 && (
          <EmptyState
            icon={LayoutDashboard}
            title={t('bills.noBills')}
            description={t('bills.noBillsDesc')}
            steps={[
              t('createBill.restaurant'),
              t('createBill.participants'),
              t('bills.remind'),
            ]}
          />
        )}
        {bills.length > 0 && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-surface py-12 text-center text-[14px] text-slate-400">
            {t('bills.noMatch')}
          </div>
        )}
        {filtered.map((bill) => (
          <BillCard
            key={bill.id}
            bill={bill}
            user={user}
            onView={() => onViewBill(bill)}
            onRemind={() =>
              runAction(
                () =>
                  api.request(`/bills/${bill.id}/reminders`, {
                    method: 'POST',
                  }),
                'Could not send reminders',
              )
            }
            onArchive={() =>
              runAction(
                () =>
                  api.request(`/bills/${bill.id}/archive`, { method: 'PATCH' }),
                'Could not archive bill',
              )
            }
            onRestore={() =>
              runAction(
                () =>
                  api.request(`/bills/${bill.id}/restore`, { method: 'PATCH' }),
                'Could not restore bill',
              )
            }
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function BillCard({
  bill,
  user,
  onView,
  onRemind,
  onArchive,
  onRestore,
  t,
}: {
  bill: Bill;
  user: User;
  onView: () => void;
  onRemind: () => void;
  onArchive: () => void;
  onRestore: () => void;
  t: (key: string) => string;
}) {
  const [confirmAction, setConfirmAction] = useState<
    'archive' | 'restore' | null
  >(null);
  const paid = bill.participants.filter(
    (participant) => participant.paymentStatus === 'PAID',
  ).length;
  const total = bill.participants.length;
  const percentage = total ? Math.round((paid / total) * 100) : 0;
  const allPaid = total > 0 && paid === total;
  const canManage = canManageBill(bill, user);

  return (
    <>
      <article className="rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[16px] font-bold text-ink">
              {bill.restaurant.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {bill.restaurant.type} / {bill.restaurant.cuisineType} / by{' '}
              {bill.createdBy.name}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[20px] font-bold text-ink">
              {money(bill.totalCost)}
            </p>
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide ${allPaid ? 'text-emerald-500' : 'text-[#e9900c]'}`}
            >
              {allPaid ? t('bills.settled') : bill.status}
            </span>
          </div>
        </div>

        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[12px] text-slate-500">
            <span>
              {paid} {t('bills.of')} {total} {t('bills.paidCount')}
            </span>
            <span>{percentage}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {bill.participants.map((participant) => (
            <PaymentChip key={participant.memberId} participant={participant} />
          ))}
        </div>

        <div className="flex gap-2 border-t border-muted pt-3">
          <button
            className="btn btn-primary h-8 flex-1 px-3 text-[13px]"
            onClick={onView}
          >
            {t('bills.viewDetail')} <ChevronRight size={13} />
          </button>
          {canManage && canChef(user) && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={onRemind}
            >
              {t('bills.remind')}
            </button>
          )}
          {isHead(user) && bill.status === 'ACTIVE' && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={() => setConfirmAction('archive')}
            >
              {t('bills.archive')}
            </button>
          )}
          {isHead(user) && bill.status === 'ARCHIVED' && (
            <button
              className="btn btn-soft h-8 px-3 text-[13px]"
              onClick={() => setConfirmAction('restore')}
            >
              {t('bills.restore')}
            </button>
          )}
        </div>
      </article>
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction === 'archive'
              ? t('bills.archiveBill')
              : t('bills.restoreBill')
          }
          message={
            confirmAction === 'archive'
              ? t('bills.confirmArchive')
              : t('bills.confirmRestore')
          }
          onConfirm={() => {
            setConfirmAction(null);
            confirmAction === 'archive' ? onArchive() : onRestore();
          }}
          onCancel={() => setConfirmAction(null)}
          t={t}
        />
      )}
    </>
  );
}

function PaymentChip({ participant }: { participant: BillParticipant }) {
  const paid = participant.paymentStatus === 'PAID';
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${
        paid
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      }`}
    >
      {paid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
      {participant.member.name.split(' ')[0]} / {money(participant.finalPrice)}
    </div>
  );
}

function BillDetailPage({
  api,
  user,
  bill,
  refresh,
  onBack,
  onSignOut,
  setError,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  onEditBill,
}: {
  api: ApiClient;
  user: User;
  bill: Bill;
  refresh: () => Promise<void>;
  onBack: () => void;
  onSignOut: () => void;
  setError: (error: string | null) => void;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onEditBill: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<
    'archive' | 'restore' | null
  >(null);
  const paid = bill.participants.filter(
    (participant) => participant.paymentStatus === 'PAID',
  ).length;
  const percentage = bill.participants.length
    ? Math.round((paid / bill.participants.length) * 100)
    : 0;
  const allPaid =
    bill.participants.length > 0 && paid === bill.participants.length;
  const canManage = canManageBill(bill, user);
  const isCustomer = !canChef(user);
  const pieData = bill.participants.map((p) => ({
    name: p.member.name.split(' ')[0],
    value: p.finalPrice,
  }));

  const runAction = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('bills.backToBills')}
        </button>

        <section className="mb-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-bold text-ink">
                {bill.restaurant.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {bill.restaurant.type} / {bill.restaurant.cuisineType} / created
                by {bill.createdBy.name}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[28px] font-bold leading-none text-ink">
                {money(bill.totalCost)}
              </p>
              <span
                className={`mt-1 inline-block text-[11px] font-semibold uppercase tracking-wide ${allPaid ? 'text-emerald-500' : 'text-[#e9900c]'}`}
              >
                {allPaid ? t('bills.settled') : bill.status}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-[12px] text-slate-500">
              <span>
                {paid} {t('bills.of')} {bill.participants.length}{' '}
                {t('bills.paidCount')}
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </section>

        {pieData.length > 1 && (
          <section className="mb-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="label mb-3">Bill share breakdown</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={index}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {pieData.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center gap-1.5 text-[12px]"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500">{money(d.value)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {canManage && canChef(user) && (
          <div className="mb-4 flex gap-3">
            <button className="btn btn-soft flex-1" onClick={onEditBill}>
              <Edit3 size={14} /> {t('bills.editBill')}
            </button>
          </div>
        )}

        <section className="mb-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-muted px-5 py-3">
            <span className="label">{t('bills.memberBreakdown')}</span>
            <span className="label">{t('bills.amountStatus')}</span>
          </div>
          {bill.participants.map((participant, index) => (
            <div
              key={participant.memberId}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                index < bill.participants.length - 1
                  ? 'border-b border-[#f8fafc] dark:border-[hsl(220,15%,18%)]'
                  : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-ink">
                  {initials(participant.member.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">
                    {participant.member.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Base {money(participant.originCost)} / VAT{' '}
                    {money(participant.allocatedVat)} / Ship{' '}
                    {money(participant.allocatedShipping)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="text-right">
                  <p className="text-[14px] font-bold">
                    {money(participant.finalPrice)}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      participant.paymentStatus === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {participant.paymentStatus === 'PAID' ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <Clock size={11} />
                    )}
                    {participant.paymentStatus === 'PAID'
                      ? t('bills.paid')
                      : t('bills.waiting')}
                  </span>
                </div>
                {participant.paymentStatus === 'WAITING' &&
                  (!isCustomer || participant.memberId === user.id) && (
                    <button
                      className="btn btn-primary h-8 px-3 text-[12px]"
                      onClick={() =>
                        runAction(
                          () =>
                            api.request(
                              `/bills/${bill.id}/participants/${participant.memberId}/pay`,
                              { method: 'PATCH' },
                            ),
                          'Could not mark payment as paid',
                        )
                      }
                    >
                      {t('bills.markPaid')}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </section>

        {canManage && canChef(user) && (
          <div className="flex gap-3">
            <button
              className="btn btn-soft flex-1"
              onClick={() =>
                runAction(
                  () =>
                    api.request(`/bills/${bill.id}/reminders`, {
                      method: 'POST',
                    }),
                  'Could not send reminders',
                )
              }
            >
              {t('bills.sendReminders')}
            </button>
            {isHead(user) && bill.status === 'ACTIVE' && (
              <button
                className="btn btn-soft flex-1 hover:border-red-300 hover:text-red-500"
                onClick={() => setConfirmAction('archive')}
              >
                {t('bills.archiveBill')}
              </button>
            )}
            {isHead(user) && bill.status === 'ARCHIVED' && (
              <button
                className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                onClick={() => setConfirmAction('restore')}
              >
                {t('bills.restoreBill')}
              </button>
            )}
          </div>
        )}
      </main>
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction === 'archive'
              ? t('bills.archiveBill')
              : t('bills.restoreBill')
          }
          message={
            confirmAction === 'archive'
              ? t('bills.confirmArchive')
              : t('bills.confirmRestore')
          }
          onConfirm={() => {
            setConfirmAction(null);
            runAction(
              () =>
                api.request(`/bills/${bill.id}/${confirmAction}`, {
                  method: 'PATCH',
                }),
              `Could not ${confirmAction} bill`,
            );
          }}
          onCancel={() => setConfirmAction(null)}
          t={t}
        />
      )}
    </div>
  );
}

type ParticipantDraft = {
  memberId: string;
  originCost: number;
};

function CreateBillPage({
  api,
  user,
  members,
  restaurants,
  refresh,
  onBack,
  onSignOut,
  setError,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  editBill,
}: {
  api: ApiClient;
  user: User;
  members: User[];
  restaurants: RestaurantEntry[];
  refresh: () => Promise<void>;
  onBack: () => void;
  onSignOut: () => void;
  setError: (error: string | null) => void;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  editBill?: Bill;
}) {
  const isEditing = !!editBill;
  const [restaurantId, setRestaurantId] = useState(
    editBill?.restaurant?.id ?? '',
  );
  const [vat, setVat] = useState(editBill?.vat ?? 30000);
  const [shippingFee, setShippingFee] = useState(
    editBill?.shippingFee ?? 20000,
  );
  const [discount, setDiscount] = useState(0);
  const [participants, setParticipants] = useState<ParticipantDraft[]>(
    editBill?.participants?.map((p) => ({
      memberId: p.memberId,
      originCost: p.originCost,
    })) ?? [],
  );
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeRestaurants = restaurants.filter(
    (entry) => entry.status === 'ACTIVE',
  );
  const participantIds = new Set(
    participants.map((participant) => participant.memberId),
  );
  const availableMembers = members.filter(
    (member) => !participantIds.has(member.id),
  );
  const totalBase = participants.reduce(
    (sum, participant) => sum + participant.originCost,
    0,
  );
  const grandTotal = totalBase + vat + shippingFee - discount;
  const shippingEach =
    participants.length > 0 ? Math.round(shippingFee / participants.length) : 0;

  const updateParticipant = (memberId: string, originCost: number) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.memberId === memberId
          ? { ...participant, originCost: Math.max(0, originCost) }
          : participant,
      ),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setError(null);
    if (participants.length < 2) {
      setLocalError('A bill requires at least two participants.');
      return;
    }
    if (totalBase <= 0) {
      setLocalError('Participant base amounts must be greater than zero.');
      return;
    }

    const payload = {
      restaurantId,
      baseCost: totalBase,
      vat,
      shippingFee,
      discounts: discount
        ? [
            {
              type: AdjustmentType.FIXED,
              value: discount,
              label: 'Manual discount',
            },
          ]
        : [],
      participants: participants.map((participant) => ({
        memberId: participant.memberId,
        originCost: participant.originCost,
      })),
    };

    try {
      if (isEditing) {
        await api.request(`/bills/${editBill.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api.request('/bills', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setSubmitted(true);
      await refresh();
      window.setTimeout(onBack, 600);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Could not update bill'
            : 'Could not create bill',
      );
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
      <main className="mx-auto max-w-xl px-4 py-8">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('bills.backToBills')}
        </button>

        <form
          className="rounded-xl border border-border bg-surface p-6 shadow-sm"
          onSubmit={submit}
        >
          <h2 className="mb-1 text-[20px] font-bold text-ink">
            {isEditing ? t('bills.editBill') : t('createBill.title')}
          </h2>
          <p className="mb-6 text-[13px] text-slate-500">
            {t('createBill.subtitle')}
          </p>

          {localError && (
            <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {localError}
            </div>
          )}

          <label className="mb-5 block space-y-1.5">
            <span className="label">{t('createBill.restaurant')}</span>
            <select
              className="field w-full"
              value={restaurantId}
              onChange={(event) => setRestaurantId(event.target.value)}
              required
            >
              <option value="">{t('createBill.choose')}</option>
              {activeRestaurants.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <AmountInput
              label={t('createBill.vat')}
              value={vat}
              onChange={setVat}
            />
            <AmountInput
              label={t('createBill.shipping')}
              value={shippingFee}
              onChange={setShippingFee}
            />
            <AmountInput
              label={t('createBill.discount')}
              value={discount}
              onChange={setDiscount}
            />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">{t('createBill.participants')}</span>
              <span className="text-[12px] text-slate-500">
                {t('createBill.baseTotal')}:{' '}
                <span className="font-semibold text-ink">
                  {totalBase > 0 ? money(totalBase) : '-'}
                </span>
              </span>
            </div>

            <div className="mb-3 flex flex-col gap-2">
              {participants.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-3 text-center text-[13px] text-slate-400">
                  {t('createBill.addMembers')}
                </p>
              )}
              {participants.map((participant) => {
                const member = members.find(
                  (candidate) => candidate.id === participant.memberId,
                );
                if (!member) return null;
                const estimatedFinal = participant.originCost + shippingEach;
                return (
                  <div
                    key={participant.memberId}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {member.name}
                      </p>
                      {estimatedFinal > 0 && (
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          ≈ {money(estimatedFinal)}
                          {shippingEach > 0 && (
                            <span className="text-slate-400">
                              {' '}
                              (base {money(participant.originCost)} + ship{' '}
                              {money(shippingEach)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="relative">
                      <CurrencyInput
                        className="h-9 w-32 rounded-md border border-border bg-surface px-3 text-right text-[14px] text-ink outline-none transition-colors focus:border-ink"
                        value={participant.originCost === 0 ? '' : participant.originCost}
                        onValueChange={(val, name, values) =>
                          updateParticipant(
                            participant.memberId,
                            values?.float ?? 0,
                          )
                        }
                        allowDecimals={false}
                        allowNegativeValue={false}
                        intlConfig={{ locale: 'vi-VN', currency: 'VND' }}
                      />
                    </div>
                    <button
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-all hover:bg-red-50 hover:text-red-500"
                      type="button"
                      onClick={() =>
                        setParticipants((current) =>
                          current.filter(
                            (row) => row.memberId !== participant.memberId,
                          ),
                        )
                      }
                      title={t('common.remove')}
                    >
                      x
                    </button>
                  </div>
                );
              })}
            </div>

            {availableMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableMembers.map((member) => (
                  <button
                    key={member.id}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 text-[12px] font-semibold text-slate-500 transition-all hover:border-ink hover:text-ink dark:border-slate-600"
                    type="button"
                    onClick={() =>
                      setParticipants((current) => [
                        ...current,
                        { memberId: member.id, originCost: 0 },
                      ])
                    }
                  >
                    <Plus size={11} /> {member.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {(grandTotal > 0 || participants.length > 0) && (
            <div className="mb-5 rounded-lg bg-muted/50 p-4">
              <SummaryLine
                label={t('createBill.base')}
                value={money(totalBase)}
              />
              {vat > 0 && (
                <SummaryLine label={t('createBill.vat')} value={money(vat)} />
              )}
              {shippingFee > 0 && (
                <SummaryLine
                  label={`${t('createBill.shipping')}${participants.length > 0 ? ` / ${participants.length}` : ''}`}
                  value={money(shippingFee)}
                />
              )}
              {discount > 0 && (
                <SummaryLine
                  label={t('createBill.discount')}
                  value={`-${money(discount)}`}
                  tone="success"
                />
              )}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[13px] font-bold text-ink">
                  {t('createBill.grandTotal')}
                </span>
                <span className="text-[18px] font-bold text-ink">
                  {money(grandTotal)}
                </span>
              </div>
            </div>
          )}

          <button
            className={`btn h-11 w-full ${submitted ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
            disabled={submitted}
          >
            {submitted ? (
              <>
                <CheckCircle2 size={16} /> {t('createBill.created')}
              </>
            ) : (
              <>
                {t('createBill.submit')} <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function SelectDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-all ${
          selected
            ? 'border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
            : 'border-border bg-surface text-slate-500 hover:border-ink/40 hover:text-ink'
        }`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? label}</span>
        <ChevronRight
          size={12}
          className={`rotate-90 transition-transform ${open ? '-rotate-90' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            {value && (
              <button
                className="w-full px-3 py-2 text-left text-[13px] text-slate-400 hover:bg-muted"
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                className={`w-full px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                  value === option.value
                    ? 'bg-muted text-ink'
                    : 'text-ink hover:bg-muted'
                }`}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: Option[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOptions = options.filter((option) =>
    values.includes(option.value),
  );
  const displayLabel =
    selectedOptions.length === 0
      ? label
      : selectedOptions.length === 1
        ? selectedOptions[0]?.label.split(' ')[0]
        : `${selectedOptions.length} members`;

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    );
  };

  return (
    <div className="relative">
      <button
        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition-all ${
          values.length > 0
            ? 'border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
            : 'border-border bg-surface text-slate-500 hover:border-ink/40 hover:text-ink'
        }`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{displayLabel}</span>
        <ChevronRight
          size={12}
          className={`rotate-90 transition-transform ${open ? '-rotate-90' : ''}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-20 min-w-[190px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            {values.length > 0 && (
              <button
                className="w-full border-b border-muted px-3 py-2 text-left text-[13px] text-slate-400 hover:bg-muted"
                type="button"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            )}
            {options.map((option) => {
              const checked = values.includes(option.value);
              return (
                <button
                  key={option.value}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-muted"
                  type="button"
                  onClick={() => toggle(option.value)}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-ink bg-ink dark:border-[hsl(210,20%,92%)] dark:bg-[hsl(210,20%,92%)]' : 'border-slate-300 dark:border-slate-600'}`}
                  >
                    {checked && (
                      <CheckCircle2
                        size={11}
                        className="text-white dark:text-[hsl(220,15%,9%)]"
                      />
                    )}
                  </span>
                  <span className="font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RestaurantsView({
  api,
  user,
  restaurants,
  refresh,
  setError,
  t,
  locale,
  onViewDetail,
}: {
  api: ApiClient;
  user: User;
  restaurants: RestaurantEntry[];
  refresh: () => Promise<void>;
  setError: (error: string | null) => void;
  t: (key: string) => string;
  locale: Locale;
  onViewDetail: (r: RestaurantEntry) => void;
}) {
  const typeOptions = locale === 'vi' ? TYPE_OPTIONS_VI : TYPE_OPTIONS_EN;
  const [sortByName, setSortByName] = useState(false);
  const [filterCuisine, setFilterCuisine] = useState('');
  const [filterFav, setFilterFav] = useState(false);
  const [filterRec, setFilterRec] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    cuisineType: '',
    type: typeOptions[0],
    isRecommended: false,
  });

  const filtered = restaurants
    .filter((e) => {
      if (filterCuisine && e.cuisineType !== filterCuisine) return false;
      if (filterFav && !e.isFavoritedByMe) return false;
      if (filterRec && !e.isRecommended) return false;
      return true;
    })
    .sort((a, b) =>
      sortByName
        ? a.name.localeCompare(b.name)
        : (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0) ||
          a.name.localeCompare(b.name),
    );

  const cuisineOptions = Array.from(
    new Set(restaurants.map((e) => e.cuisineType).filter(Boolean)),
  ).sort();

  const toggleFavorite = async (id: string) => {
    try {
      await api.request(`/restaurants/${id}/favorite`, { method: 'POST' });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not toggle favorite',
      );
    }
  };
  const toggleRecommend = async (id: string) => {
    try {
      await api.request(`/restaurants/${id}/recommend`, { method: 'PATCH' });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not toggle recommend',
      );
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api.request('/restaurants', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm({
        name: '',
        address: '',
        cuisineType: '',
        type: typeOptions[0],
        isRecommended: false,
      });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save restaurant',
      );
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <SectionTitle
          title={t('restaurants.title')}
          subtitle={t('restaurants.subtitle')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`btn h-8 px-3 text-[12px] ${sortByName ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setSortByName(!sortByName)}
          >
            {t('restaurants.sortByName')}
          </button>
          <select
            className="field h-8 text-[12px]"
            value={filterCuisine}
            onChange={(e) => setFilterCuisine(e.target.value)}
          >
            <option value="">{t('restaurants.filterCuisine')}</option>
            {cuisineOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-all ${filterFav ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400' : 'border-border bg-surface text-slate-500 hover:text-ink'}`}
            onClick={() => setFilterFav(!filterFav)}
          >
            <Heart size={12} fill={filterFav ? 'currentColor' : 'none'} />{' '}
            {t('restaurants.filterFavorite')}
          </button>
          <button
            className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition-all ${filterRec ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'border-border bg-surface text-slate-500 hover:text-ink'}`}
            onClick={() => setFilterRec(!filterRec)}
          >
            <ThumbsUp size={12} /> {t('restaurants.filterRecommended')}
          </button>
        </div>
        {restaurants.length === 0 && (
          <EmptyState
            icon={Store}
            title={t('restaurants.noEntries')}
            description={t('restaurants.noEntriesDesc')}
            steps={[
              t('restaurants.addEntry'),
              t('restaurants.filterCuisine'),
              t('restaurants.favorite'),
            ]}
          />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((entry) => (
            <article
              key={entry.id}
              className="panel cursor-pointer p-4 transition-shadow hover:shadow-md"
              onClick={() => onViewDetail(entry)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{entry.name}</h3>
                  <p className="text-sm text-slate-500">
                    {entry.type} / {entry.cuisineType}
                  </p>
                  <p className="mt-1 truncate text-sm">{entry.address}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(entry.id);
                    }}
                    title={t('restaurants.favorite')}
                  >
                    <Heart
                      size={14}
                      className={
                        entry.isFavoritedByMe
                          ? 'fill-red-500 text-red-500'
                          : 'text-slate-400'
                      }
                    />
                  </button>
                  {canChef(user) && (
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRecommend(entry.id);
                      }}
                      title={t('restaurants.recommended')}
                    >
                      <ThumbsUp
                        size={14}
                        className={
                          entry.isRecommended
                            ? 'fill-emerald-500 text-emerald-500'
                            : 'text-slate-400'
                        }
                      />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {entry.isFavoritedByMe && (
                  <span className="rounded-full bg-red-50 px-2 py-1 text-red-600 dark:bg-red-950 dark:text-red-400">
                    ♥ {t('restaurants.favorite')}
                  </span>
                )}
                {entry.isRecommended && (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {t('restaurants.recommended')}
                  </span>
                )}
                {entry.status === 'ARCHIVED' && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800">
                    ARCHIVED
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
      {canChef(user) && (
        <form className="panel h-fit space-y-4 p-4" onSubmit={submit}>
          <SectionTitle
            title={t('restaurants.addEntry')}
            subtitle={t('restaurants.addEntrySubtitle')}
          />
          <label className="block space-y-1">
            <span className="label">{locale === 'vi' ? 'Tên' : 'Name'}</span>
            <input
              className="field w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Địa chỉ' : 'Address'}
            </span>
            <input
              className="field w-full"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Loại ẩm thực' : 'Cuisine type'}
            </span>
            <select
              className="field w-full"
              value={form.cuisineType}
              onChange={(e) =>
                setForm({ ...form, cuisineType: e.target.value })
              }
              required
            >
              <option value="">
                {locale === 'vi' ? 'Chọn...' : 'Choose...'}
              </option>
              {CUISINE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="label">
              {locale === 'vi' ? 'Loại hình' : 'Type'}
            </span>
            <select
              className="field w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            >
              {typeOptions.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRecommended}
              onChange={(e) =>
                setForm({ ...form, isRecommended: e.target.checked })
              }
            />
            {t('restaurants.recommended')}
          </label>
          <button className="btn btn-primary w-full">
            {t('restaurants.createEntry')}
          </button>
        </form>
      )}
    </div>
  );
}

function StatsView({
  stats,
  t,
}: {
  stats: Stats | null;
  t: (key: string) => string;
}) {
  if (!stats) {
    return (
      <EmptyState
        icon={BarChart2}
        title={t('stats.noStats')}
        description={t('stats.noStatsDesc')}
        steps={[t('bills.createBill'), t('bills.markPaid'), t('stats.title')]}
      />
    );
  }

  const paymentData = Object.entries(stats.byPaymentStatus).map(
    ([name, value]) => ({ name, value }),
  );
  const cuisineData = Object.entries(stats.byCuisineType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const monthlyData = Object.entries(stats.byPeriod)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const freqRestaurant = Object.entries(stats.frequencyByRestaurant ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const freqCuisine = Object.entries(stats.frequencyByCuisine ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-5">
      <SectionTitle title={t('stats.title')} subtitle={t('stats.subtitle')} />

      <div className="panel flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <CircleDollarSign size={22} />
        </div>
        <div>
          <div className="text-sm text-slate-500">{t('stats.totalPeriod')}</div>
          <div className="text-3xl font-bold">{money(stats.total)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {paymentData.length > 0 && (
          <article className="panel p-4">
            <h3 className="mb-3 font-bold">{t('stats.paymentStatus')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => money(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {paymentData.map((d, i) => (
                <div
                  key={d.name}
                  className="flex items-center gap-1.5 text-[12px]"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500">{money(d.value)}</span>
                </div>
              ))}
            </div>
          </article>
        )}

        {cuisineData.length > 0 && (
          <article className="panel p-4">
            <h3 className="mb-3 font-bold">{t('stats.cuisineType')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={cuisineData}
                layout="vertical"
                margin={{ left: 60, right: 10, top: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  width={55}
                />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        )}

        {monthlyData.length > 0 && (
          <article className="panel p-4 md:col-span-2">
            <h3 className="mb-3 font-bold">{t('stats.monthlyTrend')}</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={monthlyData}
                margin={{ left: 10, right: 10, top: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        )}

        {freqRestaurant.length > 0 && (
          <article className="panel p-4">
            <h3 className="mb-3 font-bold">{t('stats.frequencyRestaurant')}</h3>
            <div className="space-y-2">
              {freqRestaurant.slice(0, 8).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold">
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          </article>
        )}

        {freqCuisine.length > 0 && (
          <article className="panel p-4">
            <h3 className="mb-3 font-bold">{t('stats.frequencyCuisine')}</h3>
            <div className="space-y-2">
              {freqCuisine.slice(0, 8).map(([name, count]) => (
                <div
                  key={name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">{name}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[12px] font-bold">
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          </article>
        )}

        <StatCard title={t('stats.restaurant')} data={stats.byEntry} />
      </div>
    </div>
  );
}

function AdminView({
  api,
  users,
  refresh,
  t,
}: {
  api: ApiClient;
  users: User[];
  refresh: () => Promise<void>;
  setError: (error: string | null) => void;
  t: (key: string) => string;
}) {
  const updateRole = async (id: string, chefRole: ChefRole) => {
    await api.request(`/users/${id}/chef-role`, {
      method: 'PATCH',
      body: JSON.stringify({ chefRole }),
    });
    await refresh();
  };

  return (
    <div className="space-y-4">
      <SectionTitle title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {users.length === 0 && (
        <EmptyState
          icon={Users}
          title={t('admin.noMembers')}
          description={t('admin.noMembersDesc')}
          steps={[]}
        />
      )}
      {users.map((member) => (
        <article
          key={member.id}
          className="panel flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div>
            <h3 className="font-bold">{member.name}</h3>
            <p className="text-sm text-slate-500">
              @{member.username} / {roleLabel(member, t)}
            </p>
          </div>
          <select
            className="field"
            value={member.chefRole ?? ''}
            onChange={(event) =>
              updateRole(member.id, (event.target.value || null) as ChefRole)
            }
          >
            <option value="">{t('admin.customerOnly')}</option>
            <option value="SOUS_CHEF">{t('role.souschef')}</option>
            <option value="HEAD_CHEF">{t('role.headchef')}</option>
          </select>
        </article>
      ))}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  steps,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  steps: string[];
}) {
  return (
    <div className="panel p-6">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-50 text-[#e9900c] dark:bg-amber-950">
          <Icon size={22} />
        </div>
        <h3 className="mt-3 text-lg font-bold">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
        {steps.length > 0 && (
          <div className="mt-4 grid w-full gap-2 text-left md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step}
                className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              >
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <PlusCircle size={14} /> Step {index + 1}
                </div>
                <div className="font-medium">{step}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="label">{label}</span>
      <CurrencyInput
        className="field w-full"
        value={value === 0 ? '' : value}
        onValueChange={(val, name, values) => onChange(values?.float ?? 0)}
        allowDecimals={false}
        allowNegativeValue={false}
        intlConfig={{ locale: 'vi-VN', currency: 'VND' }}
      />
    </label>
  );
}

function SummaryLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success';
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={`text-[13px] font-semibold ${tone === 'success' ? 'text-emerald-600' : 'text-ink'}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  return (
    <article className="panel p-4">
      <h3 className="font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {Object.entries(data).length === 0 && (
          <p className="text-sm text-slate-500">No data.</p>
        )}
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span>{key}</span>
              <span className="font-semibold">{money(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-emerald-500"
                style={{
                  width: `${total ? Math.max(4, (value / total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProfilePage({
  api,
  user,
  onBack,
  onSignOut,
  refresh,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
}: {
  api: ApiClient;
  user: User;
  onBack: () => void;
  onSignOut: () => void;
  refresh: () => Promise<void>;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    username: user.username,
    phone: user.phone ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    try {
      await api.request('/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          phone: form.phone || undefined,
        }),
      });
      setSaved(true);
      await refresh();
      setTimeout(() => {
        setSaved(false);
        setEditing(false);
      }, 1000);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Could not update profile',
      );
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
      <main className="mx-auto max-w-md px-4 py-8">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('bills.backToBills')}
        </button>

        <div className="panel p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e9900c] text-[24px] font-bold text-white">
              {initials(user.name)}
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-ink">{user.name}</h2>
              <p className="text-[13px] text-slate-500">
                @{user.username} / {roleLabel(user, t)}
              </p>
              {user.phone && (
                <p className="text-[13px] text-slate-500">{user.phone}</p>
              )}
            </div>
          </div>

          {!editing ? (
            <button
              className="btn btn-soft w-full"
              onClick={() => setEditing(true)}
            >
              <Edit3 size={14} /> {t('profile.edit')}
            </button>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {localError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {localError}
                </div>
              )}
              <label className="block space-y-1">
                <span className="label">{t('auth.name')}</span>
                <input
                  className="field w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="label">{t('auth.username')}</span>
                <input
                  className="field w-full"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="label">{t('auth.phone')}</span>
                <input
                  className="field w-full"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-soft flex-1"
                  onClick={() => setEditing(false)}
                >
                  {t('auth.cancel')}
                </button>
                <button
                  className={`btn flex-1 ${saved ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
                >
                  {saved ? (
                    <>
                      <CheckCircle2 size={14} /> {t('profile.saved')}
                    </>
                  ) : (
                    t('profile.save')
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function RestaurantDetailPage({
  api,
  user,
  restaurant,
  refresh,
  onBack,
  onSignOut,
  setError,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
}: {
  api: ApiClient;
  user: User;
  restaurant: RestaurantEntry;
  refresh: () => Promise<void>;
  onBack: () => void;
  onSignOut: () => void;
  setError: (error: string | null) => void;
  t: (key: string) => string;
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const toggleFavorite = async () => {
    try {
      await api.request(`/restaurants/${restaurant.id}/favorite`, {
        method: 'POST',
      });
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not toggle favorite',
      );
    }
  };

  const runAction = async (action: () => Promise<void>, fallback: string) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  };

  return (
    <div className="min-h-screen bg-bg font-sans text-ink">
      <AppHeader
        user={user}
        onSignOut={onSignOut}
        t={t}
        locale={locale}
        setLocale={setLocale}
        theme={theme}
        setTheme={setTheme}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <button
          className="mb-6 flex items-center gap-1.5 text-[13px] text-slate-500 transition-colors hover:text-ink"
          onClick={onBack}
        >
          <ArrowLeft size={14} /> {t('nav.restaurants')}
        </button>

        <section className="panel p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[22px] font-bold text-ink">
                {restaurant.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {restaurant.type} / {restaurant.cuisineType}
              </p>
              <p className="mt-1 text-[14px]">{restaurant.address}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-bold ${restaurant.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
            >
              {restaurant.status}
            </span>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all ${restaurant.isFavoritedByMe ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-950 dark:text-red-400' : 'border-border text-slate-500 hover:text-ink'}`}
              onClick={toggleFavorite}
            >
              <Heart
                size={14}
                fill={restaurant.isFavoritedByMe ? 'currentColor' : 'none'}
              />
              {restaurant.isFavoritedByMe
                ? '♥ ' + t('restaurants.favorite')
                : t('restaurants.favorite')}
            </button>
            {restaurant.isRecommended && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <ThumbsUp size={14} /> {t('restaurants.recommended')}
              </span>
            )}
          </div>

          {restaurant.links && restaurant.links.length > 0 && (
            <div className="mb-4">
              <h3 className="label mb-2">Links</h3>
              <div className="flex flex-wrap gap-2">
                {restaurant.links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-muted"
                  >
                    <ExternalLink size={12} /> {link.label || link.url}
                  </a>
                ))}
              </div>
            </div>
          )}

          {isHead(user) && (
            <div className="flex gap-3 border-t border-muted pt-4">
              {restaurant.status === 'ACTIVE' && (
                <button
                  className="btn btn-soft flex-1 hover:border-red-300 hover:text-red-500"
                  onClick={() =>
                    runAction(
                      () =>
                        api.request(`/restaurants/${restaurant.id}/archive`, {
                          method: 'PATCH',
                        }),
                      'Could not archive',
                    )
                  }
                >
                  {t('bills.archive')}
                </button>
              )}
              {restaurant.status === 'ARCHIVED' && (
                <button
                  className="btn btn-soft flex-1 hover:border-emerald-300 hover:text-emerald-500"
                  onClick={() =>
                    runAction(
                      () =>
                        api.request(`/restaurants/${restaurant.id}/restore`, {
                          method: 'PATCH',
                        }),
                      'Could not restore',
                    )
                  }
                >
                  {t('bills.restore')}
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
