import { TestBed } from '@angular/core/testing';

import { DynamicDataService } from './dynamicdata.service';

describe('DynamicdataService', () => {
  let service: DynamicDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DynamicDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
