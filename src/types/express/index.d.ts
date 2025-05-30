// Type augmentation for Express to support Parallax Analytics Last Frontier authentication context.

import { LastFrontierJwtPayload } from '../../auth/authService';

declare global {
  namespace Express {
    interface Request {
      user?: LastFrontierJwtPayload;
    }
  }
}

export {};