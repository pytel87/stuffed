/**
 * F1 toggles a text panel with FPS and sim info; hitboxes are drawn by the renderer. ?stats opens
 * just the panel (no hitboxes or see-through roofs), for a phone or tablet with no F1 key.
 */
export class DebugOverlay {
  visible = false;
  /** Opened by ?stats: the frame rate and what it costs only, not the match's details. */
  statsOnly = false;
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

  showStats(): void {
    this.visible = true;
    this.statsOnly = true;
    this.el.hidden = false;
    this.el.classList.add('stats');
  }

  hideStats(): void {
    if (!this.statsOnly) return;
    this.visible = false;
    this.statsOnly = false;
    this.el.hidden = true;
    this.el.classList.remove('stats');
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
