export class InspectorOverlay {
  private readonly host: HTMLDivElement;
  private readonly hoverBox: HTMLDivElement;
  private readonly selectedBox: HTMLDivElement;

  constructor() {
    this.host = document.createElement('div');
    this.host.dataset.uiLensOverlay = 'true';
    Object.assign(this.host.style, {
      all: 'initial',
      position: 'fixed',
      inset: '0 auto auto 0',
      width: '0',
      height: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });
    const shadow = this.host.attachShadow({ mode: 'closed' });
    this.hoverBox = this.makeBox('rgba(37, 99, 235, 0.14)', '#2563EB', '1px dashed');
    this.selectedBox = this.makeBox('rgba(37, 99, 235, 0.08)', '#2563EB', '2px solid');
    shadow.append(this.hoverBox, this.selectedBox);
    document.documentElement.append(this.host);
  }

  private makeBox(background: string, borderColor: string, border: string): HTMLDivElement {
    const box = document.createElement('div');
    Object.assign(box.style, {
      position: 'fixed',
      display: 'none',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      background,
      border: `${border} ${borderColor}`,
      transition: 'transform 70ms ease, width 70ms ease, height 70ms ease',
    });
    return box;
  }

  private position(box: HTMLDivElement, element: Element): void {
    const rect = element.getBoundingClientRect();
    Object.assign(box.style, {
      display: 'block',
      transform: `translate(${rect.left}px, ${rect.top}px)`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  showHover(element: Element): void {
    this.position(this.hoverBox, element);
  }

  hideHover(): void {
    this.hoverBox.style.display = 'none';
  }

  showSelected(element: Element): void {
    this.position(this.selectedBox, element);
  }

  hideSelected(): void {
    this.selectedBox.style.display = 'none';
  }

  hideAll(): void {
    this.host.style.display = 'none';
  }

  restore(): void {
    this.host.style.display = 'block';
  }
}
