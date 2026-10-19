import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Supplier, SupplierRequest } from './supplier.model';
import { SupplierService } from './supplier.service';

describe('Acceso a datos de proveedores', () => {
  let service: SupplierService;
  let http: HttpTestingController;

  const supplier: Supplier = {
    id: 'supplier-1',
    name: 'Distribuidora Central',
    document: null,
    phone: null,
    email: null,
    address: null,
    active: true,
    createdAt: '2026-10-18T09:00:00',
    updatedAt: '2026-10-18T09:00:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SupplierService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('consulta activos por defecto y omite búsquedas vacías', () => {
    service.getSuppliers({ page: 0, size: 20, sort: 'name,asc' }, { name: '   ' }).subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/suppliers');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.get('sort')).toBe('name,asc');
    expect(request.request.params.get('includeInactive')).toBe('false');
    expect(request.request.params.has('name')).toBe(false);

    request.flush({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    });
  });

  it('envía la búsqueda normalizada y permite incluir inactivos', () => {
    service
      .getSuppliers(
        { page: 1, size: 10 },
        {
          name: '  Proveedor 100%_!  ',
          includeInactive: true,
        },
      )
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/suppliers');

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('10');
    expect(request.request.params.get('name')).toBe('Proveedor 100%_!');
    expect(request.request.params.get('includeInactive')).toBe('true');

    request.flush({
      content: [],
      page: 1,
      size: 10,
      totalElements: 0,
      totalPages: 0,
      first: false,
      last: true,
    });
  });

  it('conserva campos opcionales nulos al crear y editar', () => {
    const body: SupplierRequest = {
      name: 'Distribuidora Central',
      document: null,
      phone: null,
      email: null,
      address: null,
    };

    service.createSupplier(body).subscribe();

    const createRequest = http.expectOne('/suppliers');

    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(body);
    expect(createRequest.request.body).not.toHaveProperty('active');

    createRequest.flush(supplier);

    service.updateSupplier(supplier.id, body).subscribe();

    const updateRequest = http.expectOne(`/suppliers/${supplier.id}`);

    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(body);
    expect(updateRequest.request.body).not.toHaveProperty('active');

    updateRequest.flush(supplier);
  });

  it.each([false, true])('envía explícitamente active=%s al cambiar el estado', (active) => {
    service.setActive(supplier.id, active).subscribe();

    const request = http.expectOne(`/suppliers/${supplier.id}/active`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ active });

    request.flush({
      ...supplier,
      active,
    });
  });

  it('consulta las opciones mediante su endpoint específico', () => {
    const options = [
      {
        id: supplier.id,
        name: supplier.name,
        document: supplier.document,
      },
    ];

    let result: unknown;

    service.getSupplierOptions().subscribe((response) => {
      result = response;
    });

    const request = http.expectOne('/suppliers/options');

    expect(request.request.method).toBe('GET');

    request.flush(options);

    expect(result).toEqual(options);
  });

  it('consulta un proveedor individual, incluido su estado', () => {
    let result: Supplier | undefined;

    service.getSupplier(supplier.id).subscribe((response) => {
      result = response;
    });

    const request = http.expectOne(`/suppliers/${supplier.id}`);

    expect(request.request.method).toBe('GET');

    request.flush({
      ...supplier,
      active: false,
    });

    expect(result?.id).toBe(supplier.id);
    expect(result?.active).toBe(false);
  });
});
