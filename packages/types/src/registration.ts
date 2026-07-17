export interface PendingRegistration {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_id: string;
  tenant_name?: string;
  brand?: string;
  created_at: string;
}

export interface PendingListResponse {
  items: PendingRegistration[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApproveRejectRequest {
  reason?: string;
}

export interface ApprovalActionResponse {
  success: boolean;
  message: string;
  user_id?: string;
  status?: string;
}
