import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SnipApiService, SnipLink } from './snip-api.service';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly api = inject(SnipApiService);

  readonly urlInput = signal('');
  readonly links = signal<SnipLink[]>([]);
  readonly createdLink = signal<SnipLink | null>(null);
  readonly errorMessage = signal('');
  readonly loading = signal(false);
  readonly submitting = signal(false);

  ngOnInit(): void {
    this.refreshLinks();
  }

  onUrlInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.urlInput.set(input.value);
  }

  submitLink(event: Event): void {
    event.preventDefault();
    this.errorMessage.set('');
    this.createdLink.set(null);

    const candidate = this.urlInput().trim();
    if (!this.isValidHttpUrl(candidate)) {
      this.errorMessage.set('Please enter a valid http:// or https:// URL.');
      return;
    }

    this.submitting.set(true);
    this.api.createLink(candidate).subscribe({
      next: (link) => {
        this.createdLink.set(link);
        this.urlInput.set('');
        this.refreshLinks();
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.extractError(err));
        this.submitting.set(false);
      },
      complete: () => {
        this.submitting.set(false);
      },
    });
  }

  private refreshLinks(): void {
    this.loading.set(true);
    this.api.listLinks().subscribe({
      next: (items) => {
        this.links.set(items);
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.extractError(err));
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private extractError(err: HttpErrorResponse): string {
    if (typeof err.error?.error === 'string') {
      return err.error.error;
    }

    if (err.status === 0) {
      return 'Cannot reach backend at http://localhost:3000.';
    }

    return 'Request failed. Please try again.';
  }
}
