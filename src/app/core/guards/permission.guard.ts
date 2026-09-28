import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthUser } from '../../features/auth/data-access/auth.model';
import { AuthSessionService } from '../auth/auth-session.service';
import { APP_NAVIGATION_ITEMS } from '../navigation/app-navigation';



export const permissionGuard: CanActivateFn = (route, state) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const permission = route.data?.['permission'] as string | undefined;

  const loginTree = () =>
    router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });

  const authorize = (user: AuthUser | null = session.user()) => {
    if (!user) {
      return loginTree();
    }

    if (!permission) {
      return true;
    }

    const permissions = new Set(user.permissions ?? []);

    if (permissions.has(permission)) {
      return true;
    }

    const fallback = APP_NAVIGATION_ITEMS.find((item) => permissions.has(item.permission));

    return fallback ? router.createUrlTree([fallback.route]) : loginTree();
  };

  if (!session.isBrowser()) {
    return true;
  }

  if (session.initialized()) {
    return authorize();
  }

  return session.initialize().pipe(map((user) => authorize(user)));
};