import { purchaseLineTotal, purchaseTotal } from './purchases.model';
import { PurchaseMoneyPipe } from './purchase-money.pipe';

describe('Importes de compras', () => {
  it('redondea cada línea a céntimos como BigDecimal y suma sin errores binarios', () => {
    expect(purchaseLineTotal('1.005', '1.00')).toBe('1.01');
    expect(purchaseLineTotal('0.001', '5.00')).toBe('0.01');
    expect(
      purchaseTotal([
        { quantity: '1.005', unitCost: '1.00' },
        { quantity: '0.001', unitCost: '5.00' },
      ]),
    ).toBe('1.02');
  });
  it('conserva céntimos en importes superiores al rango entero seguro de JavaScript', () => {
    const value = purchaseLineTotal('2147483647', '9999999999.99');
    expect(value).toBe('21474836469978525163.53');
    expect(new PurchaseMoneyPipe().transform(value)).toBe('$ 21.474.836.469.978.525.163,53');
  });
  it('distingue un costo desconocido de cero y conserva seis decimales al consultar el promedio', () => {
    const pipe = new PurchaseMoneyPipe();
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform('0.000000', 6)).toBe('$ 0,00');
    expect(pipe.transform('0.666667', 6)).toBe('$ 0,666667');
  });
});
