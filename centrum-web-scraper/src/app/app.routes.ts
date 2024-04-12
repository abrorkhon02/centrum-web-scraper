import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SearchParametersComponent } from './components/search-parameters/search-parameters.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'search', component: SearchParametersComponent },
  { path: '', redirectTo: '/search', pathMatch: 'full' },
];
