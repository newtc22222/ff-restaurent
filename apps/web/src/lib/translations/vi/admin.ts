/** Vietnamese strings for the admin namespace. Source of truth for this namespace's key set. */

export const admin = {
  'role.customer': 'Khách hàng',
  'role.headchef': 'Bếp trưởng',
  'role.souschef': 'Bếp phó',
  'role.rootadmin': 'Quản trị viên gốc',
  'admin.title': 'Thành viên',
  'admin.subtitle': 'Chỉ Quản trị viên gốc có thể thay đổi vai trò thành viên.',
  'admin.noMembers': 'Chưa tải thành viên',
  'admin.noMembersDesc': 'Thành viên sẽ hiển thị sau khi API trả về dữ liệu.',
  'admin.customerOnly': 'Khách hàng',
  'admin.searchMembers': 'Tìm theo tên, tên đăng nhập hoặc số điện thoại',
  'admin.noSearchResults': 'Không có thành viên phù hợp với tìm kiếm.',
  'admin.fullName': 'Họ tên',
  'admin.username': 'Tên đăng nhập',
  'admin.phone': 'Số điện thoại',
  'admin.effectiveRole': 'Vai trò hiệu lực',
  'admin.actions': 'Thao tác',
  'admin.role': 'vai trò',
  'admin.readOnly': 'Chỉ đọc',
  'admin.mobileMembers': 'Danh sách thành viên',
  'admin.transferTitle': 'Chuyển quyền Quản trị viên gốc',
  'admin.transferDescription':
    'Thao tác này đăng xuất cả hai tài khoản và yêu cầu đăng nhập lại.',
  'admin.transferTarget': 'Thành viên nhận quyền',
  'admin.chooseMember': 'Chọn thành viên',
  'admin.confirmTargetUsername': 'Nhập lại tên đăng nhập người nhận',
  'admin.currentPassword': 'Mật khẩu hiện tại của bạn',
  'admin.transferAction': 'Chuyển quyền và đăng xuất',
  'admin.noTransferTargets': 'Không có thành viên phù hợp.',
  'admin.passwordResetsTitle': 'Yêu cầu đặt lại mật khẩu',
  'admin.passwordResetsDescription':
    'Xác minh người yêu cầu ngoài ứng dụng trước khi cấp mã dùng một lần.',
  'admin.noPasswordResets': 'Không có yêu cầu đang chờ.',
  'admin.resetCodeOnce':
    'Mã này chỉ hiển thị một lần. Hãy gửi qua kênh an toàn.',
  'admin.resetCodeIssued': 'Đã cấp mã; hết hạn sau 15 phút',
  'admin.resetPending': 'Đang chờ duyệt',
  'admin.rootResetOperatorOnly':
    'Tài khoản Root Admin phải dùng lệnh khôi phục của vận hành.',
  'admin.issueResetCode': 'Cấp mã',
  'admin.rejectReset': 'Từ chối',
} as const;
