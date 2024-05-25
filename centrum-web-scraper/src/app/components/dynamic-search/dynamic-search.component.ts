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
    { name: 'Kompastour', url: 'https://online.kompastour.kz/search_tour' },
    { name: 'Easy Tour', url: 'https://tours.easybooking.uz/search_tour' },
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
