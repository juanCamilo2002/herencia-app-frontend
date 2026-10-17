import { generateInstallmentSchedule } from './installment-schedule';

describe('Vista previa de cuotas', () => {
  const date = new Date(2026, 9, 14);

  it('incluye la primera cuota configurada en el número total', () => {
    const schedule = generateInstallmentSchedule(date, 300000, 4, 60000);
    expect(schedule.map((item) => item.amount)).toEqual([60000, 80000, 80000, 80000]);
    expect(schedule.map((item) => item.dueDate)).toEqual([
      '2026-10-14',
      '2026-11-14',
      '2026-12-14',
      '2027-01-14',
    ]);
  });

  it('ajusta el redondeo en la última y conserva el total', () => {
    const schedule = generateInstallmentSchedule(date, 100, 3, null);
    expect(schedule.map((item) => item.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(schedule.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(10000);
  });

  it('no arrastra el ajuste de febrero a marzo', () => {
    expect(
      generateInstallmentSchedule(new Date(2026, 0, 31), 150, 3, null).map((item) => item.dueDate),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('respeta febrero de un año bisiesto', () => {
    expect(generateInstallmentSchedule(new Date(2028, 0, 31), 150, 3, null)[1].dueDate).toBe(
      '2028-02-29',
    );
  });

  it('una cuota equivale al total y rechaza un primer importe diferente', () => {
    expect(generateInstallmentSchedule(date, 100, 1, null)[0].amount).toBe(100);
    expect(generateInstallmentSchedule(date, 100, 1, 50)).toEqual([]);
  });

  it('rechaza cuotas fraccionarias, importes con exceso de precisión y saldos insuficientes', () => {
    expect(generateInstallmentSchedule(date, 100, 2.5, null)).toEqual([]);
    expect(generateInstallmentSchedule(date, 100, 3, 100)).toEqual([]);
    expect(generateInstallmentSchedule(date, 100, 3, 1.001)).toEqual([]);
    expect(generateInstallmentSchedule(date, 0.02, 3, null)).toEqual([]);
  });
});
