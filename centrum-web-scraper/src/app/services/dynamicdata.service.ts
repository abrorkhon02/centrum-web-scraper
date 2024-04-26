import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class DynamicDataService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  startPuppeteerSession(webpageUrl: string) {
    return this.http.post(`${this.baseUrl}/start-session`, { url: webpageUrl });
  }
}
