import { TestBed } from '@angular/core/testing';
import { StatusBadge, StatusBadgeSize } from './status-badge';

describe('StatusBadge', () => {
  async function setup(label = 'Pendiente') {
    await TestBed.configureTestingModule({ imports: [StatusBadge] }).compileComponents();
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture;
  }

  it('presenta un estado neutro mediano sin añadir un icono o semántica interactiva', async () => {
    const fixture = await setup();
    const badge: HTMLElement = fixture.nativeElement.querySelector('.status-badge');
    expect(badge.textContent?.trim()).toBe('Pendiente');
    expect(badge.classList.contains('status-badge--medium')).toBe(true);
    expect(badge.classList.contains('status-badge--default')).toBe(true);
    expect(badge.querySelector('mat-icon')).toBeNull();
    expect(fixture.nativeElement.querySelector('button, [role="button"]')).toBeNull();
  });

  it('actualiza texto, tono y tamaño sin conservar las variantes anteriores', async () => {
    const fixture = await setup();
    for (const size of ['small', 'large', 'extra-large', 'medium'] as StatusBadgeSize[]) {
      fixture.componentRef.setInput('size', size);
      fixture.componentRef.setInput('tone', 'danger');
      fixture.componentRef.setInput('label', 'Rechazado');
      fixture.detectChanges();
      const badge: HTMLElement = fixture.nativeElement.querySelector('.status-badge');
      expect(badge.classList.contains(`status-badge--${size}`)).toBe(true);
      expect(badge.classList.contains('status-badge--danger')).toBe(true);
      expect(badge.classList.contains('status-badge--default')).toBe(false);
      expect(badge.textContent?.trim()).toBe('Rechazado');
      for (const other of ['small', 'medium', 'large', 'extra-large']) {
        if (other !== size) {
          expect(badge.classList.contains(`status-badge--${other}`)).toBe(false);
        }
      }
    }
  });

  it('conserva el texto como texto y permite añadir y retirar un icono decorativo', async () => {
    const fixture = await setup('<b>Entrada</b>');
    fixture.componentRef.setInput('icon', 'add_box');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.status-badge__label').textContent).toBe(
      '<b>Entrada</b>',
    );
    expect(fixture.nativeElement.querySelector('b')).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-icon').getAttribute('aria-hidden')).toBe(
      'true',
    );
    fixture.componentRef.setInput('icon', undefined);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-icon')).toBeNull();
  });
});
