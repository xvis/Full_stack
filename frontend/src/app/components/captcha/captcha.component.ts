import {
  AfterViewInit, Component, ElementRef,
  EventEmitter, Output, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const COLORS = ['#1e40af', '#0f766e', '#7c3aed', '#b91c1c', '#0369a1', '#15803d'];

@Component({
  selector: 'app-captcha',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './captcha.component.html',
  styleUrl: './captcha.component.css'
})
export class CaptchaComponent implements AfterViewInit {
  @ViewChild('captchaCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('captchaInput')  inputRef!:  ElementRef<HTMLInputElement>;
  @Output() verified = new EventEmitter<boolean>();

  userInput = '';
  isError   = false;
  isSuccess = false;
  private code = '';

  ngAfterViewInit(): void { this.generate(); }

  /** Generate a fresh CAPTCHA challenge */
  generate(): void {
    this.code = Array.from({ length: 6 }, () =>
      CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');
    this.userInput = '';
    this.isError   = false;
    this.isSuccess = false;
    this.verified.emit(false);
    setTimeout(() => {
      this.draw();
      if (this.inputRef?.nativeElement) {
        this.inputRef.nativeElement.value = '';
        this.inputRef.nativeElement.focus();
      }
    }, 50);
  }

  /** Called by parent to manually refresh (e.g. after failed API call) */
  refresh(): void { this.generate(); }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.userInput = val;

    if (val.length < this.code.length) {
      this.isError = this.isSuccess = false;
      this.verified.emit(false);
      return;
    }

    if (val.toLowerCase() === this.code.toLowerCase()) {
      this.isError   = false;
      this.isSuccess = true;
      this.verified.emit(true);
    } else {
      this.isError   = true;
      this.isSuccess = false;
      this.verified.emit(false);
      // Auto-regenerate after 900ms so user sees the error briefly
      setTimeout(() => this.generate(), 900);
    }
  }

  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Gradient background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#eef2ff');
    bg.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Noise — bezier curves
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(rand(0, W), rand(0, H));
      ctx.bezierCurveTo(rand(0, W), rand(0, H), rand(0, W), rand(0, H), rand(0, W), rand(0, H));
      ctx.strokeStyle = `rgba(${rand(80,160)},${rand(80,160)},${rand(80,200)},0.25)`;
      ctx.lineWidth = rand(1, 2);
      ctx.stroke();
    }

    // Noise — dots
    for (let i = 0; i < 55; i++) {
      ctx.beginPath();
      ctx.arc(rand(0, W), rand(0, H), Math.random() * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rand(60,180)},${rand(60,180)},${rand(60,180)},0.38)`;
      ctx.fill();
    }

    // Characters — rotated, varied size + colour
    const cw = W / (this.code.length + 1);
    this.code.split('').forEach((ch, i) => {
      ctx.save();
      ctx.translate(cw * (i + 0.88) + rand(-3, 3), H * 0.64 + rand(-5, 5));
      ctx.rotate((Math.random() - 0.5) * 0.42);
      ctx.font = `bold ${rand(22, 28)}px Arial, sans-serif`;
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }
}
