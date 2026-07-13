import { ApiClient } from './api';

const TOKEN_KEY = 'ff-token';

export const session = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
  api: () => new ApiClient(localStorage.getItem(TOKEN_KEY)),
};
