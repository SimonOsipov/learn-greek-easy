import { api } from './api';

interface WaitlistSubscribeResponse {
  message: string;
}

interface WaitlistConfirmResponse {
  message: string;
}

export const waitlistAPI = {
  subscribe: async (email: string): Promise<WaitlistSubscribeResponse> => {
    return api.post<WaitlistSubscribeResponse>(
      '/api/v1/waitlist/subscribe',
      { email },
      { skipAuth: true }
    );
  },

  confirm: async (token: string): Promise<WaitlistConfirmResponse> => {
    return api.post<WaitlistConfirmResponse>(
      '/api/v1/waitlist/confirm',
      { token },
      { skipAuth: true }
    );
  },
};
