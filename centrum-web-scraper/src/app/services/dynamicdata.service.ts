import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class DynamicDataService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  public startPuppeteerSession(formData: FormData) {
    return this.http.post(`${this.baseUrl}/start-session`, formData, {
      reportProgress: true,
      observe: 'events',
    });
  }
}
