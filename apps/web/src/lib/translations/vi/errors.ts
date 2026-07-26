/** Vietnamese strings for the errors namespace. Source of truth for this namespace's key set. */

export const errors = {
  'validation.vietnamMobilePhone':
    'Nhập số di động Việt Nam hợp lệ, ví dụ 0901234567 hoặc +84901234567.',
  'validation.passwordLength': 'Mật khẩu mới phải có từ 8 đến 128 ký tự.',
  'validation.passwordReuse': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  'validation.passwordConfirmation': 'Xác nhận mật khẩu không khớp.',
  'error.invalidCredentials':
    'Tên đăng nhập, số điện thoại hoặc mật khẩu không đúng.',
  'error.registrationNotAuthorized': 'Mã mời không hợp lệ.',
  'error.identifierTaken': 'Tên đăng nhập hoặc số điện thoại đã được sử dụng.',
  'error.validation': 'Vui lòng kiểm tra lại thông tin đã nhập.',
  'error.uniqueConflict': 'Dữ liệu này đã tồn tại.',
  'error.relationConflict': 'Không thể thay đổi mục đang được sử dụng.',
  'error.notFound': 'Không tìm thấy mục được yêu cầu.',
  'error.internal': 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.',
  'error.invalidParticipants': 'Danh sách thành viên hóa đơn không hợp lệ.',
  'error.billDuplicateDetected': 'Đã phát hiện hóa đơn trùng khớp.',
  'error.participantGroupNameTaken': 'Tên nhóm này đã được sử dụng.',
  'error.participantGroupNotFound': 'Không tìm thấy nhóm thành viên.',
  'error.feedbackPaymentRequired':
    'Bạn phải thanh toán phần của mình trước khi đánh giá.',
  'error.feedbackAlreadyExists': 'Hóa đơn này đã có đánh giá của bạn.',
  'error.feedbackNotFound': 'Không tìm thấy đánh giá.',
  'error.feedbackCursorInvalid': 'Trang đánh giá không còn hợp lệ.',
  'error.paidBillAmendmentBlocked':
    'Không thể thay đổi tài chính sau khi bắt đầu thanh toán.',
  'error.paymentStatusConflict':
    'Trạng thái thanh toán đã thay đổi. Vui lòng làm mới và thử lại.',
  'error.paymentStatusUnchanged': 'Trạng thái thanh toán không thay đổi.',
  'error.finalHeadChefRequired': 'Nhóm phải giữ lại ít nhất một Bếp trưởng.',
  'error.selfRoleChangeForbidden':
    'Bạn không thể thay đổi vai trò của chính mình.',
  'error.rootAdminRequired':
    'Chỉ Quản trị viên gốc có quyền thực hiện thao tác này.',
  'error.rootAdminRoleChangeForbidden':
    'Không thể thay đổi vai trò của Quản trị viên gốc tại đây.',
  'error.rootTransferConfirmationMismatch':
    'Tên đăng nhập xác nhận không khớp.',
  'error.rootTransferConflict':
    'Quyền quản trị vừa thay đổi. Vui lòng đăng nhập lại.',
  'error.rootTransferPasswordInvalid': 'Mật khẩu hiện tại không đúng.',
  'error.rootTransferTargetInvalid': 'Chọn một thành viên hiện có khác.',
  'error.sessionInvalidated':
    'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.',
  'error.currentPasswordInvalid': 'Mật khẩu hiện tại không đúng.',
  'error.passwordConfirmationMismatch': 'Xác nhận mật khẩu không khớp.',
  'error.passwordLengthInvalid': 'Mật khẩu mới phải có từ 8 đến 128 ký tự.',
  'error.passwordReuseForbidden': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  'error.passwordResetInvalid': 'Mã đặt lại không hợp lệ hoặc đã hết hạn.',
  'error.passwordResetConflict':
    'Yêu cầu vừa thay đổi. Hãy làm mới và thử lại.',
  'error.rootResetRequiresOperator':
    'Khôi phục Root Admin phải dùng lệnh dành cho vận hành.',
} as const;
