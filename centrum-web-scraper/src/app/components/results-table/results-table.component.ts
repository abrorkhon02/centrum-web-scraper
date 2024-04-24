import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';
import { DynamicDataService } from '../../services/dynamicdata.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dynamic-search',
  standalone: true,

  imports: [ReactiveFormsModule, CommonModule, ReactiveFormsModule],
  templateUrl: './results-table.component.html',
  styleUrl: './results-table.component.scss',
})
export class DynamicSearchComponent implements OnInit {
  protected searchForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dataService: DynamicDataService
  ) {}

  ngOnInit(): void {
    this.searchForm = this.fb.group({
      country: [''],
      cities: this.fb.array([]),
      tourType: [''],
    });
  }

  onCountryChange(): void {
    const country = this.searchForm.get('country')?.value;
    if (country) {
      this.dataService.getCitiesByCountry(country).subscribe((cities) => {
        this.updateCitySelector(cities);
      });
    }
  }

  updateCitySelector(cities: any[]): void {
    const cityArray = this.searchForm.get('cities') as FormArray;
    cityArray.clear();
    cities.forEach((city) => {
      cityArray.push(this.fb.control(city.name));
    });
  }

  onSubmit(): void {
    if (this.searchForm.valid) {
      const formData = this.prepareFormData(this.searchForm.value);
      this.dataService.sendFormData(formData).subscribe({
        next: (response: any) => {
          console.log('Form submission successful', response);
        },
        error: (error: any) => {
          console.error('Form submission failed', error);
        },
      });
    } else {
      console.error('Form is not valid');
    }
  }

  prepareFormData(data: any): any {
    return {
      ...data,
      cities: data.cities.join(', '),
    };
  }
}
