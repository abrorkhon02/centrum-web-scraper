import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { DynamicDataService } from '../../services/dynamicdata.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dynamic-search',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './dynamic-search.component.html',
  styleUrl: './dynamic-search.component.scss',
})
export class DynamicSearchComponent {
  webpages = [
    {
      name: 'Online-Centrum',
      url: 'https://online-centrum-holidays.com/search_tour',
    },
    { name: 'Kompastour', url: 'https://online.kompastour.kz/search_tour' },
    { name: 'Easy Tour', url: 'https://tours.easybooking.uz/search_tour' },
    { name: 'FS Travel Asia', url: 'https://b2b.fstravel.asia/search_tour' },
    {
      name: 'KAZ Union - INACTIVE',
      url: 'https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1',
    },
    {
      name: 'Prestige Online Uz',
      url: 'http://online.uz-prestige.com/search_tour',
    },
    { name: 'Asia Luxe - INACTIVE', url: 'https://asialuxe.uz/tours/' },
  ];
  selectedWebpage!: string;

  constructor(private interactionService: DynamicDataService) {}

  startInteraction(): void {
    if (this.selectedWebpage) {
      this.interactionService
        .startPuppeteerSession(this.selectedWebpage)
        .subscribe(
          (response) => {
            console.log('Puppeteer session started:', response);
          },
          (error) => {
            console.error('Error starting Puppeteer session:', error);
          }
        );
    }
  }
}
