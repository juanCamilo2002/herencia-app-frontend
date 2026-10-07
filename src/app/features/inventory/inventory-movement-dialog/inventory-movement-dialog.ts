import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ToastService } from '../../../shared/services/toast.service';
import { Product } from '../../products/data-access/product.model';
import { ProductService } from '../../products/data-access/product.service';
import { CreateStockMovementRequest, StockMovementType } from '../data-access/inventory.model';
import { InventoryService } from '../data-access/inventory.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';

@Component({
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter()],
  selector: 'app-inventory-movement-dialog',
  styleUrl: './inventory-movement-dialog.scss',
  templateUrl: './inventory-movement-dialog.html',
})
export class InventoryMovementDialog implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly productService = inject(ProductService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<InventoryMovementDialog>);

  protected readonly products = signal<Product[]>([]);
  protected readonly loadingProducts = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    productId: ['', [Validators.required]],
    type: ['INBOUND' as StockMovementType, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0)]],
    movementDate: this.formBuilder.control<Date | null>(new Date(), [Validators.required]),
    movementTime: this.formBuilder.nonNullable.control(this.currentTimeOption(), [Validators.required]),
    reason: ['', [Validators.maxLength(255)]],
  });


  protected readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value
  });

  protected readonly selectedProductId = toSignal(this.form.controls.productId.valueChanges, {
    initialValue: this.form.controls.productId.value
  });

  protected readonly selectedQuantity = toSignal(this.form.controls.quantity.valueChanges, {
    initialValue: this.form.controls.quantity.value,
  });

  protected readonly selectedProduct = computed(() =>
    this.products().find((product) => product.id === this.selectedProductId()) ?? null
  );

  protected readonly selectedReason = toSignal(this.form.controls.reason.valueChanges, {
    initialValue: this.form.controls.reason.value,
  });

  protected readonly movementValidationError = computed(() => {
    const type = this.selectedType();
    const product = this.selectedProduct();
    const quantity = this.selectedQuantity();

    if (quantity == null) {
      return null;
    }

    if ((type === 'INBOUND' || type === 'OUTBOUND') && quantity <= 0) {
      return 'Para entradas y salidas la cantidad debe ser mayor a 0.'
    }

    if (type === 'ADJUSTMENT' && quantity < 0) {
      return 'El stock final no puede ser negativo'
    }

    if ((type === 'OUTBOUND' || type == 'LOSS') && product && quantity > product.stock) {
      return `Stock insuficiente. Disponible: ${product.stock}`;
    }

    if (type === 'LOSS' && !this.selectedReason().trim()) {
      return 'El motivo es obligatorio para registrar una merma o pérdida.';
    }

    return null;
  });

  protected readonly projectedStock = computed(() => {
    const type = this.selectedType();
    const product = this.selectedProduct();
    const quantity = this.selectedQuantity();

    if (!product || quantity == null || quantity < 0) {
      return null;
    }

    switch (type) {
      case 'INBOUND':
        return product.stock + quantity;
      case 'OUTBOUND':
      case 'LOSS':
        return product.stock - quantity;
      case 'ADJUSTMENT':
        return quantity;
    }
  });

  ngOnInit(): void {
    this.loadProducts();
  }

  protected close() {
    this.dialogRef.close(false);
  }

  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const validationError = this.movementValidationError();

    if (validationError) {
      this.form.controls.quantity.markAllAsTouched();
      this.error.set(validationError);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();

    const request: CreateStockMovementRequest = {
      productId: value.productId,
      type: value.type,
      quantity: value.quantity,
      movementDateTime: this.toMovementDateTime(value.movementDate, value.movementTime),
      reason: this.toNullableString(value.reason),
    };

    this.inventoryService.createMovement(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveMovementError(error);
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);

      },
    });
  }

  protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected quantityLabel() {
    return this.selectedType() === 'ADJUSTMENT' ? 'Stock final' : 'Cantidad';
  }

  protected quantityHint() {
    switch (this.selectedType()) {
      case 'INBOUND':
        return 'Unidades que ingresan al inventario.';
      case 'OUTBOUND':
        return 'Unidades que salen del inventario.';
      case 'ADJUSTMENT':
        return 'Stock final que debe quedar para el producto.';
      case 'LOSS':
        return 'Unidades perdidas, dañadas o no utilizables.';
    }
  }

  private loadProducts() {
    this.loadingProducts.set(true);

    this.productService.getProductOptions().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loadingProducts.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar los productos.');
        this.loadingProducts.set(false);
      },
    });
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private resolveMovementError(error: unknown) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    switch (message) {
      case 'Insufficient stock':
        return 'No hay stock suficiente para registrar la salida.';
      case 'Quantity must be greater than zero':
        return 'La cantidad debe ser mayor a 0.';
      case 'Product is inactive':
        return 'El producto seleccionado está inactivo.';
      case 'Product not found':
        return 'El producto seleccionado no existe.';
      default:
        return 'No fue posible registrar el movimiento.';
    }
  }

  private currentTimeOption() {
    const now = new Date();

    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  private toMovementDateTime(date: Date | null, time: string) {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${time}`;
  }
}