import { CurrencyPipe, DatePipe, JsonPipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { forkJoin, Observable, Subscription } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  Sale,
  SalePayment,
  SaleInstallment,
  SaleHistory,
  PaymentMethod,
} from '../data-access/sales.model';
import { SalesService } from '../data-access/sales.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { PaymentAttachments } from '../../payments/payment-attachments/payment-attachments';
import {
  financialStatusLabel,
  financialStatusTone,
  paymentStatusTone,
  paymentMethods,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentTypeLabel,
  salesErrorMessage,
} from '../data-access/sales.labels';

type Action = 'create' | 'update' | 'confirm' | 'decline' | 'delete' | 'note';

@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTabsModule,
    StatusBadge,
    PaymentAttachments,
  ],
  selector: 'app-sale-detail-dialog',
  styleUrl: './sale-detail-dialog.scss',
  templateUrl: './sale-detail-dialog.html',
})
export class SaleDetailDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SaleDetailDialog>);
  private readonly initialSale = inject<Sale>(MAT_DIALOG_DATA);
  private readonly service = inject(SalesService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly actionEditor = viewChild<ElementRef<HTMLElement>>('actionEditor');
  private readonly paymentInspection = viewChild<ElementRef<HTMLElement>>('paymentInspection');
  private loadRequest?: Subscription;
  private inspectionRequest?: Subscription;
  private changed = false;

  protected readonly sale = signal(this.initialSale);
  protected readonly installments = signal<SaleInstallment[]>([]);
  protected readonly payments = signal<SalePayment[]>([]);
  protected readonly history = signal<SaleHistory[]>([]);
  protected readonly inspectedPayment = signal<SalePayment | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly action = signal<Action | null>(null);
  protected readonly target = signal<SalePayment | null>(null);
  protected readonly paymentPage = signal(0);
  protected readonly historyPage = signal(0);
  protected readonly paymentTotal = signal(0);
  protected readonly historyTotal = signal(0);
  protected readonly selectedTab = signal(0);
  protected readonly pageSize = 10;
  protected readonly methods = paymentMethods;
  protected readonly financialLabel = financialStatusLabel;
  protected readonly financialTone = financialStatusTone;
  protected readonly paymentTone = paymentStatusTone;
  protected readonly methodLabel = paymentMethodLabel;
  protected readonly paymentLabel = paymentStatusLabel;
  protected readonly typeLabel = paymentTypeLabel;
  protected readonly actionTitles: Record<Action, string> = {
    create: 'Registrar pago',
    update: 'Editar pago registrado',
    confirm: 'Confirmar pago',
    decline: 'Rechazar pago',
    delete: 'Eliminar pago',
    note: 'Agregar nota',
  };

  protected readonly paymentForm = this.fb.nonNullable.group({
    amount: [0, [Validators.required, Validators.min(0.01), Validators.max(9999999999.99)]],
    method: ['CASH' as PaymentMethod, Validators.required],
    paymentDateTime: ['', Validators.required],
    notes: ['', Validators.maxLength(1000)],
  });
  protected readonly noteForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    comment: ['', [Validators.required, Validators.maxLength(2000)]],
  });
  protected readonly reason = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(1000),
  ]);

  ngOnInit() {
    this.load();
  }

  protected can(permission: string) {
    return this.session.hasPermission(`sales:${permission}`);
  }

  protected load() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.loadRequest = forkJoin({
      sale: this.service.getSale(this.initialSale.id),
      installments: this.service.getInstallments(this.initialSale.id),
      payments: this.service.getPayments(this.initialSale.id, {
        page: this.paymentPage(),
        size: this.pageSize,
      }),
      history: this.service.getHistory(this.initialSale.id, {
        page: this.historyPage(),
        size: this.pageSize,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.sale.set(result.sale);
          this.installments.set(result.installments);
          this.payments.set(result.payments.content);
          this.paymentTotal.set(result.payments.totalElements);
          this.history.set(result.history.content);
          this.historyTotal.set(result.history.totalElements);
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(salesErrorMessage(error, 'No fue posible cargar el detalle financiero.'));
          this.loading.set(false);
        },
      });
  }

  protected pagePayments(event: PageEvent) {
    this.paymentPage.set(event.pageIndex);
    this.load();
  }

  protected pageHistory(event: PageEvent) {
    this.historyPage.set(event.pageIndex);
    this.load();
  }

  protected openAction(action: Action, payment: SalePayment | null = null) {
    if (this.saving() || this.loading()) {
      return;
    }

    const permissions: Record<Action, string> = {
      create: 'register-payment',
      update: 'update-payment',
      confirm: 'confirm-payment',
      decline: 'decline-payment',
      delete: 'delete-payment',
      note: 'add-note',
    };
    if (!this.can(permissions[action])) {
      return;
    }

    this.error.set(null);
    this.target.set(payment);
    this.reason.reset('');
    this.noteForm.reset({ title: '', comment: '' });
    this.paymentForm.reset({
      amount: payment?.amount ?? this.sale().balanceAmount,
      method: payment?.method ?? 'CASH',
      paymentDateTime: payment?.paymentDateTime ?? this.localNow(),
      notes: payment?.notes ?? '',
    });
    this.action.set(action);
    afterNextRender(
      () => {
        const editor = this.actionEditor()?.nativeElement;
        editor?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        editor
          ?.querySelector<HTMLElement>('input, textarea, button')
          ?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected cancelAction() {
    if (!this.saving()) {
      this.action.set(null);
    }
  }

  protected submitAction() {
    const action = this.action();
    if (!action || this.saving()) {
      return;
    }

    const saleId = this.initialSale.id;
    const payment = this.target();
    let request: Observable<unknown>;
    if (action === 'create' || action === 'update') {
      this.paymentForm.markAllAsTouched();
      const value = this.paymentForm.getRawValue();
      if (
        this.paymentForm.invalid ||
        !Number.isFinite(value.amount) ||
        Math.abs(value.amount * 100 - Math.round(value.amount * 100)) > 0.00001
      ) {
        this.error.set(
          'Completa los datos del pago. El importe debe ser positivo y tener máximo dos decimales.',
        );
        return;
      }
      const body = { ...value, notes: value.notes.trim() || null };
      if (action === 'create') {
        request = this.service.registerPayment(saleId, body);
      } else {
        if (!payment) {
          return;
        }

        request = this.service.updatePayment(saleId, payment.id, body);
      }
    } else if (action === 'note') {
      this.noteForm.markAllAsTouched();
      const value = this.noteForm.getRawValue();
      if (this.noteForm.invalid || !value.title.trim() || !value.comment.trim()) {
        this.error.set('Escribe un título y un comentario válidos.');
        return;
      }
      request = this.service.addNote(saleId, value.title.trim(), value.comment.trim());
    } else {
      if (!payment) {
        return;
      }

      if (action !== 'confirm' && (this.reason.invalid || !this.reason.value.trim())) {
        this.reason.markAsTouched();
        this.error.set('Escribe un motivo (máximo 1000 caracteres).');
        return;
      }
      switch (action) {
        case 'confirm':
          request = this.service.confirmPayment(saleId, payment.id);
          break;
        case 'decline':
          request = this.service.declinePayment(saleId, payment.id, this.reason.value.trim());
          break;
        case 'delete':
          request = this.service.deletePayment(saleId, payment.id, this.reason.value.trim());
          break;
      }
    }

    this.saving.set(true);
    this.dialogRef.disableClose = true;
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.changed = true;
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        this.action.set(null);
        this.inspectedPayment.set(null);
        this.paymentPage.set(0);
        this.historyPage.set(0);
        this.toast.success('Operación registrada correctamente.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.dialogRef.disableClose = false;
        this.error.set(salesErrorMessage(error, 'No fue posible completar la operación.'));
      },
    });
  }

  protected inspectPayment(paymentId: string) {
    if (this.saving() || this.loading()) return;
    this.inspectionRequest?.unsubscribe();
    this.inspectionRequest = this.service
      .getPayment(this.initialSale.id, paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => {
          this.inspectedPayment.set(payment);
          afterNextRender(
            () =>
              this.paymentInspection()?.nativeElement.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
              }),
            { injector: this.injector },
          );
        },
        error: (error) =>
          this.error.set(salesErrorMessage(error, 'No fue posible consultar el pago.')),
      });
  }

  protected selectTab(index: number) {
    if (index === this.selectedTab()) {
      return;
    }

    this.selectedTab.set(index);
    this.inspectionRequest?.unsubscribe();
    this.action.set(null);
    this.target.set(null);
    this.inspectedPayment.set(null);
    this.error.set(null);
  }

  public hasChanges() {
    return this.changed;
  }

  protected attachmentBusy(value: boolean) {
    if (value) this.inspectionRequest?.unsubscribe();
    this.saving.set(value);
    this.dialogRef.disableClose = value;
  }

  protected attachmentChanged() {
    this.changed = true;
    this.historyPage.set(0);
    this.load();
  }

  protected close() {
    if (!this.saving()) {
      this.dialogRef.close(this.changed);
    }
  }

  private localNow() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
