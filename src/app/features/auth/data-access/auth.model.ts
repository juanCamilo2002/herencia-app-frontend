export type AuthRole = {
    id: string;
    code: string;
    name: string;
};

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: AuthRole;
    permissions: string[]
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type AuthResponse = {
    user: AuthUser;
}

export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  password: string;
};