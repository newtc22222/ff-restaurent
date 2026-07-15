CREATE INDEX "Notification_userId_createdAt_id_idx"
ON "Notification"("userId", "createdAt", "id");

CREATE INDEX "Notification_userId_readAt_idx"
ON "Notification"("userId", "readAt");

CREATE INDEX "Notification_billId_userId_createdAt_idx"
ON "Notification"("billId", "userId", "createdAt");

CREATE INDEX "BillAuditLog_billId_createdAt_id_idx"
ON "BillAuditLog"("billId", "createdAt", "id");
