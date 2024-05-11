import { Component } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DynamicDataService } from '../../services/dynamicdata.service';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';

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
  protected webpages = [
    {
      name: 'Online-Centrum',
      url: 'https://online-centrum-holidays.com/search_tour',
    },
    // {
    //   name: 'Online-Centrum Отели',
    //   url: 'https://online-centrum-holidays.com/search_hotel?CHECKIN_BEG=20240429&NIGHTS_FROM=7&CHECKIN_END=20240502&NIGHTS_TILL=7&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&CHILD_IN_BED=0&FREIGHT=1&COMFORTABLE_SEATS=0&FILTER=0&MOMENT_CONFIRM=0&WITHOUT_PROMO=0&UFILTER=',
    // },
    // {
    //   name: 'Online-Centrum Экскурсионные туры',
    //   url: 'https://online-centrum-holidays.com/search_excursion?CHECKIN_BEG=20240506&NIGHTS_FROM=7&CHECKIN_END=20240507&NIGHTS_TILL=7&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&CHILD_IN_BED=0&FREIGHT=1&COMFORTABLE_SEATS=0&FILTER=0&MOMENT_CONFIRM=0&WITHOUT_PROMO=0&UFILTER=',
    // },

    { name: 'Kompastour', url: 'https://online.kompastour.kz/search_tour' },
    // {
    //   name: 'Kompastour Отели',
    //   url: 'https://online.kompastour.kz/search_hotel?FREIGHTTYPE=0&PROGRAMGROUPINC=0&CHECKIN_BEG=20240503&NIGHTS_FROM=2&CHECKIN_END=20240505&NIGHTS_TILL=21&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&FREIGHT=0&FILTER=0&MOMENT_CONFIRM=0&UFILTER=',
    // },
    // {
    //   name: 'Kompastour Экскурсионные туры',
    //   url: 'https://online.kompastour.kz/search_excursion?PROGRAMGROUPINC=0&CHECKIN_BEG=20240503&NIGHTS_FROM=2&CHECKIN_END=20240505&NIGHTS_TILL=21&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&FILTER=0&MOMENT_CONFIRM=0&UFILTER=',
    // },
    { name: 'Easy Tour', url: 'https://tours.easybooking.uz/search_tour' },
    // {
    //   name: 'Easy Tour Отели',
    //   url: 'https://tours.easybooking.uz/search_hotel?CHECKIN_BEG=20240525&NIGHTS_FROM=7&CHECKIN_END=20240601&NIGHTS_TILL=8&ADULT=2&CURRENCY=2&CHILD=0&TOWNS_ANY=1&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=&MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&CHILD_IN_BED=0&FREIGHT=0&COMFORTABLE_SEATS=0&FILTER=0&MOMENT_CONFIRM=0',
    // },

    { name: 'FS Travel Asia', url: 'https://b2b.fstravel.asia/search_tour' },
    {
      name: 'Prestige Online Uz',
      url: 'http://online.uz-prestige.com/search_tour',
    },
    {
      name: 'KAZ Union - INACTIVE',
      url: 'https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1',
    },
    { name: 'Asia Luxe - INACTIVE', url: 'https://asialuxe.uz/tours/' },
  ];
  protected selectedWebpage!: string;
  protected selectedFile: File | null = null;
  protected selectedFileName: string | null = null;

  constructor(private interactionService: DynamicDataService) {}

  protected onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const maxLength = 45;
      this.selectedFileName =
        file.name.length > maxLength
          ? file.name.substring(0, maxLength - 3) + '...'
          : file.name;
    } else {
      this.selectedFileName = null;
      this.selectedFile = null;
    }
  }

  protected startInteraction(): void {
    if (this.selectedWebpage && this.selectedFile) {
      const formData = new FormData();
      formData.append('url', this.selectedWebpage);
      formData.append('file', this.selectedFile);
      console.log(formData);

      this.interactionService.startPuppeteerSession(formData).subscribe(
        (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            const progress = Math.round((100 * event.loaded) / event.total!);
            console.log(`Current progress: ${progress}%`);
          } else if (event.type === HttpEventType.Response) {
            console.log('Puppeteer session started:', event.body);
          }
        },
        (error) => console.error('Error starting Puppeteer session:', error)
      );
    }
  }
}
