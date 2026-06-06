import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CaptchaComponent } from '../captcha/captcha.component';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FooterComponent, RouterLink, CaptchaComponent, TranslateModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('loginCaptcha') captchaRef?: CaptchaComponent;
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  captchaVerified = false;
  showPassword = false;

  // ── TOTP step ──────────────────────────────────────────────────────────────
  currentStep: 'credentials' | 'totp' = 'credentials';
  tempToken = '';
  totpDigits: string[] = ['', '', '', '', '', ''];
  totpTimer = 30;
  private timerInterval: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private initializeForm(): void {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  // ── Step 1 — Credentials ──────────────────────────────────────────────────
  onLogin(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.requires_totp && response.temp_token) {
          // → Switch to TOTP step
          this.tempToken = response.temp_token;
          this.currentStep = 'totp';
          this.startTimer();
          setTimeout(() => document.getElementById('digit-0')?.focus(), 100);
        } else if (response.success) {
          this.successMessage = 'Login successful! Redirecting…';
          setTimeout(() => this.router.navigate(['/dashboard']), 1200);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Login failed. Please try again.';
        this.captchaVerified = false;
        this.captchaRef?.refresh();
      }
    });
  }

  // ── Step 2 — TOTP ─────────────────────────────────────────────────────────
  onTotpInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const inputEvent = event as InputEvent;
    // Use event.data (the single char typed) to avoid re-trigger issues with input.value
    const char = (inputEvent.data ?? input.value).replace(/\D/g, '').slice(-1);
    this.totpDigits[index] = char;
    input.value = char; // correct display (e.g. if user typed a non-digit)

    if (char && index < 5) {
      (document.getElementById(`digit-${index + 1}`) as HTMLInputElement)?.focus();
    }

    if (this.totpDigits.every(d => d !== '')) {
      this.onVerifyTotp();
    }
  }

  onTotpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { this.totpDigits[i] = d; });
    const next = Math.min(digits.length, 5);
    (document.getElementById(`digit-${next}`) as HTMLInputElement)?.focus();
    if (digits.length === 6) this.onVerifyTotp();
  }

  onTotpKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.totpDigits[index] && index > 0) {
      this.totpDigits[index - 1] = '';
      (document.getElementById(`digit-${index - 1}`) as HTMLInputElement)?.focus();
    }
  }

  onVerifyTotp(): void {
    const code = this.totpDigits.join('');
    if (code.length !== 6) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.verifyTotp(this.tempToken, code).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success) {
          this.stopTimer();
          this.successMessage = 'Verified! Redirecting…';
          setTimeout(() => this.router.navigate(['/dashboard']), 1000);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.message || 'Invalid code. Please try again.';
        this.totpDigits = ['', '', '', '', '', ''];
        setTimeout(() => document.getElementById('digit-0')?.focus(), 100);
      }
    });
  }

  backToCredentials(): void {
    this.stopTimer();
    this.currentStep = 'credentials';
    this.tempToken = '';
    this.totpDigits = ['', '', '', '', '', ''];
    this.errorMessage = '';
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  private startTimer(): void {
    this.syncTimer();
    this.timerInterval = setInterval(() => {
      this.syncTimer();
      if (this.totpTimer === 30) {
        // New 30-second window — clear digits
        this.totpDigits = ['', '', '', '', '', ''];
        setTimeout(() => document.getElementById('digit-0')?.focus(), 50);
      }
    }, 1000);
  }

  private syncTimer(): void {
    this.totpTimer = 30 - (Math.floor(Date.now() / 1000) % 30);
  }

  private stopTimer(): void {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  get timerDashOffset(): number {
    const r = 20;
    const circumference = 2 * Math.PI * r;
    return circumference * (1 - this.totpTimer / 30);
  }

  get timerCircumference(): number {
    return 2 * Math.PI * 20;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  togglePassword(): void { this.showPassword = !this.showPassword; }
  fillDemoCredentials(): void { this.loginForm.setValue({ username: 'john_doe', password: 'password123' }); }
  onCancel(): void {
    this.loginForm.reset();
    this.errorMessage = '';
    this.successMessage = '';
    this.router.navigate(['/']);
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
}
