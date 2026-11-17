/** F1 toggles a text panel with FPS and sim info; hitboxes are drawn by the renderer. */
export class DebugOverlay {
  visible = false;
  private frames = 0;
  private elapsed = 0;
  private fps = 0;

  constructor(
    private readonly el: HTMLElement,
    onToggle: (visible: boolean) => void,
  ) {
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'F1') return;
      e.preventDefault();
      this.visible = !this.visible;
      this.el.hidden = !this.visible;
      onToggle(this.visible);
    });
  }

  /** Call once per rendered frame. */
  update(dt: number, lines: Record<string, string | number>): void {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
    }
    if (!this.visible) return;
    const rows = [`fps   ${this.fps.toFixed(0)}`, ...Object.entries(lines).map(([k, v]) => `${k.padEnd(5)} ${v}`)];
    this.el.textContent = rows.join('\n');
  }
}
