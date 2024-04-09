import { MatInputModule } from '@angular/material/input';
import {
  MatSelect,
  MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { HotelDataService, Hotel } from '../../services/hotel-data.service';
import { CommonModule } from '@angular/common';
import { tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-search-parameters',
  standalone: true,
  templateUrl: './search-parameters.component.html',
  styleUrls: ['./search-parameters.component.scss'],
  imports: [
    ReactiveFormsModule,
    CommonModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
  ],
})
export class SearchParametersComponent implements OnInit {
  @ViewChild('hotelSelect')
  hotelSelect!: MatSelect;
  protected searchForm!: FormGroup;
  protected hotels: Hotel[] = [];
  protected nightOptions: number[] = [];
  protected filteredHotels: Hotel[] = [];
  protected countries = [{ label: 'ОАЭ', value: 'uae' }];
  protected starRatings = [
    { name: '2*', value: '2', selected: false },
    { name: '3*', value: '3', selected: false },
    { name: '4*', value: '4', selected: false },
    { name: '5*', value: '5', selected: false },
  ];
  protected meals: any[] = [
    { name: 'AI', selected: false },
    { name: 'BB', selected: false },
    { name: 'FB', selected: false },
    { name: 'HB', selected: false },
    { name: 'Only Room', selected: false },
  ];

  protected roomTypes: any[] = [
    { name: 'Standard Room', selected: false },
    { name: 'Superior Room', selected: false },
    { name: 'Все', selected: false },
  ];

  protected cities = [
    { label: 'Абу-Даби', value: 'abu-dhabi' },
    { label: 'Аджман', value: 'ajman' },
    { label: 'Дубай', value: 'dubai' },
    { label: 'Фуджейра', value: 'fujairah' },
    { label: 'Рас-аль-Хайма', value: 'ras-al-khaimah' },
    { label: 'Шарджа', value: 'sharjah' },
    { label: 'Умм-аль-Кувейн', value: 'umm-al-quwain' },
  ];

  protected filterOptions = [
    { label: 'Дети на отдельной кровати', value: 'Дети на отдельной кровати' },
    { label: 'Есть места на рейсы', value: 'Есть места на рейсы' },
    {
      label: 'Места повышенной комфортности',
      value: 'Места повышенной комфортности',
    },
    { label: 'Нет остановки продажи', value: 'Нет остановки продажи' },
    { label: 'Мгновенное подтверждение', value: 'Мгновенное подтверждение' },
    { label: 'Не отображать PROMO', value: 'Не отображать PROMO' },
  ];

  constructor(
    private fb: FormBuilder,
    private hotelDataService: HotelDataService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.fetchHotels();
    this.initializeFilters();
    this.hotelStarsFormArray.valueChanges.subscribe((values) => {
      console.log('Star ratings changed:', values);
      this.filterHotelsByStarRating(values);
    });
  }

  ngAfterViewInit(): void {
    if (this.hotelSelect) {
      this.hotelSelect.open();
    }
  }

  private initializeFilters() {
    const filters = this.filterOptions.map((option) => option.value);
    this.searchForm.get('filters')?.setValue(filters);
  }

  private initializeForm() {
    this.searchForm = this.fb.group({
      departureCity: ['', Validators.required],
      country: ['', Validators.required],
      departureDate: ['', Validators.required],
      returnDate: ['', Validators.required],
      nightsFrom: ['', Validators.required],
      nightsTo: ['', Validators.required],
      adults: [1, [Validators.required, Validators.min(1)]],
      children: [0, Validators.min(0)],
      childrenAges: this.fb.array([]),
      hotelStars: this.buildFormArray(this.starRatings),
      hotels: this.buildFormArray([]),
      selectedHotel: ['', Validators.required],
      mealTypes: this.buildFormArray(this.meals),
      roomTypes: this.buildFormArray(this.roomTypes),
      cities: this.buildFormArray(this.cities),
      hotelCategories: new FormArray([]),
      priceRange: this.fb.group({
        minPrice: ['', [Validators.required, Validators.min(0)]],
        maxPrice: ['', [Validators.required, Validators.min(0)]],
      }),
      filters: [],
    });
    const hotelStarsControls = this.starRatings.map((starRating) =>
      this.fb.control(starRating.selected)
    );
    this.searchForm.setControl('hotelStars', this.fb.array(hotelStarsControls));
    this.nightOptions = [3, 4, 7, 10, 11, 14];
    this.searchForm.patchValue({
      nightsFrom: this.nightOptions[0],
      nightsTo: this.nightOptions[0],
    });
    this.searchForm.setControl(
      'hotelStars',
      this.buildFormArray(this.starRatings)
    );
    this.searchForm.setControl('hotels', this.buildFormArray([]));
    this.searchForm.setControl('cities', this.buildFormArray(this.cities));
    this.searchForm.setControl('meals', this.buildFormGroupArray(this.meals));
    this.searchForm.setControl(
      'roomTypes',
      this.buildFormGroupArray(this.roomTypes)
    );
    this.setInitialChildrenAges(this.searchForm.get('children')?.value);
  }

