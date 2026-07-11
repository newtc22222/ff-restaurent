import { useState, useCallback, useMemo } from 'react';

export type Locale = 'vi' | 'en';

const translations = {
  vi: {
    // App
    'app.name': 'FF RESTaurent',
    'app.tagline': 'Theo dõi hóa đơn nhóm, tình trạng thanh toán và chi tiêu.',

    // Nav
    'nav.bills': 'Hóa đơn',
    'nav.restaurants': 'Nhà hàng',
    'nav.stats': 'Thống kê',
    'nav.notifications': 'Thông báo',
    'notifications.empty': 'Chưa có thông báo.',
    'nav.members': 'Thành viên',

    // Auth
    'auth.signIn': 'Đăng nhập',
    'auth.signOut': 'Đăng xuất',
    'auth.signingIn': 'Đang đăng nhập...',
    'auth.register': 'Đăng ký',
    'auth.registering': 'Đang đăng ký...',
    'auth.identifier': 'Số điện thoại / Tên đăng nhập',
    'auth.password': 'Mật khẩu',
    'auth.name': 'Họ tên',
    'auth.username': 'Tên đăng nhập',
    'auth.phone': 'Số điện thoại',
    'auth.inviteCode': 'Mã mời nhóm',
    'auth.role': 'Vai trò',
    'auth.confirmSignOut': 'Bạn có chắc chắn muốn đăng xuất?',
    'auth.confirmSignOutTitle': 'Xác nhận đăng xuất',
    'auth.cancel': 'Hủy',
    'auth.haveAccount': 'Đã có tài khoản?',
    'auth.noAccount': 'Chưa có tài khoản?',

    // Roles
    'role.customer': 'Khách hàng',
    'role.headchef': 'Bếp trưởng',
    'role.souschef': 'Bếp phó',

    // Bills
    'bills.title': 'Hóa đơn',
    'bills.createBill': 'Tạo hóa đơn',
    'bills.editBill': 'Sửa hóa đơn',
    'bills.viewDetail': 'Xem chi tiết',
    'bills.remind': 'Nhắc nhở',
    'bills.archive': 'Lưu trữ',
    'bills.restore': 'Khôi phục',
    'bills.sendReminders': 'Gửi nhắc nhở',
    'bills.archiveBill': 'Lưu trữ hóa đơn',
    'bills.restoreBill': 'Khôi phục hóa đơn',
    'bills.markPaid': 'Đánh dấu đã trả',
    'bills.paid': 'Đã trả',
    'bills.waiting': 'Đang chờ',
    'bills.settled': 'ĐÃ THANH TOÁN',
    'bills.filterRestaurant': 'Nhà hàng / Quán ăn',
    'bills.filterMember': 'Thành viên',
    'bills.filterPaid': 'Đã trả',
    'bills.filterUnpaid': 'Chưa trả',
    'bills.clearAll': 'Xóa tất cả',
    'bills.noBills': 'Chưa có hóa đơn',
    'bills.noBillsDesc':
      'Bắt đầu với một nhà hàng đang hoạt động, sau đó tạo hóa đơn ăn chung đầu tiên.',
    'bills.noMatch': 'Không có hóa đơn nào khớp với bộ lọc.',
    'bills.scopeNote': 'Hóa đơn hiển thị theo vai trò và tham gia.',
    'bills.memberBreakdown': 'Chi tiết thành viên',
    'bills.amountStatus': 'Số tiền / Trạng thái',
    'bills.backToBills': 'Quay lại Hóa đơn',
    'bills.of': 'trong',
    'bills.paidCount': 'đã trả',
    'bills.confirmArchive': 'Bạn có chắc chắn muốn lưu trữ hóa đơn này?',
    'bills.confirmRestore': 'Bạn có chắc chắn muốn khôi phục hóa đơn này?',
    'bills.qrCode': 'Mã QR thanh toán',
    'bills.uploadQr': 'Tải lên mã QR',

    // Create Bill
    'createBill.title': 'Tạo hóa đơn',
    'createBill.subtitle':
      'Giá trị tính bằng VND. Cơ bản là tổng giá trị của các thành viên; phí ship chia đều.',
    'createBill.restaurant': 'Nhà hàng / Quán ăn',
    'createBill.choose': 'Chọn...',
    'createBill.vat': 'VAT',
    'createBill.shipping': 'Phí ship',
    'createBill.discount': 'Giảm giá',
    'createBill.participants': 'Thành viên / Giá gốc',
    'createBill.baseTotal': 'Tổng gốc',
    'createBill.addMembers': 'Thêm thành viên bên dưới',
    'createBill.grandTotal': 'Tổng cộng',
    'createBill.base': 'Gốc (tổng thành viên)',
    'createBill.created': 'Đã tạo hóa đơn!',
    'createBill.submit': 'Tạo hóa đơn',

    // Restaurants
    'restaurants.title': 'Nhà hàng & quán ăn',
    'restaurants.subtitle': 'Loại hình do người dùng tự định nghĩa.',
    'restaurants.addEntry': 'Thêm địa điểm',
    'restaurants.addEntrySubtitle':
      'SOUS_CHEF và HEAD_CHEF có thể quản lý danh sách.',
    'restaurants.createEntry': 'Tạo địa điểm',
    'restaurants.noEntries': 'Chưa có nhà hàng',
    'restaurants.noEntriesDesc':
      'Xây dựng danh sách trước khi tạo hóa đơn. Đánh dấu các địa điểm yêu thích hoặc được đề xuất.',
    'restaurants.favorite': 'Yêu thích',
    'restaurants.recommended': 'Được đề xuất',
    'restaurants.sortByName': 'Sắp xếp theo tên',
    'restaurants.filterCuisine': 'Lọc theo ẩm thực',
    'restaurants.filterFavorite': 'Yêu thích',
    'restaurants.filterRecommended': 'Đề xuất',

    // Stats
    'stats.title': 'Thống kê cá nhân',
    'stats.subtitle':
      'Chi tiêu theo thanh toán, ẩm thực, địa điểm và thời gian.',
    'stats.totalPeriod': 'Tổng trong kỳ',
    'stats.paymentStatus': 'Tình trạng thanh toán',
    'stats.cuisineType': 'Loại ẩm thực',
    'stats.restaurant': 'Nhà hàng / Quán ăn',
    'stats.monthlyTrend': 'Xu hướng tháng',
    'stats.noStats': 'Chưa có thống kê',
    'stats.noStatsDesc':
      'Số liệu hàng tháng sẽ hiển thị sau khi tạo hóa đơn và thanh toán.',
    'stats.weekly': 'Tuần',
    'stats.monthly': 'Tháng',
    'stats.yearly': 'Năm',
    'stats.frequency': 'Tần suất',
    'stats.frequencyRestaurant': 'Tần suất nhà hàng',
    'stats.frequencyCuisine': 'Tần suất ẩm thực',

    // Admin
    'admin.title': 'Thành viên',
    'admin.subtitle': 'Bếp trưởng có thể cấp hoặc thay đổi vai trò.',
    'admin.noMembers': 'Chưa tải thành viên',
    'admin.noMembersDesc': 'Thành viên sẽ hiển thị sau khi API trả về dữ liệu.',
    'admin.customerOnly': 'Chỉ Khách hàng',

    // Profile
    'profile.title': 'Hồ sơ',
    'profile.edit': 'Chỉnh sửa hồ sơ',
    'profile.save': 'Lưu',
    'profile.saved': 'Đã lưu!',

    // Theme
    'theme.light': 'Sáng',
    'theme.dark': 'Tối',
    'theme.system': 'Hệ thống',

    // Common
    'common.loading': 'Đang tải dữ liệu...',
    'common.step': 'Bước',
    'common.remove': 'Xóa',
    'common.confirm': 'Xác nhận',
    'common.yes': 'Có',
    'common.no': 'Không',
  },
  en: {
    // App
    'app.name': 'FF RESTaurent',
    'app.tagline':
      'Track group restaurant bills, payment status, and spending.',

    // Nav
    'nav.bills': 'Bills',
    'nav.restaurants': 'Restaurants',
    'nav.stats': 'Stats',
    'nav.notifications': 'Notifications',
    'notifications.empty': 'No notifications yet.',
    'nav.members': 'Members',

    // Auth
    'auth.signIn': 'Sign in',
    'auth.signOut': 'Sign out',
    'auth.signingIn': 'Signing in...',
    'auth.register': 'Register',
    'auth.registering': 'Registering...',
    'auth.identifier': 'Phone / Username',
    'auth.password': 'Password',
    'auth.name': 'Full name',
    'auth.username': 'Username',
    'auth.phone': 'Phone number',
    'auth.inviteCode': 'Group invite code',
    'auth.role': 'Role',
    'auth.confirmSignOut': 'Are you sure you want to sign out?',
    'auth.confirmSignOutTitle': 'Confirm sign out',
    'auth.cancel': 'Cancel',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",

    // Roles
    'role.customer': 'Customer',
    'role.souschef': 'Sous chef',
    'role.headchef': 'Executive chef',

    // Bills
    'bills.title': 'Bills',
    'bills.createBill': 'Create bill',
    'bills.editBill': 'Edit bill',
    'bills.viewDetail': 'View detail',
    'bills.remind': 'Remind',
    'bills.archive': 'Archive',
    'bills.restore': 'Restore',
    'bills.sendReminders': 'Send reminders',
    'bills.archiveBill': 'Archive bill',
    'bills.restoreBill': 'Restore bill',
    'bills.markPaid': 'Mark paid',
    'bills.paid': 'Paid',
    'bills.waiting': 'Waiting',
    'bills.settled': 'SETTLED',
    'bills.filterRestaurant': 'Restaurant / Eatery',
    'bills.filterMember': 'Member',
    'bills.filterPaid': 'Paid',
    'bills.filterUnpaid': 'Unpaid',
    'bills.clearAll': 'Clear all',
    'bills.noBills': 'No bills yet',
    'bills.noBillsDesc':
      'Start with an active restaurant entry, then create the first shared lunch bill.',
    'bills.noMatch': 'No bills match the selected filters.',
    'bills.scopeNote': 'Visible bills are scoped by role and participation.',
    'bills.memberBreakdown': 'Member breakdown',
    'bills.amountStatus': 'Amount / Status',
    'bills.backToBills': 'Back to Bills',
    'bills.of': 'of',
    'bills.paidCount': 'paid',
    'bills.confirmArchive': 'Are you sure you want to archive this bill?',
    'bills.confirmRestore': 'Are you sure you want to restore this bill?',
    'bills.qrCode': 'Payment QR Code',
    'bills.uploadQr': 'Upload QR',

    // Create Bill
    'createBill.title': 'Create bill',
    'createBill.subtitle':
      'Amounts are in VND. Base is the sum of member values; shipping is split evenly.',
    'createBill.restaurant': 'Restaurant / Eatery',
    'createBill.choose': 'Choose...',
    'createBill.vat': 'VAT',
    'createBill.shipping': 'Shipping',
    'createBill.discount': 'Discount',
    'createBill.participants': 'Participants / Base',
    'createBill.baseTotal': 'Base total',
    'createBill.addMembers': 'Add members below',
    'createBill.grandTotal': 'Grand total',
    'createBill.base': 'Base (sum of members)',
    'createBill.created': 'Bill created!',
    'createBill.submit': 'Create bill',

    // Restaurants
    'restaurants.title': 'Restaurants & eateries',
    'restaurants.subtitle': 'The type label is user-defined per entry.',
    'restaurants.addEntry': 'Add entry',
    'restaurants.addEntrySubtitle':
      'SOUS_CHEF and HEAD_CHEF can maintain the directory.',
    'restaurants.createEntry': 'Create entry',
    'restaurants.noEntries': 'No restaurant entries',
    'restaurants.noEntriesDesc':
      'Build the directory before collecting bills. Mark dependable spots as favorites or recommended.',
    'restaurants.favorite': 'Favorite',
    'restaurants.recommended': 'Recommended',
    'restaurants.sortByName': 'Sort by name',
    'restaurants.filterCuisine': 'Filter by cuisine',
    'restaurants.filterFavorite': 'Favorite',
    'restaurants.filterRecommended': 'Recommended',

    // Stats
    'stats.title': 'Personal statistics',
    'stats.subtitle': 'Spend grouped by payment, cuisine, entry, and period.',
    'stats.totalPeriod': 'Total in selected period',
    'stats.paymentStatus': 'Payment status',
    'stats.cuisineType': 'Cuisine type',
    'stats.restaurant': 'Restaurant / Eatery',
    'stats.monthlyTrend': 'Monthly trend',
    'stats.noStats': 'No statistics yet',
    'stats.noStatsDesc':
      'Monthly insights appear after bills are created and participants start marking payments as paid.',
    'stats.weekly': 'Weekly',
    'stats.monthly': 'Monthly',
    'stats.yearly': 'Yearly',
    'stats.frequency': 'Frequency',
    'stats.frequencyRestaurant': 'Restaurant frequency',
    'stats.frequencyCuisine': 'Cuisine frequency',

    // Admin
    'admin.title': 'Members',
    'admin.subtitle':
      'HEAD_CHEF can grant or change the one optional chef role.',
    'admin.noMembers': 'No members loaded',
    'admin.noMembersDesc':
      'Members appear here after the API returns team users. Head chefs can promote one optional chef role per member.',
    'admin.customerOnly': 'CUSTOMER only',

    // Profile
    'profile.title': 'Profile',
    'profile.edit': 'Edit profile',
    'profile.save': 'Save',
    'profile.saved': 'Saved!',

    // Theme
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',

    // Common
    'common.loading': 'Loading latest data...',
    'common.step': 'Step',
    'common.remove': 'Remove',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['vi'];

const STORAGE_KEY = 'ff-locale';

export const getStoredLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'vi') return stored;
  return 'vi';
};

export const useI18n = () => {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(STORAGE_KEY, newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const k = key as TranslationKey;
      return (
        (translations[locale] as Record<string, string>)[k] ??
        (translations['en'] as Record<string, string>)[k] ??
        key
      );
    },
    [locale],
  );

  return useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
};
