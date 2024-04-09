import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class HotelDataService {
  private jsonUrl = 'assets/hotels.json';

  constructor(private http: HttpClient) {}

  getHotels(): Observable<string[]> {
    return this.http.get<string[]>(this.jsonUrl);
  }
}

export interface Hotel {
  name: string;
  selected: boolean;
  starRating?: number;
}
