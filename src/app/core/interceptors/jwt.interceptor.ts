import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';
import { JwtService } from '../services/jwt.service';

const BACKEND_BASE_URL = 'https://notes-project-one-iota.vercel.app';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private jwtService: JwtService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let url = request.url;

    // Si la petición es relativa a /api y no estamos en el propio host de producción en Vercel,
    // redirigir automáticamente la llamada al backend en la nube
    if (url.startsWith('/api')) {
      const isVercelHost = typeof window !== 'undefined' && window.location.hostname.includes('notes-project-one-iota.vercel.app');
      if (!isVercelHost) {
        url = `${BACKEND_BASE_URL}${url}`;
      }
    }

    const token = this.jwtService.getToken();
    const headers: { [key: string]: string } = {};

    if (token && !this.jwtService.isTokenExpired(token)) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    request = request.clone({
      url,
      setHeaders: headers
    });

    return next.handle(request);
  }
}

