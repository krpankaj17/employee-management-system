/**
 * Holiday Calendar Types
 */

export interface Holiday {
  holiday_id: number;
  name: string;
  date: string; // YYYY-MM-DD
  day_of_week: string;
  holiday_type: "National" | "Gazetted" | "Optional" | "Company";
  description?: string;
  public_id?: string;
  region?: string;
  is_optional?: boolean;
}
