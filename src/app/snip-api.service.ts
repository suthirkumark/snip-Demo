import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SnipLink {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SnipApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000';

  listLinks(): Observable<SnipLink[]> {
    return this.http.get<SnipLink[]>(`${this.baseUrl}/api/links`);
  }

  createLink(url: string): Observable<SnipLink> {
    return this.http.post<SnipLink>(`${this.baseUrl}/api/links`, { url });
  }
}
