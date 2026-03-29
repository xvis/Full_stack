import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { CaptchaComponent } from '../captcha/captcha.component';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('newPassword')?.value;
  const cpw = group.get('confirmPassword')?.value;
  if (pw && cpw && pw !== cpw) {
    group.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FooterComponent, RouterLink, CaptchaComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent implements OnInit {
  @ViewChild('fpCaptcha') captchaRef?: CaptchaComponent;
  currentStep = 1;
  isLoading   = false;
  errorMessage   = '';
  successMessage = '';
  captchaVerified = false;

  // Step 1
  step1!: FormGroup;

  // Step 2
  step2!: FormGroup;
  securityQuestion = '';

  // Step 3
  step3!: FormGroup;
  showPassword        = false;
  showConfirmPassword = false;

  // Token issued after step 2
  private resetToken = '';

  // Username preserved across steps
  private resolvedUsername = '';

  readonly steps = [
    { num: 1, label: 'Find Account' },
    { num: 2, label: 'Verify Identity' },
    { num: 3, label: 'New Password' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.step1 = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]]
    });

    this.step2 = this.fb.group({
      securityAnswer: ['', [Validators.required, Validators.minLength(2)]]
    });

    this.step3 = this.fb.group({
      newPassword:     ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: passwordMatchValidator });
  }

  // ── Step 1 — Lookup ────────────────────────────────────────────────────────
  onLookup(): void {
    if (this.step1.invalid) { this.touchAll(this.step1); return; }
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.lookupSecurityQuestion(this.step1.value.username).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.resolvedUsername = this.step1.value.username;
        this.securityQuestion = res.security_question!;
        this.currentStep = 2;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'No account found with that username.';
        this.captchaVerified = false;
        this.captchaRef?.refresh();
      }
    });
  }

  // ── Step 2 — Verify answer ─────────────────────────────────────────────────
  onVerifyAnswer(): void {
    if (this.step2.invalid) { this.touchAll(this.step2); return; }
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.verifySecurityAnswer(this.resolvedUsername, this.step2.value.securityAnswer).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.resetToken = res.reset_token!;
        this.currentStep = 3;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Incorrect answer. Please try again.';
        this.step2.get('securityAnswer')?.reset();
      }
    });
  }

  // ── Step 3 — Reset password ────────────────────────────────────────────────
  onResetPassword(): void {
    if (this.step3.invalid) { this.touchAll(this.step3); return; }
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.resetPassword(this.resetToken, this.step3.value.newPassword).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Password updated! Redirecting to sign in…';
        setTimeout(() => this.router.navigate(['/login']), 2200);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Reset failed. Please start over.';
        if (err.status === 401) {
          // Token expired — restart
          setTimeout(() => { this.currentStep = 1; this.errorMessage = 'Session expired. Please start over.'; }, 1500);
        }
      }
    });
  }

  prev(): void {
    if (this.currentStep > 1) { this.currentStep--; this.errorMessage = ''; }
  }

  togglePassword(): void        { this.showPassword = !this.showPassword; }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  private touchAll(form: FormGroup): void {
    Object.values(form.controls).forEach(c => c.markAsTouched());
  }

  get f1() { return this.step1.controls; }
  get f2() { return this.step2.controls; }
  get f3() { return this.step3.controls; }

  get passwordStrength(): { label: string; level: number } {
    const pw = (this.f3['newPassword'].value as string) ?? '';
    if (!pw) return { label: '', level: 0 };
    let score = 0;
    if (pw.length >= 8)           score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^A-Za-z0-9]/.test(pw))  score++;
    return { label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score], level: score };
  }

  get pwHasLength():  boolean { return (this.f3['newPassword'].value?.length ?? 0) >= 8; }
  get pwHasUpper():   boolean { return /[A-Z]/.test(this.f3['newPassword'].value ?? ''); }
  get pwHasNumber():  boolean { return /[0-9]/.test(this.f3['newPassword'].value ?? ''); }
  get pwHasSpecial(): boolean { return /[^A-Za-z0-9]/.test(this.f3['newPassword'].value ?? ''); }
}
