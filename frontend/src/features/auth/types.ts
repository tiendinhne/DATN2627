export type AuthMode = "login" | "register" | "forgot-password";

export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}
