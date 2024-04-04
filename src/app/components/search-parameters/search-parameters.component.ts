import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  FormArray,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-search-parameters',
  templateUrl: './search-parameters.component.html',
  styleUrls: ['./search-parameters.component.scss'],
})
export class SearchParametersComponent implements OnInit {
  searchForm!: FormGroup;

  hotelStarsOptions = [
    { label: '2*', value: '2' },
    { label: '3*', value: '3' },
    { label: '4*', value: '4' },
    { label: '5*', value: '5' },
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.createForm();
  }

  createForm() {
    this.searchForm = this.fb.group({
      departureCity: ['', Validators.required], // Example of a required field
      country: [''],
      departureDate: ['', Validators.required],
      returnDate: [''],
      nights: ['', [Validators.required, Validators.min(1)]], // Validators can be combined
      adults: ['', [Validators.required, Validators.min(1)]],
      children: [''],
      hotelStars: new FormArray([]),
      roomType: [''],
    });

    this.addCheckboxes();
  }

  private addCheckboxes() {
    this.hotelStarsOptions.forEach(() =>
      this.hotelStars.push(new FormControl(false))
    );
  }

  get hotelStars() {
    return this.searchForm.get('hotelStars') as FormArray;
  }

  onSubmit() {
    if (this.searchForm.valid) {
      console.log(this.searchForm.value);
    }
  }

  onReset() {
    this.searchForm.reset();
  }
}
