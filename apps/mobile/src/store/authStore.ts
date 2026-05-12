export type AuthState = {
  user: unknown;
  isLoggedIn: boolean;
};

export const initialAuthState: AuthState = {
  user: null,
  isLoggedIn: false,
};
