import { PurchaseMoneyPipe } from '../data-access/purchase-money.pipe';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { SupplierOption } from '../../suppliers/data-access/supplier.model';
import { PurchasesService, purchaseError } from '../data-access/purchases.service';
import {
  Purchase,
  PurchaseCatalogOption,
  PurchaseRequest,
  localPurchaseTime,
  purchaseLineTotal,
  purchaseTotal,
} from '../data-access/purchases.model';
import { supplyUnitLabel } from '../../supplies/data-access/supply-labels';

@Component({
  selector: 'app-purchase-form-dialog',
  imports: [
    PurchaseMoneyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  templateUrl: './purchase-form-dialog.html',
  styleUrl: './purchase-form-dialog.scss',
})
export class PurchaseFormDialog {
  private readonly ref = inject(MatDialogRef<PurchaseFormDialog>);
  private readonly service = inject(PurchasesService);
  private readonly supplierService = inject(SupplierService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly purchase = inject<Purchase | null>(MAT_DIALOG_DATA);
  private readonly requestId = this.purchase?.requestId ?? crypto.randomUUID();
  private submitted: PurchaseRequest | null = null;
  private uncertain = false;
  private readonly initialDisableClose = this.ref.disableClose ?? false;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly options = signal<PurchaseCatalogOption[]>([]);
  protected readonly suppliers = signal<SupplierOption[]>([]);
  protected readonly unitLabel = supplyUnitLabel;
  protected readonly lineTotal = purchaseLineTotal;
  protected readonly items = this.fb.array(
    (this.purchase?.items ?? []).map((item) =>
      this.line(
        `${item.productId ? 'PRODUCT' : 'SUPPLY'}:${item.productId ?? item.supplyId}`,
        String(item.quantity),
        String(item.unitCost),
      ),
    ),
  );
  protected readonly form = this.fb.nonNullable.group({
    supplierId: [this.purchase?.supplierId ?? '', Validators.required],
    purchaseDateTime: [this.purchase?.purchaseDateTime ?? localPurchaseTime(), Validators.required],
    reference: [this.purchase?.reference ?? '', Validators.maxLength(120)],
    notes: [this.purchase?.notes ?? '', Validators.maxLength(1000)],
    items: this.items,
  });

  constructor() {
    if (!this.items.length) this.addLine();
    this.load();
  }
  protected load() {
    if (this.saving()) return;
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      suppliers: this.supplierService.getSupplierOptions(),
      catalog: this.service.catalog(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          const suppliers = [...data.suppliers];
          if (this.purchase && !suppliers.some((item) => item.id === this.purchase!.supplierId)) {
            suppliers.push({
              id: this.purchase.supplierId,
              name: `${this.purchase.supplierName} (asignación actual)`,
              document: null,
            });
          }
          const catalog = [...data.catalog];
          for (const item of this.purchase?.items ?? []) {
            const type = item.productId ? 'PRODUCT' : 'SUPPLY';
            const id = item.productId ?? item.supplyId!;
            if (!catalog.some((option) => option.id === id && option.type === type)) {
              catalog.push({
                id,
                type,
                name: `${item.itemName} (revisar disponibilidad)`,
                unit: item.itemUnit,
                stock: 0,
                averageUnitCost: null,
                suggestedInitialCost: null,
              });
            }
          }
          this.suppliers.set(suppliers);
          this.options.set(catalog);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(purchaseError(error, 'No fue posible cargar proveedores y artículos.'));
        },
      });
  }
  protected addLine() {
    if (!this.saving() && this.items.length < 100) this.items.push(this.line());
  }
  protected removeLine(index: number) {
    if (!this.saving()) this.items.removeAt(index);
  }
  protected option(target: string) {
    return this.options().find((option) => `${option.type}:${option.id}` === target);
  }
  protected optionUnit(target: string) {
    const option = this.option(target);
    return option ? this.unitLabel(option.unit) : 'Selecciona un artículo';
  }
  protected total() {
    return purchaseTotal(this.items.getRawValue());
  }
  protected close() {
    if (!this.saving()) this.ref.close(false);
  }

  protected submit() {
    if (this.saving() || this.loading()) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.items.length || !this.options().length) {
      this.error.set('Completa el proveedor, la fecha y al menos un artículo.');
      return;
    }
    const seen = new Set<string>();
    for (const item of value.items) {
      const option = this.option(item.target);
      if (
        !option ||
        seen.has(item.target) ||
        Number(item.quantity) <= 0 ||
        Number(item.unitCost) > 9999999999.99 ||
        Number(item.quantity) > (option.type === 'PRODUCT' ? 2147483647 : 999999999.999) ||
        (option.type === 'PRODUCT' && !Number.isInteger(Number(item.quantity)))
      ) {
        this.error.set(
          'Revisa artículos repetidos, cantidades positivas y enteras para productos, y costos no negativos.',
        );
        return;
      }
      seen.add(item.target);
    }
    const request: PurchaseRequest = {
      requestId: this.requestId,
      version: this.purchase?.version ?? 0,
      supplierId: value.supplierId,
      purchaseDateTime: value.purchaseDateTime,
      reference: value.reference.trim() || null,
      notes: value.notes.trim() || null,
      items: value.items.map((item) => {
        const option = this.option(item.target)!;
        return {
          productId: option.type === 'PRODUCT' ? option.id : null,
          supplyId: option.type === 'SUPPLY' ? option.id : null,
          quantity: item.quantity,
          unitCost: item.unitCost,
        };
      }),
    };
    if (
      !this.purchase &&
      this.uncertain &&
      this.submitted &&
      JSON.stringify(this.submitted) !== JSON.stringify(request)
    ) {
      this.error.set(
        'El resultado del envío anterior no se pudo confirmar. Reintenta con los mismos datos o actualiza el listado antes de registrar otra compra.',
      );
      return;
    }
    this.submitted = request;
    this.saving.set(true);
    this.ref.disableClose = true;
    this.error.set(null);
    this.form.disable();
    const save = this.purchase
      ? this.service.update(this.purchase.id, request)
      : this.service.create(request);
    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.ref.close(true),
      error: (error) => {
        this.uncertain = true;
        this.saving.set(false);
        this.ref.disableClose = this.initialDisableClose;
        this.form.enable();
        this.error.set(
          purchaseError(error, 'No fue posible guardar la compra. Los datos se conservan.'),
        );
      },
    });
  }
  private line(target = '', quantity = '1', unitCost = '0') {
    return this.fb.nonNullable.group({
      target: [target, Validators.required],
      quantity: [quantity, [Validators.required, Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
      unitCost: [unitCost, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    });
  }
}
