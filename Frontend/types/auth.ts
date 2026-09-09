/**
 * Authentication and RBAC (Role Based Access Control) Types
 * 
 * Matches Python FastAPI `schemas/auth_schema.py` and Java `com.datansh.EmployeeManagment.dto.*`
 */

import { UserRole } from "./common";

export interface Permission {
  permission_id?: number;
  permission_name: string;
  module?: string;
  description?: string;
}

export interface Role {
  role_id?: number;
  role_name: UserRole | string;
  description?: string;
  permissions?: Permission[] | string[];
}

export interface RoleCreateIn {
  role_name: string;
  description?: string;
  permission_names?: string[];
  permissions?: string[];
}

export interface RoleUpdateIn {
  role_name?: string;
  description?: string;
  permission_names?: string[];
  permissions?: string[];
}

export interface RoleDetail {
  public_id: string;
  role_name: string;
  description?: string;
  permissions: string[];
  user_count?: number;
  is_system?: boolean;
}

export interface UserProfile {
  public_id: string;
  email: string;
  display_name: string;
  name?: string;
  secondary_email?: string | null;
  is_active: boolean;
  is_verified?: boolean;
  employee_public_id: string | null;
  roles: any[];
  permissions: string[];
  custom_permissions?: string[];
  revoked_permissions?: string[];
  created_at?: string;
  last_login?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LoginResponse {
  ok?: boolean;
  message?: string;
  tokens?: AuthTokens;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  user: UserProfile;
  permissions?: string[];
}

export interface SendOtpIn {
  email: string;
  purpose?: "signup" | "password_reset";
}

export interface SendOtpOut {
  ok?: boolean;
  message: string;
  retry_after?: number;
  expires_in_seconds?: number;
  resend_in_seconds?: number;
}

export interface UserSignupIn {
  email: string;
  display_name: string;
  password: string;
  otp?: string;
  otp_code?: string;
}

export interface ForgotPasswordIn {
  email: string;
}

export interface ResetPasswordIn {
  email: string;
  otp?: string;
  otp_code?: string;
  new_password: string;
}

export interface ChangePasswordIn {
  current_password?: string;
  old_password?: string;
  new_password: string;
}

export interface RoleAssignIn {
  role_names: (UserRole | string)[];
}
