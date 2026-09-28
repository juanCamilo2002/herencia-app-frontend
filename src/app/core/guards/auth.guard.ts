import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthSessionService } from '../auth/auth-session.service';

export const authGuard: CanActivateFn = (_, state) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);

  const loginTree = () =>
    router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });

  if (!session.isBrowser()) {
    return true;
  }

  if (session.initialized()) {
    return session.isAuthenticated() ? true : loginTree();
  }

  return session.initialize().pipe(
    map((user) => (user ? true : loginTree())),
  );
};