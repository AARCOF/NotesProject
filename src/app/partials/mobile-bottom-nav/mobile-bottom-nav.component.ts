import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mobile-bottom-nav',
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrls: ['./mobile-bottom-nav.component.scss']
})
export class MobileBottomNavComponent {
  @Output() openCreate = new EventEmitter<void>();

  constructor(public router: Router) {}

  isActive(route: string): boolean {
    return this.router.url.includes(route);
  }

  onCreateClick(): void {
    this.openCreate.emit();
  }
}
