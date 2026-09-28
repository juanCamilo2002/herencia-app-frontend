import { Component, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import {
  APP_NAVIGATION_ENTRIES,
  AppNavigationEntry,
  AppNavigationGroup,
} from '../../core/navigation/app-navigation';

@Component({
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);

  readonly navigate = output<void>();

  protected readonly user = this.session.user;
  protected readonly openGroups = signal<Set<string>>(new Set());
  protected readonly currentUrl = signal(this.router.url);

  protected readonly visibleEntries = computed(() =>
    APP_NAVIGATION_ENTRIES.reduce<AppNavigationEntry[]>((entries, entry) => {
      if (entry.type === 'item') {
        if (this.session.hasPermission(entry.permission)) {
          entries.push(entry);
        }

        return entries;
      }

      const visibleItems = entry.items.filter((item) => this.session.hasPermission(item.permission));

      if (visibleItems.length > 0) {
        entries.push({
          ...entry,
          items: visibleItems,
        });
      }

      return entries;
    }, [])
  );

  protected readonly activeGroupId = computed(() => {
    const url = this.currentUrl();

    for (const entry of this.visibleEntries()) {
      if (entry.type === 'group' && entry.items.some((item) => this.isActiveRoute(url, item.route))) {
        return entry.id;
      }
    }

    return null;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
      });
  }

  protected isGroup(entry: AppNavigationEntry): entry is AppNavigationGroup {
    return entry.type === 'group';
  }

  protected isGroupOpen(id: string) {
    return this.openGroups().has(id) || this.activeGroupId() === id;
  }


  protected toggleGroup(id: string) {
    this.openGroups.update((groups) => {
      const nextGroups = new Set(groups);

      if (nextGroups.has(id)) {
        nextGroups.delete(id);
      } else {
        nextGroups.add(id);
      }

      return nextGroups;
    });
  }

  protected userInitial(name: string) {
    return name.trim().slice(0, 1).toUpperCase() || 'U';
  }

  protected logout() {
    this.session.logout().subscribe(() => {
      this.router.navigateByUrl('/login');
    });
  }

  private isActiveRoute(currentUrl: string, route: string) {
    return currentUrl === route || currentUrl.startsWith(`${route}/`);
  }
}