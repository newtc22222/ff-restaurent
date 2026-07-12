import { Navigate, useFetcher, useNavigate, useParams } from 'react-router';
import { useAppContext } from './app-context.js';
import { useI18n } from './i18n.js';
import { useTheme } from './theme.js';
import { canChef, isHead, uniqueUsers } from './utils/helpers.js';
import AdminView from './components/views/AdminView.js';
import BillDetailPage from './components/views/BillDetailPage.js';
import BillsView from './components/views/BillsView.js';
import CreateBillPage from './components/views/CreateBillPage.js';
import LoginScreen from './components/views/LoginScreen.js';
import ProfilePage from './components/views/ProfilePage.js';
import RestaurantDetailPage from './components/views/RestaurantDetailPage.js';
import RestaurantsView from './components/views/RestaurantsView.js';
import StatsView from './components/views/StatsView.js';

function useCommonViewProps() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  return { locale, setLocale, t, theme, setTheme };
}

export function LoginRoute() {
  const common = useCommonViewProps();
  const fetcher = useFetcher();
  return (
    <LoginScreen
      {...common}
      error={null}
      onLogin={async (identifier, password) => {
        await fetcher.submit(
          { intent: 'login', identifier, password },
          { method: 'post', encType: 'application/json' },
        );
      }}
      onRegister={async (name, username, phone, password, inviteCode) => {
        await fetcher.submit(
          { intent: 'register', name, username, phone, password, inviteCode },
          { method: 'post', encType: 'application/json' },
        );
      }}
    />
  );
}

export function BillsRoute() {
  const navigate = useNavigate();
  const { user, bills, setError } = useAppContext();
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl">
      <BillsView
        user={user}
        bills={bills}
        setError={setError}
        onCreateBill={() => navigate('/bills/new')}
        onViewBill={(bill) => navigate(`/bills/${bill.id}`)}
        t={t}
      />
    </div>
  );
}

export function RestaurantsRoute() {
  const navigate = useNavigate();
  const { user, restaurants, setError } = useAppContext();
  const { locale, t } = useI18n();
  return (
    <RestaurantsView
      user={user}
      restaurants={restaurants}
      setError={setError}
      t={t}
      locale={locale}
      onViewDetail={(restaurant) => navigate(`/restaurants/${restaurant.id}`)}
    />
  );
}

export function StatsRoute() {
  const { stats } = useAppContext();
  const { t } = useI18n();
  return <StatsView stats={stats} t={t} />;
}

export function AdminRoute() {
  const { user, users, setError } = useAppContext();
  const { t } = useI18n();
  if (!isHead(user)) return <Navigate to="/bills" replace />;
  return <AdminView users={users} setError={setError} t={t} />;
}

export function CreateBillRoute() {
  const navigate = useNavigate();
  const { billId } = useParams();
  const { user, users, bills, restaurants, setError, logout } = useAppContext();
  const common = useCommonViewProps();
  if (!canChef(user)) return <Navigate to="/bills" replace />;
  const bill = billId
    ? bills.find((candidate) => candidate.id === billId)
    : undefined;
  if (billId && !bill) return <Navigate to="/bills" replace />;
  return (
    <CreateBillPage
      {...common}
      user={user}
      members={uniqueUsers(users, user)}
      restaurants={restaurants}
      onBack={() => navigate('/bills')}
      onSignOut={logout}
      setError={setError}
      editBill={bill}
    />
  );
}

export function BillDetailRoute() {
  const navigate = useNavigate();
  const { billId } = useParams();
  const { user, bills, setError, logout } = useAppContext();
  const common = useCommonViewProps();
  const bill = bills.find((candidate) => candidate.id === billId);
  if (!bill) return <Navigate to="/bills" replace />;
  return (
    <BillDetailPage
      {...common}
      user={user}
      bill={bill}
      onBack={() => navigate('/bills')}
      onSignOut={logout}
      setError={setError}
      onEditBill={() => navigate(`/bills/${bill.id}/edit`)}
    />
  );
}

export function RestaurantDetailRoute() {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const { user, restaurants, setError, logout } = useAppContext();
  const common = useCommonViewProps();
  const restaurant = restaurants.find(
    (candidate) => candidate.id === restaurantId,
  );
  if (!restaurant) return <Navigate to="/restaurants" replace />;
  return (
    <RestaurantDetailPage
      {...common}
      user={user}
      restaurant={restaurant}
      onBack={() => navigate('/restaurants')}
      onSignOut={logout}
      setError={setError}
    />
  );
}

export function ProfileRoute() {
  const navigate = useNavigate();
  const { user, logout } = useAppContext();
  const common = useCommonViewProps();
  return (
    <ProfilePage
      {...common}
      user={user}
      onBack={() => navigate('/bills')}
      onSignOut={logout}
    />
  );
}
