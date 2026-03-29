import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  requires_totp?: boolean;
  temp_token?: string;
  token?: string;
  user?: { id: number; username: string; email: string; };
}

export interface TotpSetupResponse {
  success: boolean;
  secret: string;
  qr_code: string;
  manual_key: string;
}

export interface TotpStatusResponse {
  success: boolean;
  totp_enabled: boolean;
}

export interface RegisterPayload {
  firstName: string; lastName: string; email: string; username: string; password: string;
  street: string; city: string; state: string; country: string; zipCode: string;
  securityQuestion: string; securityAnswer: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  maskedEmail?: string;
  user?: { id: number; username: string; email: string; };
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  user?: { id: number; username: string; email: string; };
}

export interface ForgotLookupResponse {
  success: boolean;
  message?: string;
  security_question?: string;
}

export interface ForgotVerifyResponse {
  success: boolean;
  message?: string;
  reset_token?: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';

  private isLoggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<any>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

  /** Step 1 — verify credentials */
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (response.success && response.token && !response.requires_totp) {
          this.storeSession(response.token, response.user);
        }
      })
    );
  }

  /** Step 2 — verify TOTP code with temp_token */
  verifyTotp(tempToken: string, totpCode: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/verify-totp`, {
      temp_token: tempToken,
      totp_code: totpCode
    }).pipe(
      tap(response => {
        if (response.success && response.token) {
          this.storeSession(response.token, response.user);
        }
      })
    );
  }

  /** Register a new user (3-step form data) */
  register(payload: RegisterPayload): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, payload);
  }

  /** Verify 6-digit email code to finalise account creation */
  verifyEmail(email: string, code: string): Observable<VerifyEmailResponse> {
    return this.http.post<VerifyEmailResponse>(`${this.apiUrl}/verify-email`, { email, code });
  }

  /** Resend the verification code for a pending registration */
  resendVerificationCode(email: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/resend-verification`, { email });
  }

  /** Forgot password — Step 1: fetch security question for a username */
  lookupSecurityQuestion(username: string): Observable<ForgotLookupResponse> {
    return this.http.post<ForgotLookupResponse>(`${this.apiUrl}/forgot-password/lookup`, { username });
  }

  /** Forgot password — Step 2: verify security answer, get reset token */
  verifySecurityAnswer(username: string, securityAnswer: string): Observable<ForgotVerifyResponse> {
    return this.http.post<ForgotVerifyResponse>(`${this.apiUrl}/forgot-password/verify-answer`, { username, securityAnswer });
  }

  /** Forgot password — Step 3: set new password using reset token */
  resetPassword(resetToken: string, newPassword: string): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(`${this.apiUrl}/forgot-password/reset`, { reset_token: resetToken, newPassword });
  }

  /** Get QR code + secret for TOTP setup */
  setupTotp(): Observable<TotpSetupResponse> {
    return this.http.get<TotpSetupResponse>(`${this.apiUrl}/totp/setup`, { headers: this.authHeaders() });
  }

  /** Enable TOTP after verifying first code */
  enableTotp(secret: string, totpCode: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/totp/enable`, { secret, totp_code: totpCode }, { headers: this.authHeaders() });
  }

  /** Disable TOTP after verifying current code */
  disableTotp(totpCode: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/totp/disable`, { totp_code: totpCode }, { headers: this.authHeaders() });
  }

  /** Get TOTP enabled status for current user */
  getTotpStatus(): Observable<TotpStatusResponse> {
    return this.http.get<TotpStatusResponse>(`${this.apiUrl}/totp/status`, { headers: this.authHeaders() });
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.isLoggedInSubject.next(false);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean { return this.hasToken(); }
  getToken(): string | null { return localStorage.getItem('authToken'); }
  getCurrentUser() { return this.currentUserSubject.value; }

  private storeSession(token: string, user: any): void {
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.isLoggedInSubject.next(true);
    this.currentUserSubject.next(user);
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` });
  }

  private hasToken(): boolean { return !!localStorage.getItem('authToken'); }
  private getStoredUser() {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
}
