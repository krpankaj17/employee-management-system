/**
 * Announcement and Bulletin Types
 */

export interface Announcement {
  public_id: string;
  title: string;
  content: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  target_audience: "All" | "Engineering" | "Sales" | "Operations" | "Management";
  author_name: string;
  is_pinned: boolean;
  published_at: string;
  expires_at?: string | null;
}
