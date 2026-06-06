import { Component, OnInit, OnDestroy, QueryList, ViewChild, ViewChildren, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl, FormBuilder, FormGroup,
  ReactiveFormsModule, ValidationErrors, Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CaptchaComponent } from '../captcha/captcha.component';
import { TranslateModule } from '@ngx-translate/core';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  if (pw && cpw && pw !== cpw) {
    group.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FooterComponent, RouterLink, CaptchaComponent, TranslateModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit, OnDestroy {
  @ViewChild('regCaptcha') captchaRef?: CaptchaComponent;
  @ViewChildren('codeInput') codeInputRefs!: QueryList<ElementRef<HTMLInputElement>>;
  currentStep = 1;
  isLoading   = false;
  errorMessage   = '';
  successMessage = '';
  captchaVerified = false;
  showPassword        = false;
  showConfirmPassword = false;

  // Email verification (step 4)
  pendingEmail    = '';
  maskedEmail     = '';
  codeDigits      = ['', '', '', '', '', ''];
  resendCountdown = 0;
  private resendInterval: ReturnType<typeof setInterval> | null = null;

  step1!: FormGroup;
  step2!: FormGroup;
  step3!: FormGroup;
  step4!: FormGroup;

  readonly securityQuestions = [
    "What was the name of your first pet?",
    "What city were you born in?",
    "What is your mother's maiden name?",
    "What was the name of your elementary school?",
    "What was the make and model of your first car?",
    "What is the name of the street you grew up on?",
    "What was your childhood nickname?"
  ];

  readonly steps = [
    { num: 1, label: 'register.step1Label' },
    { num: 2, label: 'register.step2Label' },
    { num: 3, label: 'register.step3Label' },
    { num: 4, label: 'register.step4Label' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.step1 = this.fb.group({
      firstName:       ['', [Validators.required, Validators.minLength(2)]],
      lastName:        ['', [Validators.required, Validators.minLength(2)]],
      email:           ['', [Validators.required, Validators.email]],
      username:        ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      password:        ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator });

    this.step2 = this.fb.group({
      street:  ['', [Validators.required, Validators.minLength(5)]],
      city:    ['', [Validators.required, Validators.minLength(2)]],
      state:   ['', [Validators.required, Validators.minLength(2)]],
      country: ['', [Validators.required, Validators.minLength(2)]],
      zipCode: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z\- ]{3,10}$/)]]
    });

    this.step3 = this.fb.group({
      securityQuestion: ['', Validators.required],
      securityAnswer:   ['', [Validators.required, Validators.minLength(2)]]
    });

    this.step4 = this.fb.group({ _placeholder: [''] });
  }

  ngOnDestroy(): void {
    if (this.resendInterval) clearInterval(this.resendInterval);
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  next(): void {
    const form = this.currentForm;
    if (form.valid) {
      this.errorMessage = '';
      this.currentStep++;
    } else {
      this.touchAll(form);
    }
  }

  prev(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.errorMessage = '';
      if (this.currentStep === 3) {
        this.captchaVerified = false;
        this.captchaRef?.refresh();
      }
    }
  }

  // ── Step 3 submit: validate & send verification email ────────────────────
  onSendCode(): void {
    if (this.step3.invalid) { this.touchAll(this.step3); return; }
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register({
      firstName:        this.step1.value.firstName,
      lastName:         this.step1.value.lastName,
      email:            this.step1.value.email,
      username:         this.step1.value.username,
      password:         this.step1.value.password,
      street:           this.step2.value.street,
      city:             this.step2.value.city,
      state:            this.step2.value.state,
      country:          this.step2.value.country,
      zipCode:          this.step2.value.zipCode,
      securityQuestion: this.step3.value.securityQuestion,
      securityAnswer:   this.step3.value.securityAnswer
    }).subscribe({
      next: (res) => {
        this.isLoading     = false;
        this.pendingEmail  = this.step1.value.email;
        this.maskedEmail   = res.maskedEmail || this.step1.value.email;
        this.codeDigits    = ['', '', '', '', '', ''];
        this.currentStep   = 4;
        this.startResendTimer();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Registration failed. Please try again.';
        this.captchaVerified = false;
        this.captchaRef?.refresh();
      }
    });
  }

  // ── Step 4: verify code & create account ──────────────────────────────────
  onVerifyEmail(): void {
    const code = this.codeDigits.join('');
    if (code.length < 6) return;
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.verifyEmail(this.pendingEmail, code).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Email verified! Redirecting to sign in…';
        setTimeout(() => this.router.navigate(['/login']), 2200);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Invalid or expired code. Please try again.';
        this.codeDigits = ['', '', '', '', '', ''];
        setTimeout(() => this.codeInputRefs?.first?.nativeElement?.focus(), 50);
      }
    });
  }

  resendCode(): void {
    this.errorMessage = '';
    this.authService.resendVerificationCode(this.pendingEmail).subscribe({
      next: () => {
        this.codeDigits = ['', '', '', '', '', ''];
        this.startResendTimer();
        setTimeout(() => this.codeInputRefs?.first?.nativeElement?.focus(), 50);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Could not resend code. Please try again.';
      }
    });
  }

  onCodeDigit(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val   = input.value.replace(/\D/g, '').slice(-1);
    this.codeDigits[index] = val;
    input.value = val;
    if (val && index < 5) {
      this.codeInputRefs.toArray()[index + 1]?.nativeElement?.focus();
    }
    if (this.codeDigits.join('').length === 6) {
      this.onVerifyEmail();
    }
  }

  onCodeKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (this.codeDigits[index]) {
        this.codeDigits[index] = '';
        (event.target as HTMLInputElement).value = '';
      } else if (index > 0) {
        this.codeInputRefs.toArray()[index - 1]?.nativeElement?.focus();
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  get currentForm(): FormGroup {
    return [this.step1, this.step2, this.step3, this.step4][this.currentStep - 1];
  }

  private touchAll(form: FormGroup): void {
    Object.values(form.controls).forEach(c => c.markAsTouched());
  }

  private startResendTimer(): void {
    if (this.resendInterval) clearInterval(this.resendInterval);
    this.resendCountdown = 60;
    this.resendInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        clearInterval(this.resendInterval!);
        this.resendInterval = null;
      }
    }, 1000);
  }

  togglePassword(): void        { this.showPassword = !this.showPassword; }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  // convenience getters
  get f1() { return this.step1.controls; }
  get f2() { return this.step2.controls; }
  get f3() { return this.step3.controls; }

  get passwordStrength(): { label: string; level: number } {
    const pw = this.f1['password'].value as string ?? '';
    if (!pw) return { label: '', level: 0 };
    let score = 0;
    if (pw.length >= 8)  score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { label: labels[score], level: score };
  }
}
