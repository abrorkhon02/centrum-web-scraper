import { Routes } from '@angular/router';
import { DynamicSearchComponent } from './components/dynamic-search/dynamic-search.component';

export const routes: Routes = [
  { path: 'dynamic', component: DynamicSearchComponent },
  { path: '', redirectTo: '/dynamic', pathMatch: 'full' },
];
