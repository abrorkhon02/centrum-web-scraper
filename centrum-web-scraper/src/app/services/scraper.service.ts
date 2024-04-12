import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScraperService {
  constructor(private http: HttpClient) {}

  // Endpoint URL for searching
  private searchUrl = 'http://localhost:3000/api/search';

  // Endpoint URL for scraping hotels
  private scrapeUrl = 'http://localhost:3000/api/scrape-hotels';

  // Method to send search parameters to the backend
  public sendSearchData(searchPayload: any): Observable<any> {
    return this.http.post(this.searchUrl, searchPayload).pipe(
      tap((response) => {
        console.log('Response from server:', response);
      }),
      catchError((error) => {
        console.error('Error received:', error);
        throw error;
      })
    );
  }

  // Method to trigger the scraping process from the backend
  public scrapeHotels(): Observable<any> {
    return this.http.get(this.scrapeUrl);
  }
}
