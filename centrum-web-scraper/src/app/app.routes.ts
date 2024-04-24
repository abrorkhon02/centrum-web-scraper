import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SearchParametersComponent } from './components/search-parameters/search-parameters.component';
import { DynamicSearchComponent } from './components/dynamic-search/dynamic-search.component';

export const routes: Routes = [
  { path: 'dynamic', component: DynamicSearchComponent },
  { path: '', redirectTo: '/dynamic', pathMatch: 'full' },
];
