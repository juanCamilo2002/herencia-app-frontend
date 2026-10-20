import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ANIMATION_MODULE_TYPE, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import {
  APP_NAVIGATION_ITEMS,
  canAccessNavigationItem,
} from '../../core/navigation/app-navigation';
import { ToastService } from '../../shared/services/toast.service';
import {
  ProductCategory,
  ProductCategoryService,
} from '../product-categories/data-access/product-category.service';
import { Product } from './data-access/product.model';
import { ProductService } from './data-access/product.service';
import { Products } from './products';

@Component({ template: '' })
class EmptyPage {}

const catalogRoutes = routes
  .find((route) => route.children)
  ?.children!.filter((route) => route.path === 'products' || route.path === 'product-categories')!;

describe('Catálogo con pestañas', () => {
  async function setup(permissions: string[], url = '/products') {
    let category: ProductCategory = {
      id: 'category-1',
      name: 'Vinos',
      description: null,
      active: true,
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-20T00:00:00Z',
    };
    const product: Product = {
      id: 'product-1',
      name: 'Producto de prueba',
      categoryId: category.id,
      categoryName: category.name,
      categoryActive: true,
      description: null,
      attributes: [],
      price: 10000,
      stock: 5,
      minimumStock: 1,
      active: true,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
    const getProducts = vi.fn(() =>
      of({
        content: [product],
        totalElements: 60,
        totalPages: 3,
        number: 0,
        size: 20,
      }),
    );
    const getSummary = vi.fn(() =>
      of({
        totalProducts: 60,
        lowStockProducts: 0,
        availableUnits: 5,
        inventoryValue: 50000,
      }),
    );
    const options = vi.fn(() => of([{ ...category }]));
    const list = vi.fn(() => of([{ ...category }]));
    const setActive = vi.fn((_id: string, active: boolean) => {
      category = { ...category, active };
      return of(category);
    });
    const initialize = vi.fn();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...catalogRoutes,
          { path: 'dashboard', component: EmptyPage },
          { path: 'login', component: EmptyPage },
        ]),
        provideLocationMocks(),
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
        {
          provide: AuthSessionService,
          useValue: {
            user: signal({ permissions }),
            initialized: signal(true),
            isBrowser: () => true,
            hasPermission: (permission: string) => permissions.includes(permission),
            initialize,
          },
        },
        { provide: ProductService, useValue: { getProducts, getSummary } },
        { provide: ProductCategoryService, useValue: { options, list, setActive } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(true) }) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create(url);
    const router = TestBed.inject(Router);
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    await settle();
    const clickTab = async (label: string) => {
      const tabs = harness.routeNativeElement!.querySelectorAll<HTMLElement>('[role="tab"]');
      [...tabs].find((tab) => tab.textContent?.trim() === label)!.click();
      await settle();
    };
    return {
      harness,
      router,
      settle,
      clickTab,
      getProducts,
      getSummary,
      options,
      list,
      setActive,
      renameCategory: (name: string) => {
        category = { ...category, name };
      },
    };
  }

  it('admite solo categorías por el guard real y redirige el enlace anterior sin cargar productos', async () => {
    const { harness, router, list, options, getProducts, getSummary } = await setup(
      ['product-categories:read'],
      '/product-categories',
    );
    expect(router.url).toBe('/products?tab=categories');
    expect(harness.routeNativeElement!.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(options).not.toHaveBeenCalled();
    expect(getProducts).not.toHaveBeenCalled();
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('muestra solo productos aunque la URL solicite categorías sin permiso', async () => {
    const { harness, getProducts, list } = await setup(
      ['products:read'],
      '/products?tab=categories',
    );
    expect(harness.routeNativeElement!.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });

  it('rechaza el acceso al catálogo sin ninguno de sus permisos', async () => {
    const { router, getProducts, list } = await setup(['dashboard:read']);
    expect(router.url).toBe('/dashboard');
    expect(getProducts).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('carga cada pestaña al abrirla y conserva filtros, página, orden y métricas al volver', async () => {
    const { harness, router, clickTab, getProducts, getSummary, list, options } = await setup([
      'products:read',
      'product-categories:read',
    ]);
    expect(list).not.toHaveBeenCalled();
    const productsElement = harness.routeDebugElement!.query(By.directive(Products));
    const products = productsElement.componentInstance as Products;
    const form = products['filtersForm'];
    form.setValue({ name: 'Búsqueda pendiente', category: 'category-1' });
    products['pageChanged']({ pageIndex: 1, pageSize: 20, length: 60 });
    products['sortProducts']({ active: 'price', direction: 'desc' });
    products['pageChanged']({ pageIndex: 2, pageSize: 20, length: 60 });
    const requestCount = getProducts.mock.calls.length;
    const metric = productsElement.nativeElement.querySelector('app-metric-card');
    await clickTab('Categorías');
    expect(router.url).toBe('/products?tab=categories');
    expect(list).toHaveBeenCalledTimes(1);
    await clickTab('Productos');
    expect(router.url).toBe('/products');
    const restored = harness.routeDebugElement!.query(By.directive(Products));
    expect(restored.componentInstance).toBe(products);
    expect(form.getRawValue()).toEqual({ name: 'Búsqueda pendiente', category: 'category-1' });
    expect(products['pageIndex']()).toBe(2);
    expect(products['sort']()).toEqual({ active: 'price', direction: 'desc' });
    expect(restored.nativeElement.querySelector('app-metric-card')).toBe(metric);
    expect(getProducts).toHaveBeenCalledTimes(requestCount);
    expect(getSummary).toHaveBeenCalledTimes(1);
    expect(options).toHaveBeenCalledTimes(1);
  });

  it('sincroniza nombres y estado de categorías sin recargar listado ni métricas de productos', async () => {
    const { harness, clickTab, settle, renameCategory, options, getProducts, getSummary } =
      await setup([
        'products:read',
        'product-categories:read',
        'product-categories:update',
        'product-categories:disable',
      ]);
    const products = harness.routeDebugElement!.query(By.directive(Products))
      .componentInstance as Products;
    await clickTab('Categorías');
    renameCategory('Accesorios');
    const clickCategoryButton = async (text: string) => {
      const buttons = harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>(
        'app-product-categories button',
      );
      [...buttons].find((button) => button.textContent?.trim() === text)!.click();
      await settle();
    };
    await clickCategoryButton('Editar');
    expect(products['products']()[0].categoryName).toBe('Accesorios');
    await clickCategoryButton('Desactivar');
    expect(products['products']()[0].categoryActive).toBe(false);
    expect(options).toHaveBeenCalledTimes(3);
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(getSummary).toHaveBeenCalledTimes(1);
  });

  it('mantiene la pestaña sincronizada al avanzar y retroceder en el navegador', async () => {
    const { harness, router, clickTab, settle, getProducts, list } = await setup([
      'products:read',
      'product-categories:read',
    ]);
    const location = TestBed.inject(Location);
    router.setUpLocationChangeListener();
    await clickTab('Categorías');
    await clickTab('Productos');
    const backNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.back();
    await backNavigation;
    await settle();
    expect(router.url).toBe('/products?tab=categories');
    expect(
      harness.routeNativeElement!.querySelector('[role="tab"][aria-selected="true"]')!.textContent,
    ).toContain('Categorías');
    const forwardNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.forward();
    await forwardNavigation;
    await settle();
    expect(router.url).toBe('/products');
    expect(
      harness.routeNativeElement!.querySelector('[role="tab"][aria-selected="true"]')!.textContent,
    ).toContain('Productos');
    expect(getProducts).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('ofrece una sola entrada de navegación accesible con cualquiera de los dos permisos', () => {
    const items = APP_NAVIGATION_ITEMS.filter((item) =>
      ['/products', '/product-categories'].includes(item.route),
    );
    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Productos');
    expect(canAccessNavigationItem(items[0], (permission) => permission === 'products:read')).toBe(
      true,
    );
    expect(
      canAccessNavigationItem(items[0], (permission) => permission === 'product-categories:read'),
    ).toBe(true);
    expect(canAccessNavigationItem(items[0], () => false)).toBe(false);
  });
});
