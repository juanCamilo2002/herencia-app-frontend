import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Product } from '../../products/data-access/product.model';
import { ProductService } from '../../products/data-access/product.service';
import { Supply } from '../../supplies/data-access/supply.model';
import { SupplyService } from '../../supplies/data-access/supply.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
    CreateProductionRequest,
    ProductionProcessType,
    ProductionSupplyItemType,
} from '../data-access/production.model';
import { ProductionService } from '../data-access/production.service';
import { supplyUnitLabel } from '../../supplies/data-access/supply-labels';
import { PRODUCTION_PROCESS_OPTIONS } from '../data-access/production-labels';
import { toSignal } from '@angular/core/rxjs-interop';

type ProductionSupplyFormValue = {
    supplyId: string;
    quantity: number;
    reason: string;
};

@Component({
    imports: [
        DecimalPipe,
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
    selector: 'app-production-form-dialog',
    styleUrl: './production-form-dialog.scss',
    templateUrl: './production-form-dialog.html',
})
export class ProductionFormDialog implements OnInit {
    private readonly formBuilder = inject(FormBuilder);
    private readonly productionService = inject(ProductionService);
    private readonly productService = inject(ProductService);
    private readonly supplyService = inject(SupplyService);
    private readonly toast = inject(ToastService);
    private readonly dialogRef = inject(MatDialogRef<ProductionFormDialog>);

    protected readonly products = signal<Product[]>([]);
    protected readonly supplies = signal<Supply[]>([]);
    protected readonly loadingOptions = signal(true);
    protected readonly saving = signal(false);
    protected readonly error = signal<string | null>(null);

    protected readonly processOptions = PRODUCTION_PROCESS_OPTIONS;
    protected readonly unitLabel = supplyUnitLabel;

    protected readonly form = this.formBuilder.nonNullable.group({
        productionDate: this.formBuilder.control<Date | null>(new Date(), [Validators.required]),
        productionTime: this.formBuilder.nonNullable.control(this.currentTimeOption(), [Validators.required]),
        processes: this.formBuilder.nonNullable.control<ProductionProcessType[]>([], [Validators.required]),
        notes: ['', [Validators.maxLength(500)]],
        outputs: this.formBuilder.array([this.createOutputGroup()]),
        consumedSupplies: this.formBuilder.array([this.createSupplyGroup('CONSUMED')]),
        lossSupplies: this.formBuilder.array([]),
    });

    protected readonly outputControls = computed(() => this.outputs.controls);
    protected readonly consumedSupplyControls = computed(() => this.consumedSupplies.controls);
    protected readonly lossSupplyControls = computed(() => this.lossSupplies.controls);

    protected readonly productionValidationError = computed(() => {
        this.formValue();

        return this.validateProduction();
    });

    protected readonly formValue = toSignal(this.form.valueChanges, {
        initialValue: this.form.getRawValue(),
    });

    protected readonly supplyStockSummaries = computed(() => {
        this.formValue();

        const value = this.form.getRawValue();
        const consumedSupplies = value.consumedSupplies as ProductionSupplyFormValue[];
        const lossSupplies = value.lossSupplies as ProductionSupplyFormValue[];

        const requestedBySupplyId = new Map<string, { consumed: number, loss: number }>();

        for (const item of consumedSupplies) {
            if (!item.supplyId) {
                continue;
            }

            const current = requestedBySupplyId.get(item.supplyId) ?? { consumed: 0, loss: 0 };
            current.consumed += Number(item.quantity) || 0;
            requestedBySupplyId.set(item.supplyId, current);
        }

        for (const item of lossSupplies) {
            if (!item.supplyId) {
                continue;
            }
            const current = requestedBySupplyId.get(item.supplyId) ?? { consumed: 0, loss: 0 };
            current.loss += Number(item.quantity) || 0;
            requestedBySupplyId.set(item.supplyId, current);
        }

        return Array.from(requestedBySupplyId.entries())
            .map(([supplyId, quantities]) => {
                const supply = this.supplies().find((item) => item.id === supplyId);

                if (!supply) {
                    return null;
                }

                const requested = quantities.consumed + quantities.loss;

                return {
                    supply,
                    consumed: quantities.consumed,
                    loss: quantities.loss,
                    requested,
                    remaining: supply.stock - requested,
                    overStock: requested > supply.stock,
                };
            })
            .filter((item) => item != null);
    });

    ngOnInit(): void {
        this.loadOptions();
    }

    protected get outputs() {
        return this.form.controls.outputs as FormArray;
    }

    protected get consumedSupplies() {
        return this.form.controls.consumedSupplies as FormArray;
    }

    protected get lossSupplies() {
        return this.form.controls.lossSupplies as FormArray;
    }

    protected addOutput() {
        this.outputs.push(this.createOutputGroup());
    }

    protected removeOutput(index: number) {
        if (this.outputs.length > 1) {
            this.outputs.removeAt(index);
        }
    }

    protected addConsumedSupply() {
        this.consumedSupplies.push(this.createSupplyGroup('CONSUMED'));
    }

    protected removeConsumedSupply(index: number) {
        this.consumedSupplies.removeAt(index);
    }

    protected addLossSupply() {
        this.lossSupplies.push(this.createSupplyGroup('LOSS'));
    }

    protected removeLossSupply(index: number) {
        this.lossSupplies.removeAt(index);
    }

    protected close() {
        this.dialogRef.close(false);
    }

    protected submit() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const validationError = this.productionValidationError();

        if (validationError) {
            this.error.set(null);
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        const value = this.form.getRawValue();
        const consumedSupplies = value.consumedSupplies as ProductionSupplyFormValue[];
        const lossSupplies = value.lossSupplies as ProductionSupplyFormValue[];

        const request: CreateProductionRequest = {
            productionDateTime: this.toProductionDateTime(value.productionDate, value.productionTime),
            notes: this.toNullableString(value.notes),
            processes: value.processes,
            outputs: value.outputs.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
            })),
            supplies: [
                ...consumedSupplies.map((item) => ({
                    supplyId: item.supplyId,
                    type: 'CONSUMED' as ProductionSupplyItemType,
                    quantity: item.quantity,
                    reason: null,
                })),
                ...lossSupplies.map((item) => ({
                    supplyId: item.supplyId,
                    type: 'LOSS' as ProductionSupplyItemType,
                    quantity: item.quantity,
                    reason: this.toNullableString(item.reason),
                })),
            ],
        };

        this.productionService.createProduction(request).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('No fue posible registrar la producción.');
                this.toast.error('No fue posible registrar la producción.');
                this.saving.set(false);
            },
        });
    }

    protected hasError(control: any, errorName: string) {
        return control.touched && control.hasError(errorName);
    }

    protected productName(id: string) {
        return this.products().find((product) => product.id === id)?.name ?? '';
    }

    protected supplyLabel(id: string) {
        const supply = this.supplies().find((item) => item.id === id);

        if (!supply) {
            return '';
        }

        return `${supply.name} (${this.unitLabel(supply.unit)})`;
    }

    private createOutputGroup() {
        return this.formBuilder.nonNullable.group({
            productId: ['', [Validators.required]],
            quantity: [1, [Validators.required, Validators.min(1)]],
        });
    }

    private createSupplyGroup(type: ProductionSupplyItemType) {
        return this.formBuilder.nonNullable.group({
            supplyId: ['', [Validators.required]],
            quantity: [1, [Validators.required, Validators.min(0.001)]],
            reason: ['', type === 'LOSS' ? [Validators.required, Validators.maxLength(255)] : [Validators.maxLength(255)]],
        });
    }

    private loadOptions() {
        this.loadingOptions.set(true);

        this.productService.getProductOptions().subscribe({
            next: (products) => {
                this.products.set(products);
                this.loadSupplyOptions();
            },
            error: () => {
                this.error.set('No fue posible cargar los productos.');
                this.loadingOptions.set(false);
            },
        });
    }

    private loadSupplyOptions() {
        this.supplyService.getSupplyOptions().subscribe({
            next: (supplies) => {
                this.supplies.set(supplies);
                this.loadingOptions.set(false);
            },
            error: () => {
                this.error.set('No fue posible cargar los insumos.');
                this.loadingOptions.set(false);
            },
        });
    }

    private validateProduction() {
        const value = this.form.getRawValue();
        const consumedSupplies = value.consumedSupplies as ProductionSupplyFormValue[];
        const lossSupplies = value.lossSupplies as ProductionSupplyFormValue[];

        if (value.outputs.length === 0) {
            return 'Agrega al menos un producto generado.';
        }

        if (consumedSupplies.length + lossSupplies.length === 0) {
            return 'Agrega al menos un insumo usado o una merma.';
        }

        const outputProductIds = value.outputs
            .map((item) => item.productId)
            .filter(Boolean);

        if (new Set(outputProductIds).size !== outputProductIds.length) {
            return 'No repitas productos generados.';
        }

        const supplyKeys = [
            ...consumedSupplies
                .filter((item) => item.supplyId)
                .map((item) => `${item.supplyId}:CONSUMED`),
            ...lossSupplies
                .filter((item) => item.supplyId)
                .map((item) => `${item.supplyId}:LOSS`),
        ];

        if (new Set(supplyKeys).size !== supplyKeys.length) {
            return 'No repitas el mismo insumo con el mismo tipo.';
        }

        const requestedBySupplyId = new Map<string, number>();

        for (const item of [...consumedSupplies, ...lossSupplies]) {
            if (!item.supplyId) {
                continue;
            }

            requestedBySupplyId.set(
                item.supplyId,
                (requestedBySupplyId.get(item.supplyId) ?? 0) + Number(item.quantity)
            );
        }

        for (const [supplyId, requestedQuantity] of requestedBySupplyId.entries()) {
            const supply = this.supplies().find((item) => item.id === supplyId);

            if (!supply) {
                continue;
            }

            if (requestedQuantity > supply.stock) {
                return `Stock insuficiente para ${supply.name}. Disponible: ${this.formatQuantity(supply.stock)} ${this.unitLabel(supply.unit)}, solicitado: ${this.formatQuantity(requestedQuantity)} ${this.unitLabel(supply.unit)}.`;
            }
        }

        return null;
    }

    private formatQuantity(quantity: number) {
        return quantity.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        });
    }

    private currentTimeOption() {
        const now = new Date();

        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    private toProductionDateTime(date: Date | null, time: string) {
        if (!date) {
            return '';
        }

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}T${time}`;
    }

    private toNullableString(value: string | null | undefined) {
        if (!value) {
            return null;
        }

        const trimmedValue = value.trim();
        return trimmedValue.length > 0 ? trimmedValue : null;
    }
}
