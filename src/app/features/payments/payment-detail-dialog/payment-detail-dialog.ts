import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable, Subscription } from 'rxjs';

import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { ToastService } from '../../../shared/services/toast.service';
import {
  paymentMethods,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  salesErrorMessage,
} from '../../sales/data-access/sales.labels';
import { PaymentMethod, SalePayment } from '../../sales/data-access/sales.model';
import { SalesService } from '../../sales/data-access/sales.service';
import { PaymentsService } from '../data-access/payments.service';
import { PaymentAttachments } from '../payment-attachments/payment-attachments';

type PaymentAction = 'update' | 'confirm' | 'decline' | 'delete';

export type PaymentDetailDialogData = {
  paymentId: string;
  customerName?: string | null;
};

@Component({
  selector: 'app-payment-detail-dialog',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    StatusBadge,
    PaymentAttachments,
  ],
  templateUrl: './payment-detail-dialog.html',
  styleUrl: './payment-detail-dialog.scss',
})
export class PaymentDetailDialog implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PaymentDetailDialog>);

  private readonly paymentsService = inject(PaymentsService);
  private readonly salesService = inject(SalesService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly editor = viewChild<ElementRef<HTMLElement>>('actionEditor');

  private readonly initialDisableClose = this.dialogRef.disableClose;

  private loadRequest?: Subscription;
  private changed = false;

  protected readonly data = inject<PaymentDetailDialogData>(MAT_DIALOG_DATA);

  protected readonly payment = signal<SalePayment | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly action = signal<PaymentAction | null>(null);

  protected readonly methods = paymentMethods;
  protected readonly methodLabel = paymentMethodLabel;
  protected readonly statusLabel = paymentStatusLabel;
  protected readonly statusTone = paymentStatusTone;

  protected readonly actionTitles: Record<PaymentAction, string> = {
    update: 'Editar pago',
    confirm: 'Confirmar pago',
    decline: 'Rechazar pago',
    delete: 'Eliminar pago',
  };

  private readonly actionPermissions: Record<PaymentAction, string> = {
    update: 'sales:update-payment',
    confirm: 'sales:confirm-payment',
    decline: 'sales:decline-payment',
    delete: 'sales:delete-payment',
  };

  protected readonly paymentForm = this.formBuilder.nonNullable.group({
    amount: [
      0,
      [
        Validators.required,
        Validators.min(0.01),
        Validators.max(9999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    ],
    method: ['CASH' as PaymentMethod, Validators.required],
    paymentDateTime: ['', Validators.required],
    notes: ['', Validators.maxLength(1000)],
  });

  protected readonly reason = this.formBuilder.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(1000),
    Validators.pattern(/\S/),
  ]);

  ngOnInit(): void {
    this.load();
  }

  protected load() {
    if (this.saving()) {
      return;
    }

    this.loadRequest?.unsubscribe();

    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.action.set(null);

    this.loadRequest = this.paymentsService
      .getPayment(this.data.paymentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => {
          this.payment.set(payment);
          this.loading.set(false);
        },
        error: (error) => {
          this.loadError.set(salesErrorMessage(error, 'No fue posible cargar el pago.'));
          this.loading.set(false);
        },
      });
  }

  protected canAct(action: PaymentAction) {
    const payment = this.payment();

    if (!payment || payment.deletedAt) {
      return false;
    }

    if (!this.session.hasPermission(this.actionPermissions[action])) {
      return false;
    }

    return action === 'delete' || payment.status === 'REGISTERED';
  }

  protected openAction(action: PaymentAction) {
    if (this.loading() || this.saving() || this.loadError() || !this.canAct(action)) {
      return;
    }

    const payment = this.payment();

    if (!payment) {
      return;
    }

    this.actionError.set(null);
    this.reason.reset('');

    this.paymentForm.reset({
      amount: payment.amount,
      method: payment.method,
      paymentDateTime: payment.paymentDateTime,
      notes: payment.notes ?? '',
    });

    this.action.set(action);
    this.focusEditor();
  }

  protected cancelAction() {
    if (this.saving()) {
      return;
    }

    this.action.set(null);
    this.actionError.set(null);
  }

  protected submitAction() {
    const action = this.action();
    const payment = this.payment();

    if (!action || !payment || this.loading() || this.saving() || this.loadError()) {
      return;
    }

    if (!this.canAct(action)) {
      this.actionError.set(
        'Esta acción ya no está disponible. Actualiza el pago para revisar su estado.',
      );
      return;
    }

    let request: Observable<SalePayment>;

    switch (action) {
      case 'update': {
        this.paymentForm.markAllAsTouched();

        if (this.paymentForm.invalid) {
          this.focusEditor();
          return;
        }

        const value = this.paymentForm.getRawValue();

        request = this.salesService.updatePayment(payment.saleId, payment.id, {
          ...value,
          notes: value.notes.trim() || null,
        });
        break;
      }

      case 'confirm':
        request = this.salesService.confirmPayment(payment.saleId, payment.id);
        break;

      case 'decline':
      case 'delete': {
        this.reason.markAsTouched();

        if (this.reason.invalid) {
          this.focusEditor();
          return;
        }

        const reason = this.reason.value.trim();

        if (action === 'decline') {
          request = this.salesService.declinePayment(payment.saleId, payment.id, reason);
        } else {
          request = this.salesService.deletePayment(payment.saleId, payment.id, reason);
        }
        break;
      }
    }

    this.actionError.set(null);
    this.setSaving(true);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.payment.set(updated);
        this.changed = true;
        this.action.set(null);
        this.setSaving(false);

        this.toast.success('Operación registrada correctamente.');
      },
      error: (error) => {
        this.setSaving(false);

        this.actionError.set(salesErrorMessage(error, 'No fue posible completar la operación.'));
      },
    });
  }

  public hasChanges() {
    return this.changed;
  }

  protected attachmentBusy(value: boolean) {
    this.setSaving(value);
  }
  protected attachmentChanged() {
    this.changed = true;
  }

  protected close() {
    if (!this.saving()) {
      this.dialogRef.close(this.changed);
    }
  }

  private focusEditor() {
    afterNextRender(
      () => {
        const editor = this.editor()?.nativeElement;
        editor?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const invalid = editor?.querySelector<HTMLElement>(
          'input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid',
        );
        const firstControl = editor?.querySelector<HTMLElement>(
          'input, textarea, mat-select, button',
        );
        (invalid ?? firstControl)?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private setSaving(saving: boolean) {
    this.saving.set(saving);

    this.dialogRef.disableClose = saving ? true : this.initialDisableClose;

    if (saving) {
      this.paymentForm.disable({ emitEvent: false });
      this.reason.disable({ emitEvent: false });
    } else {
      this.paymentForm.enable({ emitEvent: false });
      this.reason.enable({ emitEvent: false });
    }
  }
}
