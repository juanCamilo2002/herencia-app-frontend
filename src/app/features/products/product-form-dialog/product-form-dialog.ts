import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Product, ProductAttribute } from '../data-access/product.model';
import { ProductService } from '../data-access/product.service';
import {
  ProductCategory,
  ProductCategoryService,
  productCatalogError,
} from '../../product-categories/data-access/product-category.service';

export type ProductFormDialogData = { product?: Product };

export function uniqueProductAttributes(control: AbstractControl): ValidationErrors | null {
  const names = (control.value as ProductAttribute[]).map((item) => item.name.trim().toLowerCase());
  return new Set(names).size === names.length ? null : { duplicateNames: true };
}

@Component({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  selector: 'app-product-form-dialog',
  styleUrl: './product-form-dialog.scss',
  templateUrl: './product-form-dialog.html',
})
export class ProductFormDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ProductService);
  private readonly categoryService = inject(ProductCategoryService);
  private readonly ref = inject(MatDialogRef<ProductFormDialog>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject<ProductFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly product = this.data?.product ?? null;
  protected readonly isEdit = this.product !== null;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly categories = signal<ProductCategory[]>([]);
  protected readonly categoriesLoading = signal(false);
  protected readonly categoriesError = signal(false);
  protected readonly attributes = this.fb.array(
    (this.product?.attributes ?? []).map((item) => this.attributeGroup(item)),
    { validators: uniqueProductAttributes },
  );
  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control(this.product?.name ?? '', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(120),
    ]),
    categoryId: this.fb.control<string | null>(this.product?.categoryId ?? null),
    description: this.fb.nonNullable.control(
      this.product?.description ?? '',
      Validators.maxLength(2000),
    ),
    price: this.fb.nonNullable.control(this.product?.price ?? 0, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(9999999999.99),
      Validators.pattern(/^\d+(\.\d{1,2})?$/),
    ]),
    stock: this.fb.nonNullable.control(this.product?.stock ?? 0, [
      Validators.required,
      Validators.min(0),
      Validators.max(2147483647),
      Validators.pattern(/^\d+$/),
    ]),
    minimumStock: this.fb.nonNullable.control(this.product?.minimumStock ?? 0, [
      Validators.required,
      Validators.min(0),
      Validators.max(2147483647),
      Validators.pattern(/^\d+$/),
    ]),
    attributes: this.attributes,
  });

  ngOnInit() {
    this.loadCategories();
  }

  protected currentCategoryMissing() {
    return (
      !!this.product?.categoryId &&
      !this.categories().some((category) => category.id === this.product!.categoryId)
    );
  }

  protected loadCategories() {
    if (this.categoriesLoading() || this.saving()) return;
    this.categoriesLoading.set(true);
    this.categoriesError.set(false);
    this.categoryService
      .options()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.categoriesLoading.set(false);
        },
        error: () => {
          this.categoriesError.set(true);
          this.categoriesLoading.set(false);
        },
      });
  }

  protected addAttribute() {
    if (!this.saving() && this.attributes.length < 20) this.attributes.push(this.attributeGroup());
  }
  protected removeAttribute(index: number) {
    if (!this.saving()) this.attributes.removeAt(index);
  }
  protected close() {
    if (!this.saving()) this.ref.close(false);
  }

  protected submit() {
    if (this.saving() || this.categoriesLoading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const body = {
      name: value.name.trim(),
      categoryId: value.categoryId,
      description: value.description.trim() || null,
      attributes: value.attributes.map((item) => ({
        name: item.name.trim(),
        value: item.value.trim(),
      })),
      price: value.price,
      minimumStock: value.minimumStock,
    };
    this.saving.set(true);
    this.ref.disableClose = true;
    this.error.set(null);
    this.form.disable();
    const request = this.product
      ? this.service.updateProduct(this.product.id, { ...body, active: this.product.active })
      : this.service.createProduct({ ...body, stock: value.stock });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.ref.close(true),
      error: (error) => {
        this.saving.set(false);
        this.ref.disableClose = false;
        this.form.enable();
        this.error.set(
          productCatalogError(
            error,
            'No fue posible guardar el producto. Revisa los datos e inténtalo de nuevo.',
          ),
        );
      },
    });
  }

  private attributeGroup(item: ProductAttribute = { name: '', value: '' }) {
    return this.fb.nonNullable.group({
      name: [item.name, [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)]],
      value: [
        item.value,
        [Validators.required, Validators.pattern(/\S/), Validators.maxLength(250)],
      ],
    });
  }
}
