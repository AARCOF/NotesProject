import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton-loader',
  templateUrl: './skeleton-loader.component.html',
  styleUrls: ['./skeleton-loader.component.scss']
})
export class SkeletonLoaderComponent {
  @Input() type: 'card' | 'stat' | 'category' | 'list' = 'card';
  @Input() count: number = 6;

  get arrayFromCount(): number[] {
    return Array(this.count).fill(0);
  }
}
