import { AbstractControl, ValidationErrors } from '@angular/forms';

export function strongPasswordValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value ?? '';

  if (!value) {
    return null;
  }

  if (value.length < 12 || value.length > 128) {
    return { strongPassword: true };
  }

  if (/\s/.test(value)) {
    return { strongPassword: true };
  }

  if (!/[a-z]/.test(value)) {
    return { strongPassword: true };
  }

  if (!/[A-Z]/.test(value)) {
    return { strongPassword: true };
  }

  if (!/\d/.test(value)) {
    return { strongPassword: true };
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return { strongPassword: true };
  }

  return null;
}
