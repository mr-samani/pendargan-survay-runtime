import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllocationListComponent } from './allocation-list.component';
import { AllocationListResolver } from './allocation-list.resolver';

const routes: Routes = [{ path: '', component: AllocationListComponent, resolve: { data: AllocationListResolver } }];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QuestionerAllocationsRoutingModule {}
