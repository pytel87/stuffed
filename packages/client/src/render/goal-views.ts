// Beach ball goals: a crossbar, a net and a floating scoreboard over each one (the posts and
// back bar are map walls, drawn with the rest of the props). The score pops when it goes up.
import * as THREE from 'three';
import type { GameState, Goal, MapData } from '@stuffed/sim';
import { outlinedBox } from './props.ts';
import { toonMaterial } from './toon.ts';

const HEIGHT = 1.6;

function netTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 64);
    g.moveTo(0, i);
    g.lineTo(64, i);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

interface Board {
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  shown: number;
  pop: number;
}

export class GoalViews {
  private readonly boards: Board[] = [];

  constructor(scene: THREE.Scene, map: MapData) {
    const net = netTexture();
    for (const goal of map.goals ?? []) {
      scene.add(this.frame(goal, net));
      this.boards.push(this.board(scene, goal));
    }
  }

  update(state: GameState, dt: number): void {
    this.boards.forEach((b, i) => {
      const score = state.goals[i] ?? 0;
      if (score !== b.shown) {
        if (score > b.shown) b.pop = 1;
        b.shown = score;
        this.draw(b);
      }
      b.pop = Math.max(0, b.pop - dt * 2.5);
      const s = 1.4 * (1 + b.pop * 0.6);
      b.sprite.scale.set(s, s, 1);
    });
  }

  private frame(goal: Goal, net: THREE.Texture): THREE.Group {
    const g = new THREE.Group();
    const m = goal.mouth;
    const x0 = m.x - 0.15;
    const x1 = m.x + m.w + 0.15;
    const front = goal.opens === 'south' ? m.y + m.h + 0.2 : m.y - 0.2;
    const back = goal.opens === 'south' ? m.y - 0.15 : m.y + m.h + 0.15;
    // The crossbar across the front, at the top of the posts.
    const bar = outlinedBox(x1 - x0 + 0.3, 0.25, 0.25, toonMaterial('#fdfbf7', { map: null }));
    bar.position.set((x0 + x1) / 2, HEIGHT - 0.12, front);
    g.add(bar);
    // The net: a roof sloping from the crossbar down to the back, and the two sides.
    const netMat = new THREE.MeshBasicMaterial({ map: net, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const depth = Math.abs(front - back);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, Math.hypot(depth, 0.5)), netMat);
    roof.position.set((x0 + x1) / 2, HEIGHT - 0.25, (front + back) / 2);
    roof.rotation.x = -Math.PI / 2 + (goal.opens === 'south' ? -0.25 : 0.25);
    (roof.material as THREE.MeshBasicMaterial).map!.repeat.set(4, 2);
    g.add(roof);
    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, HEIGHT - 0.4), netMat);
    backNet.position.set((x0 + x1) / 2, (HEIGHT - 0.4) / 2, back);
    g.add(backNet);
    return g;
  }

  private board(scene: THREE.Scene, goal: Goal): Board {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false }));
    const m = goal.mouth;
    sprite.position.set(m.x + m.w / 2, HEIGHT + 1.2, m.y + m.h / 2);
    sprite.renderOrder = 5;
    scene.add(sprite);
    const b = { sprite, canvas, texture, shown: 0, pop: 0 };
    this.draw(b);
    return b;
  }

  private draw(b: Board): void {
    const g = b.canvas.getContext('2d')!;
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#fffaf3';
    g.strokeStyle = '#2a1f2d';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#2a1f2d';
    g.font = '900 64px Rubik, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(b.shown), 64, 68);
    b.texture.needsUpdate = true;
  }
}
