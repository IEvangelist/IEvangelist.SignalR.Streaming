import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class StorageService {
    get(): string {
        return localStorage.getItem('user-video-seletion');
    }

    set(value: string) {
        if (value && value !== 'null') {
            localStorage.setItem('user-video-seletion', value);
        }
    }

    remove() {
        localStorage.removeItem('user-video-seletion');
    }
}