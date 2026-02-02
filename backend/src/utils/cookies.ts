import { Request } from 'express';

export const getCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  const cookies = header.split(';');
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return undefined;
};
