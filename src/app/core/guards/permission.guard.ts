import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthUser } from '../../features/auth/data-access/auth.model';
import { AuthSessionService } from '../auth/auth-session.service';
import { APP_NAVIGATION_ITEMS, canAccessNavigationItem } from '../navigation/app-navigation';

export const permissionGuard: CanActivateFn = (route, state) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const permission = route.data?.['permission'] as string | undefined;
  const anyPermissions = route.data?.['anyPermissions'] as readonly string[] | undefined;
  const requiredPermissions = anyPermissions?.length
    ? anyPermissions
    : permission
      ? [permission]
      : [];

  const loginTree = () =>
    router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });

  const authorize = (user: AuthUser | null = session.user()) => {
    if (!user) {
      return loginTree();
    }

    if (requiredPermissions.length === 0) {
      return true;
    }

    const permissions = new Set(user.permissions ?? []);

    if (requiredPermissions.some((required) => permissions.has(required))) {
      return true;
    }

    const fallback = APP_NAVIGATION_ITEMS.find((item) =>
      canAccessNavigationItem(item, (required) => permissions.has(required)),
    );

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
