import { Component, input } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";

export type MetricCardTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

@Component({
    imports: [MatIconModule],
    selector: 'app-metric-card',
    styleUrl: './metric-card.scss',
    templateUrl: './metric-card.html'
})
export class MetricCard {
    readonly label = input.required<string>();
    readonly value =  input.required<string | number>();
    readonly hint = input<string>();
    readonly icon = input<string>();
    readonly tone = input<MetricCardTone>('default');
}