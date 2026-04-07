export interface IPagination {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface IPaginationRequest {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: {
    sort: string;
    order: 'asc' | 'desc';
  };
  [key: string]: any;
}
export interface IApiResponse<T = any> {
  data: T;
  message?: string;
  status?: number;
}

export interface IApiError {
  message: string;
  status?: number;
  errors?: Record<string, any>;
}
