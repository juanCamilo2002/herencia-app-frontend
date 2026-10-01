import { ProductionProcessType, ProductionStatus } from './production.model';

export const PRODUCTION_PROCESS_OPTIONS: { value: ProductionProcessType; label: string }[] = [
    { value: 'BOTTLING', label: 'Embotellado' },
    { value: 'LABELING', label: 'Etiquetado' },
    { value: 'PACKAGING', label: 'Empaque' },
    { value: 'OTHER', label: 'Otro' },

];

export function productionProcessLabel(type: ProductionProcessType) {
    switch (type) {
        case 'BOTTLING':
            return 'Embotellado';
        case 'LABELING':
            return 'Etiquetado';
        case 'PACKAGING':
            return 'Empaque';
        case 'OTHER':
            return 'Otro';
    }
}

export function productionStatusLabel(status: ProductionStatus) {
    switch (status) {
        case 'COMPLETED':
            return 'Completada';
    }
}