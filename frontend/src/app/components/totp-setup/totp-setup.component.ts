import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

type SetupStep = 'intro' | 'qrcode' | 'verify' | 'success';

@Component({
  selector: 'app-totp-setup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './totp-setup.component.html',
  styleUrl: './totp-setup.component.css'
})
export class TotpSetupComponent implements OnDestroy {
  @Input() mode: 'enable' | 'disable' = 'enable';
  @Output() closed = new EventEmitter<boolean>(); // true = action completed

  step: SetupStep = 'intro';
  isLoading = false;
  errorMessage = '';

  // Setup data
  qrCode = '';
  secret = '';
  manualKey = '';

  // 6-digit code
  digits: string[] = ['', '', '', '', '', ''];

  constructor(private authService: AuthService) {}

  ngOnDestroy(): void {}

  // ── Navigation ────────────────────────────────────────────────────────────
  startSetup(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.setupTotp().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.qrCode = res.qr_code;
        this.secret = res.secret;
        this.manualKey = res.manual_key;
        this.step = 'qrcode';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Failed to generate QR code.';
      }
    });
  }

  goToVerify(): void {
    this.digits = ['', '', '', '', '', ''];
    this.errorMessage = '';
    this.step = 'verify';
    setTimeout(() => document.getElementById('setup-digit-0')?.focus(), 100);
  }

  close(completed = false): void {
    this.closed.emit(completed);
  }

  // ── Digit input handling ──────────────────────────────────────────────────
  onDigitInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const inputEvent = event as InputEvent;
    // Use event.data (the single char typed) to avoid re-trigger issues with input.value
    const char = (inputEvent.data ?? input.value).replace(/\D/g, '').slice(-1);
    this.digits[index] = char;
    input.value = char; // correct display (e.g. if user typed a non-digit)

    if (char && index < 5) {
      (document.getElementById(`setup-digit-${index + 1}`) as HTMLInputElement)?.focus();
    }

    if (this.digits.every(d => d !== '')) {
      this.onConfirm();
    }
  }

  onDigitKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      this.digits[index - 1] = '';
      (document.getElementById(`setup-digit-${index - 1}`) as HTMLInputElement)?.focus();
    }
  }

  onDigitPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const ds = text.replace(/\D/g, '').slice(0, 6).split('');
    ds.forEach((d, i) => { this.digits[i] = d; });
    const next = Math.min(ds.length, 5);
    (document.getElementById(`setup-digit-${next}`) as HTMLInputElement)?.focus();
    if (ds.length === 6) this.onConfirm();
  }

  // ── Enable TOTP ───────────────────────────────────────────────────────────
  onConfirm(): void {
    const code = this.digits.join('');
    if (code.length !== 6) return;

    this.isLoading = true;
    this.errorMessage = '';

    if (this.mode === 'enable') {
      this.authService.enableTotp(this.secret, code).subscribe({
        next: () => { this.isLoading = false; this.step = 'success'; },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Invalid code. Please try again.';
          this.digits = ['', '', '', '', '', ''];
          setTimeout(() => document.getElementById('setup-digit-0')?.focus(), 100);
        }
      });
    } else {
      // Disable mode — step is 'verify' directly
      this.authService.disableTotp(code).subscribe({
        next: () => { this.isLoading = false; this.close(true); },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Invalid code. Cannot disable 2FA.';
          this.digits = ['', '', '', '', '', ''];
          setTimeout(() => document.getElementById('setup-digit-0')?.focus(), 100);
        }
      });
    }
  }

  // ── Utils ─────────────────────────────────────────────────────────────────
  copyKey(): void {
    navigator.clipboard.writeText(this.secret).catch(() => {});
  }

  get codeReady(): boolean {
    return this.digits.every(d => d !== '');
  }
}
