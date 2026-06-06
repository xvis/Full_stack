import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  label: string;
  flag: string;
}

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.css'
})
export class LanguageSwitcherComponent {
  isOpen = false;

  readonly languages: Language[] = [
    { code: 'en', label: 'English',  flag: '🇬🇧' },
    { code: 'es', label: 'Español',  flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
    { code: 'nl', label: 'Dutch',    flag: '🇳🇱' }
  ];

  constructor(private translate: TranslateService) {}

  get current(): Language {
    return this.languages.find(l => l.code === this.translate.currentLang)
        || this.languages[0];
  }

  toggle(): void { this.isOpen = !this.isOpen; }

  select(lang: Language): void {
    this.translate.use(lang.code);
    localStorage.setItem('nexaflow_lang', lang.code);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    const el = event.target as HTMLElement;
    if (!el.closest('.lang-switcher')) this.isOpen = false;
  }
}
