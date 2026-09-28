import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    imports: [MatIconModule, MatButtonModule],
    selector: 'app-topbar',
    styleUrl: './topbar.scss',
    templateUrl: './topbar.html',
})
export class Topbar {

    readonly showMenuButton = input(false);
    readonly menuClick = output<void>();

}