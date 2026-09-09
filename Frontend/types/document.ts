/**
 * Document Management Types
 * 
 * 🎓 LEARNING NOTE:
 * Matches backend `document_schema.py` and `DocumentController.java`.
 * Valid document_types in backend:
 * "aadhaar" | "pan" | "passport" | "resume" | "offer_letter" | "experience_letter" | "other"
 */

export type DocumentType =
  | "aadhaar"
  | "pan"
  | "passport"
  | "resume"
  | "offer_letter"
  | "experience_letter"
  | "other";

export type DocumentVerificationStatus = "Pending_Verification" | "Verified" | "Rejected";

export interface DocumentRecord {
  public_id: string;
  employee_public_id: string;
  employee_name?: string;
  document_name: string;
  document_type: DocumentType;
  document_url: string;
  file_size_bytes?: number;
  mime_type?: string;
  status?: DocumentVerificationStatus;
  verification_notes?: string;
  verified_by_user_id?: string;
  created_at: string;
}

export interface DocumentUploadPayload {
  employee_public_id: string;
  document_type: DocumentType;
  document_name: string;
  file?: File;
}

export interface DocumentVerifyPayload {
  status: "Verified" | "Rejected";
  verification_notes?: string;
}
