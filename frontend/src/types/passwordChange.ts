import type { ChangeMyPasswordPayload } from "./account";

export type PasswordChangeRequestStatus =
  | "OTP Pending"
  | "Completed"
  | "Pending HR Approval"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Expired";

export interface PasswordChangeOtpChallenge {
  requestId: string;
  maskedEmail: string;
  expiresAtUtc: string;
  message: string;
}

export interface VerifyPasswordChangeOtpPayload {
  requestId: string;
  otp: string;
}

export interface PasswordChangeRequestRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  department: string;
  designation: string;
  status: PasswordChangeRequestStatus;
  requestedAtUtc: string;
  updatedAtUtc: string;
  otpExpiresAtUtc: string | null;
  otpVerifiedAtUtc: string | null;
  decisionAtUtc: string | null;
  decisionNote: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
}

export type RequestPasswordChangePayload = ChangeMyPasswordPayload;
