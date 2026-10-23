import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ParallaxService {
  constructor(private readonly zone: NgZone) {}

  applyParallax(element: HTMLElement): () => void {
    if (window.matchMedia('(pointer: coarse)').matches) return () => undefined;

    const onPointerMove = (event: PointerEvent): void => {
      const x = 75 - (event.clientX - window.innerWidth / 2) * 0.01;
      const y = 30 - (event.clientY - window.innerHeight / 2) * 0.02;
      element.style.backgroundPosition = `${x}% ${y}%`;
    };

    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    });

    return () => window.removeEventListener('pointermove', onPointerMove);
  }
}
