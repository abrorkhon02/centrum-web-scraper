import { Component } from '@angular/core';
import { DynamicDataService } from '../../services/dynamicdata.service';
import { HttpEventType } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dynamic-search',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './dynamic-search.component.html',
  styleUrls: ['./dynamic-search.component.scss'],
})
export class DynamicSearchComponent {
  protected webpages = [
    {
      name: 'Online-Centrum',
      url: 'https://online-centrum-holidays.com/search_tour',
    },
    { name: 'Kompastour', url: 'https://online.kompastour.kz/search_tour' },
    { name: 'Easybooking', url: 'https://tours.easybooking.uz/search_tour' },
    { name: 'FunSun', url: 'https://b2b.fstravel.asia/search_tour' },
    { name: 'PrestigeUz', url: 'http://online.uz-prestige.com/search_tour' },
    {
      name: 'KAZ Union/INACTIVE!',
      url: 'https://uae.kazunion.com/Kazunion/SearchPackage?isFHome=1',
    },
    { name: 'Asia Luxe/INACTIVE!', url: 'https://asialuxe.uz/tours/' },
  ];
  protected selectedWebpage: string = '';
  protected selectedFile: File | null = null;
  protected selectedFileName: string | null = null;
  protected updateMode: boolean = false;
  protected formHasErrors: boolean = false;
  protected isLoading: boolean = false;
  protected isSent: boolean = false;

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

  protected startInteraction(event: Event): void {
    event.preventDefault();
    this.formHasErrors = false;

    if (!this.selectedWebpage || !this.selectedFile) {
      this.formHasErrors = true;
      return;
    }

    this.isLoading = true;
    this.isSent = false;

    const formData = new FormData();
    formData.append('url', this.selectedWebpage);
    formData.append('file', this.selectedFile);
    formData.append('updateMode', this.updateMode.toString());

    this.interactionService.startPuppeteerSession(formData).subscribe(
      (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = Math.round((100 * event.loaded) / event.total!);
          console.log(`Current progress: ${progress}%`);
        } else if (event.type === HttpEventType.Response) {
          console.log('Puppeteer session started:', event.body);
          this.isSent = true;
          this.isLoading = false;
        }
      },
      (error) => {
        console.error('Error starting Puppeteer session:', error);
        this.isLoading = false;
      }
    );
  }
}
