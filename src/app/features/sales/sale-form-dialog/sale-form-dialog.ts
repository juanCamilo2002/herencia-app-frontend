import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import {
  CreateSaleRequest,
  CreateSaleInstallmentRequest,
  SalePaymentType,
} from '../data-access/sales.model';
import { generateInstallmentSchedule } from '../data-access/installment-schedule';
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
  paymentType: FormControl<SalePaymentType>;
  installmentCount: FormControl<number>;
  firstInstallmentAmount: FormControl<number | null>;
  customSchedule: FormControl<boolean>;
  installments: FormArray<FormGroup<{ dueDate: FormControl<string>; amount: FormControl<number> }>>;
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
    DatePipe,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatSlideToggleModule,
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly loadingData = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly canUseCustomPrice = computed(() =>
    this.session.hasPermission('sales:custom-price'),
  );

  protected readonly form: SaleForm = this.formBuilder.group({
    paymentType: this.formBuilder.nonNullable.control<SalePaymentType>('CASH'),
    installmentCount: this.formBuilder.nonNullable.control(3),
    firstInstallmentAmount: this.formBuilder.control<number | null>(null),
    customSchedule: this.formBuilder.nonNullable.control(false),
    installments: this.formBuilder.array<
      FormGroup<{ dueDate: FormControl<string>; amount: FormControl<number> }>
    >([]),
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

    if (this.form.controls.paymentType.value === 'CREDIT' && !this.form.controls.customerId.value) {
      return 'Selecciona un cliente registrado para vender a crédito.';
    }

    for (let index = 0; index < this.saleItems.length; index++) {
      const error = this.productValidationError(index);
      if (error) {
        return error;
      }
    }

    return this.scheduleValidationError();
  });

  protected productValidationError(index: number) {
    this.formValue();
    const item = this.saleItems.at(index).getRawValue();
    if (!item.productId) {
      return null;
    }

    if (
      this.saleItems.controls.some(
        (other, otherIndex) =>
          otherIndex !== index && other.controls.productId.value === item.productId,
      )
    ) {
      return 'Este producto ya está agregado. Ajusta su cantidad en una sola fila.';
    }
    const product = this.findProduct(item.productId);
    if (!product) {
      return 'El producto seleccionado ya no está disponible.';
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return 'Ingresa una cantidad entera mayor que cero.';
    }
    if (item.quantity > product.stock) {
      return `Stock insuficiente. Disponible: ${product.stock}.`;
    }
    if (this.canUseCustomPrice() && item.useCustomPrice && !this.validMoney(item.customUnitPrice)) {
      return 'El precio personalizado debe ser positivo y tener máximo dos decimales.';
    }
    return null;
  }

  protected itemUnitPrice(index: number) {
    const item = this.saleItems.at(index);
    const product = this.selectedProduct(index);

    if (!product) {
      return 0;
    }

    if (this.canUseCustomPrice() && item.controls.useCustomPrice.value) {
      return item.controls.customUnitPrice.value ?? 0;
    }

    return product.price;
  }

  protected readonly saleTotal = computed(() => {
    this.formValue();

    return this.saleItems.controls.reduce((total, item, index) => {
      const quantity = item.controls.quantity.value;

      return total + this.itemUnitPrice(index) * quantity;
    }, 0);
  });

  protected readonly schedulePreview = computed<CreateSaleInstallmentRequest[]>(() => {
    this.formValue();
    if (this.form.controls.customSchedule.value) {
      return this.form.controls.installments.getRawValue();
    }

    return generateInstallmentSchedule(
      this.form.controls.saleDate.value,
      this.saleTotal(),
      this.form.controls.installmentCount.value,
      this.form.controls.firstInstallmentAmount.value,
    );
  });

  protected readonly scheduleTotal = computed(
    () =>
      this.schedulePreview().reduce(
        (sum, item) => sum + (Number.isFinite(item.amount) ? Math.round(item.amount * 100) : 0),
        0,
      ) / 100,
  );

  protected readonly scheduleDifference = computed(
    () => (Math.round(this.saleTotal() * 100) - Math.round(this.scheduleTotal() * 100)) / 100,
  );

  protected readonly scheduleValidationError = computed(() => {
    this.formValue();
    if (this.form.controls.paymentType.value !== 'CREDIT') {
      return null;
    }

    if (!this.form.controls.customSchedule.value) {
      const count = this.form.controls.installmentCount.value;
      if (!Number.isInteger(count) || count < 1 || count > 1000) {
        return 'El número de cuotas debe ser un entero entre 1 y 1000.';
      }

      const first = this.form.controls.firstInstallmentAmount.value;
      if (first != null && !this.validMoney(first)) {
        return 'Revisa el monto de la primera cuota: positivo y máximo dos decimales.';
      }
      if (this.saleTotal() <= 0) {
        return 'Selecciona los productos para calcular las cuotas.';
      }
      if (
        count === 1 &&
        first != null &&
        Math.round(first * 100) !== Math.round(this.saleTotal() * 100)
      ) {
        return 'Si hay una sola cuota, debe cubrir el total de la venta.';
      }
      if (count > 1 && first != null && first >= this.saleTotal()) {
        return 'La primera cuota debe dejar saldo para las demás.';
      }
    }

    const schedule = this.schedulePreview();
    if (!schedule.length) {
      return 'El total no alcanza para distribuirlo en las cuotas indicadas.';
    }
    if (schedule.some((item) => this.installmentError(item) !== null)) {
      return 'Revisa las fechas y los importes de las cuotas marcadas.';
    }
    if (this.scheduleDifference() !== 0) {
      return 'Ajusta las cuotas para que el total distribuido coincida con la venta.';
    }
    return null;
  });

  protected installmentError(item: CreateSaleInstallmentRequest) {
    const date = new Date(`${item.dueDate}T00:00:00`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) ||
      !Number.isFinite(date.getTime()) ||
      this.toSaleDateTime(date, '00:00').split('T')[0] !== item.dueDate
    ) {
      return 'Selecciona una fecha válida.';
    }
    if (!this.validMoney(item.amount)) {
      return 'Ingresa un importe positivo con máximo dos decimales.';
    }
    return null;
  }

  protected personalizeSchedule() {
    if (this.saving() || this.loadingData()) {
      return;
    }
    const schedule = this.schedulePreview();
    if (!schedule.length) {
      return;
    }

    this.form.controls.installments.clear();
    for (const item of schedule) {
      this.form.controls.installments.push(
        this.formBuilder.nonNullable.group({ dueDate: item.dueDate, amount: item.amount }),
      );
    }
    this.form.controls.customSchedule.setValue(true);
  }

  protected useAutomaticSchedule() {
    if (this.saving()) {
      return;
    }
    this.form.controls.customSchedule.setValue(false);
  }

  protected get saleItems() {
    return this.form.controls.items;
  }

  protected get itemControls() {
    return this.saleItems.controls;
  }

  ngOnInit(): void {
    this.syncConditionalValidators();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncConditionalValidators());
    this.loadData();
  }

  protected close() {
    if (!this.saving()) {
      this.dialogRef.close(false);
    }
  }

  protected addItem() {
    if (this.saving()) {
      return;
    }
    this.saleItems.push(this.createItemForm());
    this.form.updateValueAndValidity();
  }

  protected removeItem(index: number) {
    if (this.saving() || this.saleItems.length === 1) {
      return;
    }

    this.saleItems.removeAt(index);
    this.form.updateValueAndValidity();
  }

  protected submit() {
    if (this.saving() || this.loadingData()) {
      return;
    }
    const validationError = this.saleValidationError();

    if (this.form.invalid || validationError) {
      this.form.markAllAsTouched();
      this.error.set(
        validationError ??
          'Revisa los campos obligatorios o inválidos antes de registrar la venta.',
      );
      afterNextRender(
        () => {
          const invalid = this.element.nativeElement.querySelector<HTMLElement>(
            'input.ng-invalid, mat-select.ng-invalid, [data-validation-error="true"]',
          );
          invalid?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          invalid?.focus({ preventScroll: true });
        },
        { injector: this.injector },
      );
      return;
    }

    const value = this.form.getRawValue();

    const request: CreateSaleRequest = {
      paymentType: value.paymentType,
      customerId: value.customerId,
      customerName: value.customerId ? null : this.toNullableString(value.customerName),
      employeeId: value.employeeId,
      saleDateTime: this.toSaleDateTime(value.saleDate, value.saleTime),
      items: value.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customUnitPrice:
          this.canUseCustomPrice() && item.useCustomPrice ? item.customUnitPrice : null,
      })),
    };

    if (value.paymentType === 'CREDIT') {
      if (value.customSchedule) {
        request.installments = value.installments;
      } else {
        request.installmentCount = value.installmentCount;
        request.firstInstallmentAmount = value.firstInstallmentAmount;
      }
    }

    this.saving.set(true);
    this.dialogRef.disableClose = true;
    this.form.disable({ emitEvent: false });
    this.error.set(null);

    this.salesService
      .createSale(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.disableClose = false;
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveSaleError(error);
          this.error.set(message);
          this.toast.error(message);
          this.saving.set(false);
          this.dialogRef.disableClose = false;
          this.form.enable({ emitEvent: false });
          this.syncConditionalValidators();
        },
      });
  }

  protected hasError(
    controlName: 'customerId' | 'customerName' | 'employeeId' | 'saleDate' | 'saleTime',
    errorName: string,
  ) {
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
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
      customUnitPrice: this.formBuilder.control<number | null>(null),
    });
  }

  private findProduct(productId: string) {
    return this.products().find((product) => product.id === productId) ?? null;
  }

  private validMoney(value: number | null) {
    return (
      value != null &&
      Number.isFinite(value) &&
      value > 0 &&
      value <= 9999999999.99 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 0.00001
    );
  }

  private syncConditionalValidators() {
    const credit = this.form.controls.paymentType.value === 'CREDIT';
    this.form.controls.customerId.setValidators(credit ? [Validators.required] : []);
    this.form.controls.customerId.updateValueAndValidity({ emitEvent: false });
    const manualName = !credit && !this.form.controls.customerId.value;
    this.form.controls.customerName.setValidators(manualName ? [Validators.maxLength(160)] : []);
    this.form.controls.customerName.updateValueAndValidity({ emitEvent: false });
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

    return typeof message === 'string' ? message : 'No fue posible registrar la venta.';
  }

  private toNullableString(value: string) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private currentTimeOption() {
    const now = new Date();

    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
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
