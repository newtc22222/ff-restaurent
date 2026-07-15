const errorTranslationKeys: Record<string, string> = {
  FINAL_HEAD_CHEF_REQUIRED: 'error.finalHeadChefRequired',
  FEEDBACK_ALREADY_EXISTS: 'error.feedbackAlreadyExists',
  FEEDBACK_CURSOR_INVALID: 'error.feedbackCursorInvalid',
  FEEDBACK_NOT_FOUND: 'error.feedbackNotFound',
  FEEDBACK_PAYMENT_REQUIRED: 'error.feedbackPaymentRequired',
  IDENTIFIER_TAKEN: 'error.identifierTaken',
  INTERNAL_ERROR: 'error.internal',
  INVALID_CREDENTIALS: 'error.invalidCredentials',
  INVALID_PARTICIPANTS: 'error.invalidParticipants',
  NOT_FOUND: 'error.notFound',
  CURRENT_PASSWORD_INVALID: 'error.currentPasswordInvalid',
  PASSWORD_CONFIRMATION_MISMATCH: 'error.passwordConfirmationMismatch',
  PASSWORD_LENGTH_INVALID: 'error.passwordLengthInvalid',
  PASSWORD_REUSE_FORBIDDEN: 'error.passwordReuseForbidden',
  PASSWORD_RESET_INVALID: 'error.passwordResetInvalid',
  PASSWORD_RESET_CONFLICT: 'error.passwordResetConflict',
  PAID_BILL_AMENDMENT_BLOCKED: 'error.paidBillAmendmentBlocked',
  PAYMENT_STATUS_CONFLICT: 'error.paymentStatusConflict',
  PAYMENT_STATUS_UNCHANGED: 'error.paymentStatusUnchanged',
  REGISTRATION_NOT_AUTHORIZED: 'error.registrationNotAuthorized',
  ROOT_ADMIN_REQUIRED: 'error.rootAdminRequired',
  ROOT_ADMIN_ROLE_CHANGE_FORBIDDEN: 'error.rootAdminRoleChangeForbidden',
  ROOT_RESET_REQUIRES_OPERATOR: 'error.rootResetRequiresOperator',
  ROOT_TRANSFER_CONFIRMATION_MISMATCH: 'error.rootTransferConfirmationMismatch',
  ROOT_TRANSFER_CONFLICT: 'error.rootTransferConflict',
  ROOT_TRANSFER_PASSWORD_INVALID: 'error.rootTransferPasswordInvalid',
  ROOT_TRANSFER_TARGET_INVALID: 'error.rootTransferTargetInvalid',
  SESSION_INVALIDATED: 'error.sessionInvalidated',
  RELATION_CONFLICT: 'error.relationConflict',
  SELF_ROLE_CHANGE_FORBIDDEN: 'error.selfRoleChangeForbidden',
  UNIQUE_CONFLICT: 'error.uniqueConflict',
  VALIDATION_ERROR: 'error.validation',
};

export const resultErrorMessage = (
  code: unknown,
  fallback: string,
  t: (key: string) => string,
) => {
  if (typeof code !== 'string') return fallback;
  const key = errorTranslationKeys[code];
  return key ? t(key) : fallback;
};
