/**
 * Security & Audit Log Types
 */

export interface AuditLog {
  log_id: number;
  action: string;
  module: string;
  actor_name: string;
  actor_email: string;
  ip_address: string;
  details: string;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}
