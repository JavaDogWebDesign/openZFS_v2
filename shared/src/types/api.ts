export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SessionInfo {
  username: string;
  uid: number;
  gid: number;
  groups: string[];
  isAdmin: boolean;
  loginTime: string;
}
