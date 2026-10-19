import { DatePipe, JsonPipe } from '@angular/common';
import { PurchaseMoneyPipe } from '../data-access/purchase-money.pipe';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Observable, Subscription } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { ToastService } from '../../../shared/services/toast.service';
import {
  Purchase,
  ReceiptPreview,
  localPurchaseTime,
  purchaseStatusLabel,
  purchaseStatusTone,
} from '../data-access/purchases.model';
import { PurchasesService, purchaseError } from '../data-access/purchases.service';
import { PurchaseFormDialog } from '../purchase-form-dialog/purchase-form-dialog';
import { supplyUnitLabel } from '../../supplies/data-access/supply-labels';

@Component({
  selector: 'app-purchase-detail-dialog',
  imports: [
    PurchaseMoneyPipe,
    DatePipe,
    JsonPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    StatusBadge,
  ],
  templateUrl: './purchase-detail-dialog.html',
  styleUrl: './purchase-detail-dialog.scss',
})
export class PurchaseDetailDialog {
  private readonly ref = inject(MatDialogRef<PurchaseDetailDialog>);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(PurchasesService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly id = inject<string>(MAT_DIALOG_DATA);
  private readonly initialDisableClose = this.ref.disableClose ?? false;
  private request?: Subscription;
  private changed = false;
  protected readonly purchase = signal<Purchase | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly preparing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal<ReceiptPreview | null>(null);
  protected readonly canceling = signal(false);
  protected readonly statusLabel = purchaseStatusLabel;
  protected readonly statusTone = purchaseStatusTone;
  protected readonly unitLabel = supplyUnitLabel;
  protected readonly declarations = this.fb.array<
    ReturnType<PurchaseDetailDialog['declarationGroup']>
  >([]);
  protected readonly receiptForm = this.fb.nonNullable.group({
    receivedAt: [localPurchaseTime(), Validators.required],
    declarations: this.declarations,
  });
  protected readonly reason = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.pattern(/\S/),
    Validators.maxLength(1000),
  ]);

  constructor() {
    this.load();
  }
  hasChanges() {
    return this.changed;
  }
  protected close() {
    if (!this.saving()) this.ref.close(this.changed);
  }
  protected can(action: 'update' | 'order' | 'receive' | 'cancel') {
    const purchase = this.purchase();
    if (!purchase || !this.session.hasPermission(`purchases:${action}`)) return false;
    return action === 'order'
      ? purchase.status === 'DRAFT'
      : action === 'receive'
        ? purchase.status === 'ORDERED'
        : purchase.status === 'DRAFT' || purchase.status === 'ORDERED';
  }
  protected load() {
    if (this.saving() || this.preparing()) return;
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.preview.set(null);
    this.canceling.set(false);
    this.request = this.service
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (purchase) => {
          this.purchase.set(purchase);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(purchaseError(error, 'No fue posible consultar la compra.'));
        },
      });
  }
  protected edit() {
    if (!this.can('update') || this.saving() || this.loading() || this.preparing()) return;
    this.setSaving(true);
    this.dialog
      .open(PurchaseFormDialog, {
        data: this.purchase(),
        width: '1080px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100dvh - 32px)',
        panelClass: 'app-dialog-panel',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        this.setSaving(false);
        if (saved) {
          this.changed = true;
          this.load();
        }
      });
  }
  protected order() {
    if (!this.can('order') || this.saving() || this.loading() || this.preparing()) return;
    this.execute(this.service.order(this.id, this.purchase()!.version));
  }
  protected beginCancel() {
    if (!this.can('cancel') || this.saving() || this.loading() || this.preparing()) return;
    this.preview.set(null);
    this.canceling.set(true);
    this.reason.reset('');
    this.error.set(null);
  }
  protected cancel() {
    this.reason.markAsTouched();
    if (!this.can('cancel') || this.reason.invalid || this.saving()) return;
    this.execute(this.service.cancel(this.id, this.purchase()!.version, this.reason.value.trim()));
  }
  protected prepareReceipt() {
    if (!this.can('receive') || this.saving() || this.loading() || this.preparing()) return;
    this.preparing.set(true);
    this.error.set(null);
    this.canceling.set(false);
    this.service
      .preview(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.preparing.set(false);
          if (preview.version !== this.purchase()!.version) {
            this.error.set('La compra cambió. Actualiza su detalle antes de recibirla.');
            return;
          }
          this.preview.set(preview);
          this.declarations.clear();
          for (const item of preview.items) {
            if (Number(item.currentStock) > 0 && item.averageUnitCost === null) {
              this.declarations.push(this.declarationGroup(item.itemId, String(item.currentStock)));
            }
          }
        },
        error: (error) => {
          this.preparing.set(false);
          this.error.set(purchaseError(error));
        },
      });
  }
  protected receiptReady() {
    return !!this.preview()?.items.every((item) => item.active && item.unitMatches);
  }
  protected declarationItem(id: string) {
    return this.preview()?.items.find((item) => item.itemId === id);
  }
  protected useReference(index: number) {
    if (this.saving()) return;
    const group = this.declarations.at(index);
    const item = this.declarationItem(group.controls.itemId.value);
    if (item?.suggestedInitialCost != null)
      group.controls.unitCost.setValue(String(item.suggestedInitialCost));
  }
  protected receive() {
    if (!this.can('receive') || this.saving() || this.preparing() || !this.receiptReady()) return;
    this.receiptForm.markAllAsTouched();
    if (this.receiptForm.invalid) return;
    const value = this.receiptForm.getRawValue();
    const received = new Date(value.receivedAt);
    if (
      !Number.isFinite(received.getTime()) ||
      received < new Date(this.purchase()!.purchaseDateTime)
    ) {
      this.error.set('Revisa la fecha y hora de recepción.');
      return;
    }
    this.execute(
      this.service.receive(this.id, {
        version: this.preview()!.version,
        receivedAt: value.receivedAt,
        declarations: value.declarations.map((item) => ({
          itemId: item.itemId,
          cost: { expectedStock: item.expectedStock, unitCost: item.unitCost },
        })),
      }),
    );
  }
  protected abandonReceipt() {
    if (!this.saving()) this.preview.set(null);
  }
  protected abandonCancel() {
    if (!this.saving()) this.canceling.set(false);
  }

  private declarationGroup(itemId: string, expectedStock: string) {
    return this.fb.nonNullable.group({
      itemId: [itemId],
      expectedStock: [expectedStock],
      unitCost: ['', [Validators.required, Validators.pattern(/^\d{1,12}(\.\d{1,6})?$/)]],
    });
  }
  private execute(request: Observable<Purchase>) {
    this.setSaving(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (purchase) => {
        this.purchase.set(purchase);
        this.changed = true;
        this.preview.set(null);
        this.canceling.set(false);
        this.setSaving(false);
        this.toast.success('Operación de compra registrada.');
      },
      error: (error) => {
        this.setSaving(false);
        this.error.set(purchaseError(error));
      },
    });
  }
  private setSaving(value: boolean) {
    this.saving.set(value);
    this.ref.disableClose = value ? true : this.initialDisableClose;
    if (value) {
      this.receiptForm.disable();
      this.reason.disable();
    } else {
      this.receiptForm.enable();
      this.reason.enable();
    }
  }
}
