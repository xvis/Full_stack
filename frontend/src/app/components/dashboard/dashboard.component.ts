import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TotpSetupComponent } from '../totp-setup/totp-setup.component';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TotpSetupComponent, HeaderComponent, FooterComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentUser: any = null;
  mfaEnabled = false;

  // Modal state: null = closed, 'enable' | 'disable' = open
  mfaModal: 'enable' | 'disable' | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.loadMfaStatus();
  }

  private loadMfaStatus(): void {
    this.authService.getTotpStatus().subscribe({
      next: (res) => { this.mfaEnabled = res.totp_enabled; },
      error: () => { this.mfaEnabled = false; }
    });
  }

  openMfaModal(mode: 'enable' | 'disable'): void {
    this.mfaModal = mode;
  }

  onMfaModalClosed(completed: boolean): void {
    this.mfaModal = null;
    if (completed) this.loadMfaStatus();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

