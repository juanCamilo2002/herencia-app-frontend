import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  ProductCategory,
  ProductCategoryService,
  productCatalogError,
} from '../data-access/product-category.service';

@Component({
  selector: 'app-category-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './category-form-dialog.html',
})
export class CategoryFormDialog {
  private readonly ref = inject(MatDialogRef<CategoryFormDialog>);
  private readonly service = inject(ProductCategoryService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly category = inject<ProductCategory | null>(MAT_DIALOG_DATA);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    name: [
      this.category?.name ?? '',
      [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)],
    ],
    description: [this.category?.description ?? '', Validators.maxLength(1000)],
  });

  protected close() {
    if (!this.saving()) this.ref.close(false);
  }
  protected submit() {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const request = { name: value.name.trim(), description: value.description.trim() || null };
    this.saving.set(true);
    this.ref.disableClose = true;
    this.error.set(null);
    this.form.disable();
    const save = this.category
      ? this.service.update(this.category.id, request)
      : this.service.create(request);
    save.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.ref.close(true);
      },
      error: (error) => {
        this.saving.set(false);
        this.ref.disableClose = false;
        this.form.enable();
        this.error.set(productCatalogError(error, 'No fue posible guardar la categoría.'));
      },
    });
  }
}
