import { MatInputModule } from '@angular/material/input';
import {
  MatSelect,
  MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
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
import { ScraperService } from '../../services/scraper.service';

interface TourType {
  value: string;
  label: string;
}

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
  protected isHotelDropdownDisabled: boolean = false;
  protected searchForm!: FormGroup;
  protected hotels: Hotel[] = [];
  protected nightOptions: number[] = [];
  protected filteredHotels: Hotel[] = [];
  protected countries = [
    { label: 'ОАЭ', value: 'uae' },
    { label: 'Грузия', value: 'georgia' },
  ];
  protected uaeTours: TourType[] = [
    { value: '----', label: '----' },
    {
      value: 'ОАЭ: block Centrum Air (O01-0A05)',
      label: 'ОАЭ: block Centrum Air (O01-0A05)',
    },
    {
      value: 'ОАЭ: block Centrum Air - Dynamic Price (O01-0A05)',
      label: 'ОАЭ: block Centrum Air - Dynamic Price (O01-0A05)',
    },
  ];

  protected georgianTours: TourType[] = [
    { value: '----', label: '----' },
    {
      value: 'Грузия: block Centrum Air, прилет в Батуми (G01-0A18)',
      label: 'Грузия: block Centrum Air, прилет в Батуми (G01-0A18)',
    },
    {
      value: 'Грузия: block Centrum Air, прилет в Батуми (G01-0A19)',
      label: 'Грузия: block Centrum Air, прилет в Батуми (G01-0A19)',
    },
    {
      value: 'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A18)',
      label: 'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A18)',
    },
    {
      value: 'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A19)',
      label: 'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A19)',
    },
    {
      value: 'Грузия: лечебный тур, прилет в Батуми (G01-0A18)',
      label: 'Грузия: лечебный тур, прилет в Батуми (G01-0A18)',
    },
    {
      value: 'Грузия: лечебный тур, прилет в Тбилиси (G01-0A18)',
      label: 'Грузия: лечебный тур, прилет в Тбилиси (G01-0A18)',
    },
  ];

  protected tours: TourType[] = [];

  protected tourNightOptions: { [key: string]: number[] } = {
    default: Array.from({ length: 31 }, (_, i) => i + 1),
    'ОАЭ: block Centrum Air (O01-0A05)': [4, 7, 11, 14],
    '----': Array.from({ length: 14 }, (_, i) => i + 1),
    'Грузия: ----': [3, 4, 7, 10],
    'Грузия: block Centrum Air, прилет в Батуми (G01-0A18)': [3, 7, 10, 14],
    'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A18)': [3, 7, 10, 14],
    'Грузия: block Centrum Air, прилет в Батуми (G01-0A19)': [3, 7, 10],
    'Грузия: block Centrum Air, прилет в Тбилиси (G01-0A19)': [3, 7, 10],
    'Грузия: лечебный тур, прилет в Батуми (G01-0A18)': [3, 7, 10],
    'Грузия: лечебный тур, прилет в Тбилиси (G01-0A18)': [3, 7, 10],
  };

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

  protected cities: any[] = [];

  protected uaecities = [
    { label: 'Абу-Даби', value: 'abu-dhabi' },
    { label: 'Аджман', value: 'ajman' },
    { label: 'Дубай', value: 'dubai' },
    { label: 'Фуджейра', value: 'fujairah' },
    { label: 'Рас-аль-Хайма', value: 'ras-al-khaimah' },
    { label: 'Шарджа', value: 'sharjah' },
    { label: 'Умм-аль-Кувейн', value: 'umm-al-quwain' },
  ];

  protected georgiancities = [
    { label: 'Аджария', value: '1845' },
    { label: 'Батуми', value: '1837' },
    { label: 'Чакви', value: '1841' },
    { label: 'Гонио', value: '2156' },
    { label: 'Кобулети', value: '2671' },
    { label: 'Квариати', value: '2157' },
    { label: 'Мцване Концхи', value: '2669' },
    { label: 'Квишхети', value: '2683' },
    { label: 'Уреки', value: '2159' },
    { label: 'Гудаури', value: '2121' },
    { label: 'Гурджаани', value: '2687' },
    { label: 'Вазисубани', value: '2686' },
    { label: 'Кутаиси', value: '2127' },
    { label: 'Саирме', value: '2134' },
    { label: 'Цхалтубо', value: '2142' },
    { label: 'Казбеги', value: '2123' },
    { label: 'Кварели', value: '2677' },
    { label: 'Лагодехи', value: '2689' },
    { label: 'Мцхета', value: '2688' },
    { label: 'Местиа', value: '2672' },
    { label: 'Зугдиди', value: '2122' },
    { label: 'Ахалцихе', value: '2690' },
    { label: 'Бакуриани', value: '2118' },
    { label: 'Боржоми', value: '2119' },
    { label: 'Шекветили', value: '2673' },
    { label: 'Сити Центр', value: '2662' },
    { label: 'Старый Тбилиси', value: '2666' },
    { label: 'Тбилиси', value: '1843' },
    { label: 'Цинандали', value: '2140' },
    { label: 'Телави', value: '2138' },
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
    private hotelDataService: HotelDataService,
    private scraperService: ScraperService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.fetchHotels();
    this.initializeFilters();
    this.valueChangesWatcher();
    this.searchForm.get('tour')?.valueChanges.subscribe(() => {
      this.adjustNightOptions();
    });
    this.searchForm.get('country')?.valueChanges.subscribe(() => {
      this.updateCities();
      this.updateTours();
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

  private initializeForm(): void {
    this.searchForm = this.fb.group({
      tour: ['', Validators.required],
      country: ['', Validators.required],
      destinationCities: this.fb.array(
        this.uaecities.map((city) => city.label)
      ),
      departureDate: ['', Validators.required],
      returnDate: ['', Validators.required],
      nightsFrom: ['', Validators.required],
      nightsTo: ['', Validators.required],
      adults: [2, Validators.min(1)],
      children: [0, Validators.min(0)],
      childrenAges: this.fb.array([]),
      hotelStars: this.buildFormArray(this.starRatings, true),
      selectedHotels: this.fb.array(this.hotels.map((hotel) => hotel.name)),
      hotels: this.buildFormArray([]),
      roomTypes: this.buildFormGroupArray(
        this.roomTypes.filter((rt) => rt.selected)
      ),
      mealTypes: this.fb.array(
        this.meals.filter((meal) => meal.selected).map((meal) => meal.name)
      ),
      cities: this.buildFormArray(this.uaecities),
      priceRange: this.fb.group({
        minPrice: [''],
        maxPrice: [''],
      }),
      filters: [],
    });
    this.searchForm.setControl(
      'selectedHotels',
      this.fb.array(this.hotels.map(() => this.fb.control(false)))
    );
    this.searchForm.setControl(
      'hotelStars',
      this.buildFormArray(this.starRatings)
    );
    this.searchForm.setControl('hotels', this.buildFormArray([]));
    this.searchForm.setControl('cities', this.buildFormArray(this.uaecities));
    this.searchForm.setControl('meals', this.buildFormGroupArray(this.meals));
    this.searchForm.setControl(
      'roomTypes',
      this.buildFormGroupArray(this.roomTypes)
    );
    this.setInitialChildrenAges(this.searchForm.get('children')?.value);
  }

  private updateTours(): void {
    const country = this.searchForm.get('country')?.value;
    if (country === 'uae') {
      this.tours = this.uaeTours;
    } else if (country === 'georgia') {
      this.tours = this.georgianTours;
    }
    this.refreshTourSelector();
    this.adjustNightOptions();
  }

  private refreshTourSelector(): void {
    const tourControl = this.searchForm.get('tour');
    tourControl?.setValue('----');
  }

  private adjustNightOptions(): void {
    const selectedTour = this.searchForm.get('tour')?.value as string;
    const country = this.searchForm.get('country')?.value as string;

    let nightOptionsKey = selectedTour;
    if (selectedTour === '----' && country === 'georgia') {
      nightOptionsKey = 'Грузия: ----';
    }

    this.nightOptions =
      this.tourNightOptions[nightOptionsKey] ||
      this.tourNightOptions['default'];
    this.searchForm.get('nightsFrom')?.setValue(this.nightOptions[0]);
    this.searchForm
      .get('nightsTo')
      ?.setValue(this.nightOptions[this.nightOptions.length - 1]);
  }

  private updateCities(): void {
    const country = this.searchForm.get('country')?.value;
    if (country === 'uae') {
      this.cities = this.uaecities;
    } else if (country === 'georgia') {
      this.cities = this.georgiancities;
    }
    this.refreshCitySelector();
  }

  private refreshCitySelector(): void {
    const cityControl = this.searchForm.get('destinationCities') as FormArray;
    cityControl.clear();
    this.cities.forEach((city) => {
      cityControl.push(this.fb.control(city.value));
    });
  }

  protected onSelectedHotelsChange(event: MatSelectChange): void {
    const selectedHotelsArray = this.searchForm.get(
      'selectedHotels'
    ) as FormArray;
    const values = event.value;
    selectedHotelsArray.clear();
    values.forEach((value: any) =>
      selectedHotelsArray.push(this.fb.control(value))
    );
  }

  protected onMealTypesChange(event: MatSelectChange): void {
    const mealTypesArray = this.searchForm.get('mealTypes') as FormArray;
    mealTypesArray.clear();
    event.value.forEach((value: string) => {
      if (value) {
        mealTypesArray.push(this.fb.control(value));
      }
    });
  }

  protected onRoomTypesChange(event: MatSelectChange): void {
    const roomTypesArray = this.searchForm.get('roomTypes') as FormArray;
    roomTypesArray.clear();
    event.value.forEach((selectedValue: string) => {
      const roomType = this.roomTypes.find((rt) => rt.name === selectedValue);
      if (roomType && roomType.selected) {
        roomTypesArray.push(
          this.fb.group({
            name: this.fb.control(roomType.name),
            selected: this.fb.control(true),
          })
        );
      }
    });
  }

  protected onHotelStarChange(starRating: number, isChecked: boolean): void {
    const hotelStarsArray = this.searchForm.get('hotelStars') as FormArray;
    if (isChecked) {
      hotelStarsArray.push(this.fb.control(starRating));
    } else {
      const index = hotelStarsArray.controls.findIndex(
        (control) => control.value === starRating
      );
      if (index !== -1) {
        hotelStarsArray.removeAt(index);
      }
    }
  }

  protected onDestinationCitiesChange(event: MatSelectChange): void {
    const destinationCitiesArray = this.searchForm.get(
      'destinationCities'
    ) as FormArray;
    destinationCitiesArray.clear();
    event.value.forEach((value: any) =>
      destinationCitiesArray.push(this.fb.control(value))
    );
  }

  private buildFormArray(
    items: any[],
    useValuesInsteadOfBooleans: boolean = false
  ): FormArray {
    return this.fb.array(
      items.map((item) =>
        this.fb.control(
          useValuesInsteadOfBooleans
            ? item.selected
              ? item.value
              : null
            : false
        )
      )
    );
  }

  private buildFormGroupArray(items: any[]): FormArray {
    return new FormArray(
      items.map((item) =>
        this.fb.group({
          name: [item.name],
          selected: [false],
        })
      )
    );
  }

  protected searchHotels(event: Event): void {
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

  private fetchHotels(): void {
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

  private initializeHotelFormArray(): void {
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    hotelsFormArray.clear();
    this.hotels.forEach((hotel) => {
      hotelsFormArray.push(this.fb.control(hotel.selected));
    });
  }

  protected checkAllHotels(): void {
    const selectedHotelsControl = this.hotelSelect;
    this.isHotelDropdownDisabled = true;
    selectedHotelsControl.writeValue([]);
    const selectedHotelsFormArray = this.searchForm.get(
      'selectedHotels'
    ) as FormArray;
    selectedHotelsFormArray.clear();
  }

  protected uncheckAllHotels(): void {
    const selectedHotelsControl = this.hotelSelect;
    this.isHotelDropdownDisabled = false;
    const hotelsFormArray = this.searchForm.get('hotels') as FormArray;
    hotelsFormArray.clear();
    this.hotels.forEach((_) => {
      hotelsFormArray.push(this.fb.control(false));
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

  get selectedHotelsFormArray(): FormArray {
    return this.searchForm.get('selectedHotels') as FormArray;
  }

  get childrenAges(): FormArray {
    return this.searchForm.get('childrenAges') as FormArray;
  }

  get hotelStarsFormArray(): FormArray {
    return this.searchForm.get('hotelStars') as FormArray;
  }

  get mealTypesFormArray(): FormArray {
    return this.searchForm.get('mealTypes') as FormArray;
  }

  get roomTypesFormArray(): FormArray {
    return this.searchForm.get('roomTypes') as FormArray;
  }

  get destinationCitiesFormArray(): FormArray {
    return this.searchForm.get('destinationCities') as FormArray;
  }

  protected buildSearchPayload(): any {
    const formValue = this.sanitizeFormValues(this.searchForm);
    console.log(formValue.roomTypes);

    const payload = {
      destinationCountry: formValue.country,
      destinationCities: formValue.destinationCities.filter(
        (city: any) => city
      ),
      departureDate: formValue.departureDate,
      returnDate: formValue.returnDate,
      nights: {
        from: formValue.nightsFrom,
        to: formValue.nightsTo,
      },
      adults: formValue.adults,
      children: formValue.children,
      childrenAges: formValue.childrenAges,
      hotelStars: formValue.hotelStars.filter((star: null) => star != null),
      selectedHotels: formValue.selectedHotels,
      mealTypes: formValue.mealTypes.filter((type: any) => type),
      roomTypes: formValue.roomTypes,
      priceRange: {
        min: formValue.priceRange.minPrice,
        max: formValue.priceRange.maxPrice,
      },
      filters: formValue.filters,
      tourType: formValue.tour,
    };

    console.log('payload: ', payload);
    return payload;
  }

  private sanitizeFormValues(formGroup: FormGroup): any {
    const result: any = {};
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        result[key] = this.sanitizeFormValues(control);
      } else if (control instanceof FormArray) {
        result[key] = control.controls
          .filter((c) => c.value.selected)
          .map((c) => c.value.name);
      } else {
        let value = control?.value;
        result[key] = value == null ? '' : value;
      }
    });
    return result;
  }

  private onScrapeHotels(): void {
    this.scraperService.scrapeHotels().subscribe({
      next: (hotelNames) => console.log('Scraped hotel names:', hotelNames),
      error: (error) => console.error('Scraping error:', error),
    });
  }

  protected onSubmit(): void {
    if (this.searchForm.valid) {
      const searchPayload = this.buildSearchPayload();
      this.scraperService.sendSearchData(searchPayload).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('Search success:', response.message);
          } else {
            console.error('Search error:', response.message);
          }
        },
        error: (error) => {
          console.error('Server error:', error.error.message);
        },
      });
    } else {
      console.error('Form validation failed');
    }
  }

  protected onReset(): void {
    this.searchForm.reset();
    window.location.reload();
  }

  private valueChangesWatcher(): void {
    this.hotelStarsFormArray.valueChanges.subscribe((values) => {
      console.log('Star ratings changed:', values);
      this.filterHotelsByStarRating(values);
    });
    this.mealTypesFormArray.valueChanges.subscribe((values) => {
      console.log('Meal types selection changed:', values);
    });
    this.selectedHotelsFormArray.valueChanges.subscribe((values) => {
      console.log('Hotel selection changed:', values);
    });
    this.roomTypesFormArray.valueChanges.subscribe((values) => {
      console.log('Room types selection changed:', values);
    });
    this.destinationCitiesFormArray.valueChanges.subscribe((values) => {
      console.log('City selection changed:', values);
    });
  }
}
