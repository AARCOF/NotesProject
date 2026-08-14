import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { NotesDashboardComponent } from "./screens/notes-dashboard/notes-dashboard.component";
import { CategoryManagerComponent } from "./screens/category-manager/category-manager.component";
import { LoginComponent } from "./sample-pages/login/login.component";
import { RegisterComponent } from "./sample-pages/register/register.component";
import { VerifyEmailComponent } from "./sample-pages/verify-email/verify-email.component";

import { AuthGuard } from "./core/guards/auth.guard";

const routes: Routes = [
  { path: "", redirectTo: "/dashboard", pathMatch: "full" },
  { path: "dashboard", component: NotesDashboardComponent, canActivate: [AuthGuard] },
  { path: "categories", component: CategoryManagerComponent, canActivate: [AuthGuard] },
  { path: "login", component: LoginComponent },
  { path: "register", component: RegisterComponent },
  { path: "verify-email", component: VerifyEmailComponent },
  { path: "**", redirectTo: "/dashboard" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
