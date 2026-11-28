import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuestionerConditionsListComponent } from './questioner-conditions-list.component';

const routes: Routes = [{ path: ':pollUniqueId', component: QuestionerConditionsListComponent }];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class QuestionerAllocationsRoutingModule {}
