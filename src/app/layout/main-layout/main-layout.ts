import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
    imports: [RouterOutlet, MatSidenavModule, Sidebar, Topbar],
    selector: 'app-main-layout',
    styleUrl: './main-layout.scss',
    templateUrl: './main-layout.html',
})
export class MainLayout {
    private readonly breakpointObserver = inject(BreakpointObserver);

    protected readonly isMobile = signal(false);
    protected readonly mobileSidebarOpened = signal(false);

    protected readonly sidenavMode = computed(() => (this.isMobile() ? 'over' : 'side'));
    protected readonly sidenavOpened = computed(() => !this.isMobile() || this.mobileSidebarOpened());

    constructor() {
        this.breakpointObserver
            .observe('(max-width: 900px)')
            .pipe(takeUntilDestroyed())
            .subscribe((state) => {
                this.isMobile.set(state.matches);

                if (!state.matches) {
                    this.mobileSidebarOpened.set(false);
                }
            });
    }

    protected openMobileSidebar() {
        this.mobileSidebarOpened.set(true);
    }

    protected closeMobileSidebar() {
        if (this.isMobile()) {
            this.mobileSidebarOpened.set(false);
        }
    }
}