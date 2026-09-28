import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { CreateProductRequest, Product, UpdateProductRequest } from '../data-access/product.model';
import { ProductService } from '../data-access/product.service';
import { ToastService } from '../../../shared/services/toast.service';

export type ProductFormDialogData = {
    product?: Product
}

@Component({
    imports: [
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        ReactiveFormsModule,
    ],
    selector: 'app-product-form-dialog',
    styleUrl: './product-form-dialog.scss',
    templateUrl: './product-form-dialog.html'
})
export class ProductFormDialog {
    private readonly formBuilder = inject(FormBuilder);
    private readonly productService = inject(ProductService);
    private readonly toast = inject(ToastService);
    private readonly dialogRef = inject(MatDialogRef<ProductFormDialog>);
    private readonly data = inject<ProductFormDialogData | null>(MAT_DIALOG_DATA, { optional: true });

    protected readonly product = this.data?.product ?? null;
    protected readonly isEdit = this.product != null;
    protected readonly saving = signal(false);
    protected readonly error = signal<string | null>(null);

    protected readonly form = this.formBuilder.nonNullable.group({
        name: [this.product?.name ?? '', [Validators.required, Validators.maxLength(120)]],
        winery: [this.product?.winery ?? '', [Validators.maxLength(120)]],
        grapeVariety: [this.product?.grapeVariety ?? '', [Validators.maxLength(80)]],
        vintage: [this.product?.vintage ?? null as number | null, [Validators.min(1900)]],
        price: [this.product?.price ?? 0, [Validators.required, Validators.min(1)]],
        stock: [this.product?.stock ?? 0, [Validators.required, Validators.min(0)]],
        minimumStock: [this.product?.minimumStock ?? 0, [Validators.required, Validators.min(0)]]
    });

    protected close() {
        this.dialogRef.close(false);
    }

    protected submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        if (this.isEdit && this.product) {
            this.updateProduct(this.product.id);
            return;
        }

        this.createProduct();

        
    }

    protected hasError(controlName: keyof typeof this.form.controls, errorName: string) {
        const control = this.form.controls[controlName];
        return control.touched && control.hasError(errorName);
    }

    private createProduct() {
        const value = this.form.getRawValue();

        const request: CreateProductRequest = {
            name: value.name.trim(),
            winery: this.toNullableString(value.winery),
            grapeVariety: this.toNullableString(value.grapeVariety),
            vintage: value.vintage,
            price: value.price,
            stock: value.stock,
            minimumStock: value.minimumStock,
        };

        this.productService.createProduct(request).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('No fue posible crear el producto.');
                this.toast.error('No fue posible crear el producto');
                this.saving.set(false);
            }
        });
    }

    private updateProduct(id: string) {
        const value = this.form.getRawValue();

        const request: UpdateProductRequest = {
            name: value.name.trim(),
            winery: this.toNullableString(value.winery),
            grapeVariety: this.toNullableString(value.grapeVariety),
            vintage: value.vintage,
            price: value.price,
            minimumStock: value.minimumStock,
            active: this.product?.active ?? true,
        };

        this.productService.updateProduct(id, request).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('No fue posible actualizar el producto');
                this.toast.error('No fue posible actualizar el producto.');
                this.saving.set(false);
            }
        });
    }

    private toNullableString(value: string) {
        const trimmedValue = value.trim();
        return trimmedValue.length > 0 ? trimmedValue : null;
    }
}