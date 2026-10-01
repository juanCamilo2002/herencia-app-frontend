import { SupplyUnit } from './supply.model';

export function supplyUnitLabel(unit: SupplyUnit) {
    switch (unit) {
        case 'UNIT':
            return 'Unidad';
        case 'GRAM':
            return 'Gramo';
        case 'KILOGRAM':
            return 'Kilogramo';
        case 'MILLILITER':
            return 'Mililitro';
        case 'LITER':
            return 'Litro';
        case 'METER':
            return 'Metro';
        case 'PACKAGE':
            return 'Paquete';
    }
}