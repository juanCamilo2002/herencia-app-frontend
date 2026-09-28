import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { forkJoin } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';
import { Customer } from '../../customers/data-access/customer.model';
import { CustomerService } from '../../customers/data-access/customer.service';
import { Product } from '../../products/data-access/product.model';
import { ProductService } from '../../products/data-access/product.service';
import { CreateSaleRequest } from '../data-access/sales.model';
import { SalesService } from '../data-access/sales.service';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { EmployeeService } from '../../employees/data-access/employee.service';
import { Employee } from '../../employees/data-access/employee.model';

type SaleItemControlName = 'productId' | 'quantity' | 'useCustomPrice' | 'customUnitPrice';


type SaleItemForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
  useCustomPrice: FormControl<boolean>;
  customUnitPrice: FormControl<number | null>;
}>;

type SaleForm = FormGroup<{
  customerId: FormControl<string | null>;
  customerName: FormControl<string>;
  employeeId: FormControl<string>;
  saleDate: FormControl<Date | null>;
  saleTime: FormControl<string>;
  items: FormArray<SaleItemForm>;
}>;

@Component({
  imports: [
    CurrencyPipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatSlideToggleModule
  ],
  selector: 'app-sale-form-dialog',
  styleUrl: './sale-form-dialog.scss',
  templateUrl: './sale-form-dialog.html',
  providers: [provideNativeDateAdapter()],
})
export class SaleFormDialog implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly salesService = inject(SalesService);
  private readonly productService = inject(ProductService);
  private readonly employeeService = inject(EmployeeService);
  private readonly customerService = inject(CustomerService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<SaleFormDialog>);
  private readonly session = inject(AuthSessionService);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly loadingData = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canUseCustomPrice = computed(() =>
    this.session.hasPermission('sales:custom-price')
  );

  protected readonly timeOptions = this.createTimeOptions();

  protected readonly form: SaleForm = this.formBuilder.group({
    customerId: this.formBuilder.control<string | null>(null),
    customerName: this.formBuilder.nonNullable.control('', [Validators.maxLength(160)]),
    employeeId: this.formBuilder.nonNullable.control('', [Validators.required]),
    saleDate: this.formBuilder.control<Date | null>(new Date(), [Validators.required]),
    saleTime: this.formBuilder.nonNullable.control(this.currentTimeOption(), [Validators.required]),
    items: this.formBuilder.array<SaleItemForm>([this.createItemForm()]),
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly saleValidationError = computed(() => {
    this.formValue();

    const productIds = new Set<string>();

    for (const item of this.saleItems.controls) {
      const productId = item.controls.productId.value;
      const quantity = item.controls.quantity.value;

      if (!productId) {
        continue;
      }

      if (productIds.has(productId)) {
        return 'No puedes repetir productos en la misma venta.';
      }

      productIds.add(productId);

      const product = this.findProduct(productId);

      if (!product) {
        continue;
      }

      if (product.stock <= 0) {
        return `"${product.name}" no tiene stock disponible.`;
      }

      if (quantity > product.stock) {
        return `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.`;
      }

      if (this.canUseCustomPrice() && item.controls.useCustomPrice.value) {
        const customUnitPrice = item.controls.customUnitPrice.value;

        if (customUnitPrice == null || customUnitPrice <= 0) {
          return `Ingresa un precio personalizado válido para "${product.name}".`;
        }
      }
    }

    return null;
  });

  protected itemUnitPrice(index: number) {
    const item = this.saleItems.at(index);
    const product = this.selectedProduct(index);

    if (!product) {
      return 0;
    }

    if (this.canUseCustomPrice() && item.controls.useCustomPrice.value) {
      return item.controls.customUnitPrice.value ?? 0;
    }

    return product.price
  }

  protected readonly saleTotal = computed(() => {
    this.formValue();

    return this.saleItems.controls.reduce((total, item, index) => {
      const quantity = item.controls.quantity.value;

      return total + this.itemUnitPrice(index) * quantity;
    }, 0);
  });

  protected get saleItems() {
    return this.form.controls.items;
  }

  protected get itemControls() {
    return this.saleItems.controls;
  }

  ngOnInit(): void {
    this.loadData();
  }

  protected close() {
    this.dialogRef.close(false);
  }

  protected addItem() {
    this.saleItems.push(this.createItemForm());
    this.form.updateValueAndValidity();
  }

  protected removeItem(index: number) {
    if (this.saleItems.length === 1) {
      return;
    }

    this.saleItems.removeAt(index);
    this.form.updateValueAndValidity();
  }

  protected submit() {
    const validationError = this.saleValidationError();

    if (this.form.invalid || validationError) {
      this.form.markAllAsTouched();
      this.error.set(validationError);
      return;
    }

    const value = this.form.getRawValue();

    const request: CreateSaleRequest = {
      customerId: value.customerId,
      customerName: value.customerId ? null : this.toNullableString(value.customerName),
      employeeId: value.employeeId,
      saleDateTime: this.toSaleDateTime(value.saleDate, value.saleTime),
      items: value.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customUnitPrice: this.canUseCustomPrice() && item.useCustomPrice
          ? item.customUnitPrice
          : null,
      })),
    };

    this.saving.set(true);
    this.error.set(null);

    this.salesService.createSale(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = this.resolveSaleError(error);
        this.error.set(message);
        this.toast.error(message);
        this.saving.set(false);
      },
    });
  }

  protected hasError(controlName: 'customerName' | 'employeeId' | 'saleDate' | 'saleTime', errorName: string) {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected hasItemError(index: number, controlName: SaleItemControlName, errorName: string) {
    const control = this.saleItems.at(index).controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  protected selectedProduct(index: number) {
    this.formValue();
    return this.findProduct(this.saleItems.at(index).controls.productId.value);
  }

  protected itemSubtotal(index: number) {
    this.formValue();

    const quantity = this.saleItems.at(index).controls.quantity.value;

    return this.itemUnitPrice(index) * quantity;
  }



  private loadData() {
    this.loadingData.set(true);

    forkJoin({
      customers: this.customerService.getCustomerOptions(),
      employees: this.employeeService.getEmployeeOptions(),
      products: this.productService.getProductOptions(),
    }).subscribe({
      next: ({ customers, employees, products }) => {
        this.customers.set(customers);
        this.employees.set(employees);
        this.products.set(products);
        this.loadingData.set(false);
      },
      error: () => {
        this.error.set('No fue posible cargar clientes, empleados y productos.');
        this.loadingData.set(false);
      },
    });
  }

  private createItemForm(): SaleItemForm {
    return this.formBuilder.group({
      productId: this.formBuilder.nonNullable.control('', [Validators.required]),
      quantity: this.formBuilder.nonNullable.control(1, [Validators.required, Validators.min(1)]),
      useCustomPrice: this.formBuilder.nonNullable.control(false),
      customUnitPrice: this.formBuilder.control<number | null>(null, [Validators.min(0.01)]),
    });
  }

  private findProduct(productId: string) {
    return this.products().find((product) => product.id === productId) ?? null;
  }

  private resolveSaleError(error: unknown) {
    const message = error instanceof HttpErrorResponse ? error.error?.message : null;

    if (message === 'Customer not found') {
      return 'Cliente no encontrado.';
    }

    if (message === 'Product not found') {
      return 'Producto no encontrado.';
    }

    if (message?.startsWith('Product is inactive')) {
      return 'Uno de los productos seleccionados está inactivo.';
    }

    if (message?.startsWith('Insufficient stock for product')) {
      return 'No hay stock suficiente para uno de los productos.';
    }

    if (message === 'Duplicated product in sale') {
      return 'No puedes repetir productos en la misma venta.';
    }

    if (message === 'Custom price not allowed') {
      return 'No tienes permiso para usar precios personalizados.';
    }

    if (message === 'Invalid unit price') {
      return 'Uno de los precios personalizados no es válido.';
    }

    if (message === 'Employee not found') {
      return 'Empleado no encontrado o inactivo.';
    }

    return 'No fue posible registrar la venta.';
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private currentTimeOption() {
    const now = new Date();
    const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;

    return `${now.getHours().toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
  }

  private createTimeOptions() {
    const options: string[] = [];

    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 15, 30, 45]) {
        options.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }

    return options;
  }

  private toSaleDateTime(date: Date | null, time: string) {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${time}`;
  }
}
