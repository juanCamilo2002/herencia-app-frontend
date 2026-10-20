import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { ProductCategories } from '../product-categories/product-categories';
import { Products } from './products';

type CatalogTab = { id: 'products' | 'categories'; label: string };

@Component({
  selector: 'app-product-catalog',
  imports: [MatTabsModule, Products, ProductCategories],
  templateUrl: './product-catalog.html',
  styleUrl: './product-catalog.scss',
})
export class ProductCatalog {
  private readonly session = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly selectedIndex = signal(0);
  protected readonly categoryRevision = signal(0);
  protected readonly tabs = computed<CatalogTab[]>(() => {
    const tabs: CatalogTab[] = [];
    if (this.session.hasPermission('products:read'))
      tabs.push({ id: 'products', label: 'Productos' });
    if (this.session.hasPermission('product-categories:read'))
      tabs.push({ id: 'categories', label: 'Categorías' });
    return tabs;
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const index = this.tabs().findIndex((tab) => tab.id === params.get('tab'));
      this.selectedIndex.set(index >= 0 ? index : 0);
    });
  }

  protected selectTab(index: number) {
    const tab = this.tabs()[index];
    if (!tab) return;
    this.selectedIndex.set(index);
    const nextTab = tab.id === 'categories' ? 'categories' : null;
    if (this.route.snapshot.queryParamMap.get('tab') === nextTab) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: nextTab },
      queryParamsHandling: 'merge',
    });
  }

  protected categoryChanged() {
    this.categoryRevision.update((revision) => revision + 1);
  }
}