  private buildFormArray(items: any[]): FormArray {
    return this.fb.array(items.map(() => this.fb.control(false)));
  }

  private buildFormGroupArray(items: any[]): FormArray {
    return new FormArray(
      items.map((item) =>
        this.fb.group({
          name: [item.name],
          selected: [item.selected],
        })
      )
    );
  }

  protected searchHotels(event: Event) {
    this.hotelSelect.open();
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value.trim().toLowerCase();
    console.log('Afterwards' + this.hotels);

    if (!value) {
      this.filteredHotels = this.hotels.slice();
      return;
    }

    this.filteredHotels = this.hotels.filter((hotel) =>
      hotel.name.toLowerCase().includes(value)
    );
  }

  private filterHotelsByStarRating(starRatings: boolean[]): void {
    const selectedRatings = this.starRatings
      .filter((_, index) => starRatings[index])
      .map((rating) => rating.value.toString());

    this.filteredHotels = this.hotels.filter(
      (hotel) =>
        hotel.starRating !== undefined &&
        selectedRatings.includes(hotel.starRating.toString())
    );
  }

  private fetchHotels() {
    this.hotelDataService
      .getHotels()
      .pipe(
        tap({
          next: (data: string[]) => {
            // Regex to match the star ratings at the end of hotel names
            const starRatingRegex = /\s*(\*+)$/;
            this.hotels = data.map((name) => {
              const match = name.match(starRatingRegex);
              const rating = match ? match[1].length : undefined;
              return { name, selected: false, starRating: rating };
            });
            this.filteredHotels = this.hotels.slice();
            this.initializeHotelFormArray();
          },
          error: (error) => console.error('Error fetching hotels:', error),
          complete: () => console.log('Hotel fetching completed.'),
        })
      )
      .subscribe();
  }

  private initializeHotelFormArray() {
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    hotelsFormArray.clear();
    this.hotels.forEach((hotel) =>
      hotelsFormArray.push(this.fb.control(hotel.selected))
    );
    console.log('Hotels Form Array initialized:', hotelsFormArray.value);
  }

  protected checkAllHotels(): void {
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    this.hotels.forEach((hotel, index) => {
      hotel.selected = true; // Update the internal model
      hotelsFormArray.at(index).setValue(true); // Update the form control
    });
  }

  protected uncheckAllHotels(): void {
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    this.hotels.forEach((hotel, index) => {
      hotel.selected = false; // Update the internal model
      hotelsFormArray.at(index).setValue(false); // Update the form control
    });
  }

  private updateHotelSelectionState(selected: boolean) {
    // Update the internal model
    this.hotels.forEach((hotel) => (hotel.selected = selected));
    // Update the form array controls with the new selected state
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    hotelsFormArray.clear();
    this.hotels.forEach((hotel) => {
      hotelsFormArray.push(this.fb.control(hotel.selected));
    });
  }

  private setInitialChildrenAges(count: number): void {
    const childrenAgesArray = this.searchForm.get('childrenAges') as FormArray;
    childrenAgesArray.clear();

    for (let i = 0; i < count; i++) {
      childrenAgesArray.push(
        this.fb.group({
          age: this.fb.control('', Validators.required),
        })
      );
    }
  }

  protected onChildrenCountChanged(event: MatSelectChange): void {
    const newCount = event.value ? parseInt(event.value, 10) : 0;
    this.setInitialChildrenAges(newCount);
  }

  get childrenAges(): FormArray {
    return this.searchForm.get('childrenAges') as FormArray;
  }

  get hotelStarsFormArray(): FormArray {
    return this.searchForm.get('hotelStars') as FormArray;
  }

  get hotelCategories() {
    return this.searchForm.get('hotelCategories') as FormArray;
  }

  get mealTypesFormArray(): FormArray {
    return this.searchForm.get('mealTypes') as FormArray;
  }

  get roomTypesFormArray(): FormArray {
    return this.searchForm.get('roomTypes') as FormArray;
  }

  protected onSubmit() {
    if (this.searchForm.valid) {
      console.log(this.searchForm.value);
    }
  }

  protected onReset() {
    this.searchForm.reset();
  }
}
