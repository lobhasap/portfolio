import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { ParallaxService } from '../services/parallax.service';

@Component({
  standalone: false,
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('elem') elem!: ElementRef<HTMLElement>;
  @ViewChild('elem1') elem1!: ElementRef<HTMLElement>;

  private stopParallax: (() => void) | null = null;
  private readonly onPointerMove = (event: PointerEvent): void => {
    const circle = this.elem1.nativeElement;
    const bounds = circle.parentElement!.getBoundingClientRect();
    circle.style.left = `${event.clientX - bounds.left - circle.offsetWidth / 2}px`;
    circle.style.top = `${event.clientY - bounds.top - circle.offsetHeight / 2}px`;
  };

  constructor(private readonly parallaxService: ParallaxService, private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    this.zone.runOutsideAngular(() => {
      this.stopParallax = this.parallaxService.applyParallax(this.elem.nativeElement);
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    });
  }

  ngOnDestroy(): void {
    this.stopParallax?.();
    window.removeEventListener('pointermove', this.onPointerMove);
  }
}
