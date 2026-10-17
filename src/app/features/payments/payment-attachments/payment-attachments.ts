import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { SalePayment } from '../../sales/data-access/sales.model';
import { salesErrorMessage } from '../../sales/data-access/sales.labels';
import {
  PaymentAttachment,
  PaymentAttachmentsService,
} from '../data-access/payment-attachments.service';

@Component({
  selector: 'app-payment-attachments',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    StatusBadge,
  ],
  templateUrl: './payment-attachments.html',
  styleUrl: './payment-attachments.scss',
})
export class PaymentAttachments implements OnChanges {
  readonly payment = input.required<SalePayment>();
  readonly disabled = input(false);
  readonly busyChange = output<boolean>();
  readonly changed = output<void>();
  private readonly service = inject(PaymentAttachmentsService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly attachments = signal<PaymentAttachment[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly removing = signal(false);
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(1000), Validators.pattern(/\S/)],
  });

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['payment'];
    if (!change) return;
    if (change.previousValue?.id !== change.currentValue.id) {
      this.attachments.set([]);
      this.file.set(null);
      const input = this.fileInput()?.nativeElement;
      if (input) input.value = '';
      this.removing.set(false);
      this.reason.reset();
    }
    this.load();
  }

  protected canManage() {
    return (
      this.session.hasPermission('payments:manage-attachments') &&
      this.payment().status === 'REGISTERED' &&
      !this.payment().deletedAt
    );
  }

  protected active() {
    return this.attachments().find((item) => !item.removedAt);
  }

  protected previous() {
    return this.attachments().filter((item) => item.removedAt);
  }

  protected formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const unit = bytes < 1024 * 1024 ? 'KB' : 'MB';
    const size = bytes / (unit === 'KB' ? 1024 : 1024 * 1024);
    return `${size.toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${unit}`;
  }

  protected clearFile() {
    if (this.busy() || this.disabled()) return;
    this.file.set(null);
    const input = this.fileInput()?.nativeElement;
    if (input) input.value = '';
  }

  protected load() {
    if (this.busy()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    const payment = this.payment();
    this.request = this.service
      .list(payment.saleId, payment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.attachments.set(items);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No fue posible consultar los soportes.');
          this.loading.set(false);
        },
      });
  }

  protected selectFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.file.set(null);
    this.error.set(null);
    if (!file) return;
    if (file.size === 0 || file.size > 5242880 || !/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      this.error.set('Selecciona un PDF, JPG o PNG no vacío de máximo 5 MB.');
      input.value = '';
      return;
    }
    this.file.set(file);
  }

  protected upload() {
    const file = this.file();
    if (!file || !this.canManage() || this.busy() || this.disabled() || this.loading()) return;
    const payment = this.payment();
    this.setBusy(true);
    this.service
      .upload(payment.saleId, payment.id, file, this.active()?.id ?? null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.attachments.update((items) => [
            item,
            ...items.map((old) =>
              old.removedAt
                ? old
                : {
                    ...old,
                    removedAt: item.uploadedAt,
                    removalReason: 'Reemplazado por un nuevo soporte.',
                  },
            ),
          ]);
          this.file.set(null);
          const input = this.fileInput()?.nativeElement;
          if (input) input.value = '';
          this.setBusy(false);
          this.changed.emit();
          this.load();
        },
        error: (error) => this.fail(error),
      });
  }

  protected remove() {
    this.reason.markAsTouched();
    const active = this.active();
    if (!active || this.reason.invalid || !this.canManage() || this.busy() || this.disabled())
      return;
    const payment = this.payment();
    this.setBusy(true);
    this.service
      .remove(payment.saleId, payment.id, active.id, this.reason.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.attachments.update((items) => items.map((old) => (old.id === item.id ? item : old)));
          this.removing.set(false);
          this.reason.reset();
          this.setBusy(false);
          this.changed.emit();
        },
        error: (error) => this.fail(error),
      });
  }

  protected download(item: PaymentAttachment) {
    if (this.busy() || this.disabled()) return;
    const payment = this.payment();
    this.setBusy(true);
    this.service
      .download(payment.saleId, payment.id, item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = item.originalFilename;
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.setBusy(false);
        },
        error: () => {
          this.setBusy(false);
          this.error.set('No fue posible descargar el soporte.');
        },
      });
  }

  private fail(error: unknown) {
    this.setBusy(false);
    this.error.set(
      salesErrorMessage(error, 'No fue posible guardar el soporte. Actualiza si el pago cambió.'),
    );
  }

  private setBusy(value: boolean) {
    this.busy.set(value);
    if (value) this.error.set(null);
    this.busyChange.emit(value);
  }
}
