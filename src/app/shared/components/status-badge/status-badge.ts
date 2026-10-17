import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type StatusBadgeSize = 'small' | 'medium' | 'large' | 'extra-large';
export type StatusBadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-status-badge',
  imports: [MatIconModule],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.scss',
})
export class StatusBadge {
  readonly label = input.required<string>();
  readonly size = input<StatusBadgeSize>('medium');
  readonly tone = input<StatusBadgeTone>('default');
  readonly icon = input<string>();
}
