import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchParametersComponent } from './search-parameters.component';

describe('SearchParametersComponent', () => {
  let component: SearchParametersComponent;
  let fixture: ComponentFixture<SearchParametersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchParametersComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SearchParametersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});