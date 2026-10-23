
import { AfterViewInit, Component, OnDestroy } from '@angular/core';



declare function createTree(): void;
declare function destroyTree(): void;
@Component({
  standalone: false,
  selector: 'app-tree',
  templateUrl: './tree.component.html',
  styleUrls: ['./tree.component.css']
})
export class TreeComponent implements AfterViewInit, OnDestroy {

  constructor() { }

  ngAfterViewInit(): void {
    if (typeof createTree === 'function') createTree();
  }

  ngOnDestroy(): void {
    if (typeof destroyTree === 'function') destroyTree();
  }

}
