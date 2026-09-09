/**
 * Employee Data Types
 * Matches the backend models for Employee, Address, and Emergency Contacts.
 */

export interface Address {
  public_id?: string;
  address_public_id?: string;
  address_type: "Permanent" | "Current" | "Office" | "permanent" | "current" | string;
  street_address: string;
  city: string;
  state: string;
  pincode?: string;
  postal_code?: string;
  country: string;
  formatted_address?: string;
  is_primary: boolean;
}

export interface EmergencyContact {
  contact_id: number;
  contact_name: string;
  relationship: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  is_primary: boolean;
}

export interface Employee {
  public_id: string;
  user_public_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  phone_number?: string;
  gender: "Male" | "Female" | "Other" | "male" | "female" | "other" | string;
  date_of_birth?: string;
  joining_date: string;
  employment_type: "Full_Time" | "Part_Time" | "Contract" | "Intern" | "full_time" | "part_time" | "contract" | "intern" | string;
  employee_status: "Active" | "Inactive" | "On_Leave" | "Terminated" | "active" | "inactive" | "on_leave" | "terminated" | "resigned" | string;
  department_public_id?: string;
  department_name?: string;
  designation_public_id?: string;
  designation_name?: string;
  reporting_manager_public_id?: string | null;
  reporting_manager_name?: string | null;
  avatar_url?: string;
  pan_number?: string;
  uan_number?: string;
  aadhar_number?: string;
  work_mode?: "in_office" | "remote" | "field";
  timezone?: string;
  addresses?: Address[];
  emergency_contacts?: EmergencyContact[];
}

export interface EmployeeFilterParams {
  search?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  employee_code?: string;
  department_public_id?: string;
  designation_public_id?: string;
  employee_status?: string;
  employment_type?: string;
  gender?: string;
  min_joining_date?: string;
  max_joining_date?: string;
  skip?: number;
  limit?: number;
}
