import {
  AfterViewInit, Component, ElementRef,
  EventEmitter, Output, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

@Component({
  selector: 'app-captcha',
  standalone: true,
  imports: [CommonModule, TranslateModule],
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
    // Canvas buffer: 560×160 — displayed at 260×70 CSS (≈2× retina clarity)
    const W = canvas.width;   // 560
    const H = canvas.height;  // 160

    ctx.clearRect(0, 0, W, H);

    // 1 ── White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // 2 ── Very subtle scatter dots (barely visible, like TCS)
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(rand(0, W), rand(0, H), rand(1, 2), 0, Math.PI * 2);
      const a = (Math.random() * 0.10 + 0.04).toFixed(2);
      ctx.fillStyle = `rgba(150, 160, 175, ${a})`;
      ctx.fill();
    }

    // 3 ── Characters: dark gray, monospace, mild tilt
    //      Font 82-96px in 160px buffer → visually ~36-42px in 70px CSS box → fills ~52-60% of height (TCS proportion)
    const charCount = this.code.length;
    const slotW = W / (charCount + 1);

    this.code.split('').forEach((ch, i) => {
      const x = slotW * (i + 0.88) + rand(-8, 8);
      const y = H * 0.68 + rand(-10, 10);   // baseline sits at ~68% of buffer height

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.18);   // ±0.09 rad — subtle, like TCS
      const size = rand(82, 96);
      ctx.font = `400 ${size}px "Courier New", Courier, monospace`;
      const shade = rand(38, 70);   // near-black to mid-gray, no bright colors
      ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });

    // 4 ── Single horizontal strikethrough line (TCS signature element)
    //      At ~52% height → visually bisects the uppercase characters
    const strikeY = H * 0.52 + rand(-6, 6);
    ctx.beginPath();
    ctx.moveTo(slotW * 0.3, strikeY);
    ctx.lineTo(W - slotW * 0.3, strikeY);
    ctx.strokeStyle = 'rgba(110, 120, 140, 0.60)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}
