export interface IAuth {
  id: number;
  full_name?: string;
  name?: string;
  email?: string;
  roles?: string[];
  role?: string;
  permissions?: string[];
  phone_number? : string;
  is_active?: boolean;
}

export interface IAuthRequest {
 email: string;
  password: string;
  full_name?: string; 
  phone_code?: string; 
  phone_number?: string;
}
