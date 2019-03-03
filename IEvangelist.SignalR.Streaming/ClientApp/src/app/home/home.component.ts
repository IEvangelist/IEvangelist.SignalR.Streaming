import { Component,  AfterViewInit, ViewChild, ElementRef } from '@angular/core';

@Component({
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit {
    @ViewChild('video') videoElement: ElementRef;
    private video: HTMLVideoElement;

    @ViewChild('canvas') canvasElement: ElementRef;
    private canvas: HTMLCanvasElement;

    @ViewChild('ascii') asciiElement: ElementRef;
    private ascii: HTMLPreElement;

    constructor() {

    }

    ngAfterViewInit(): void {
        if (this.videoElement && this.videoElement.nativeElement) {
            this.video = this.videoElement.nativeElement as HTMLVideoElement;
            if (this.video) {
                this.getMediaStreamPromise({ video: true })
                    .then((stream: MediaStream) => this.video.srcObject = stream);
            }
        }
        if (this.canvasElement && this.canvasElement.nativeElement) {
            this.canvas = this.canvasElement.nativeElement as HTMLCanvasElement;
        }
        if (this.asciiElement && this.asciiElement.nativeElement) {
            this.ascii = this.asciiElement.nativeElement as HTMLPreElement;
        }
    }

    private getMediaStreamPromise(constraints: MediaStreamConstraints): Promise<MediaStream> {
        if (navigator.mediaDevices.getUserMedia) {
            return navigator.mediaDevices.getUserMedia(constraints);
        }

        let getMediaStream = ((
            navigator['webkitGetUserMedia'] ||
            navigator['mozGetUserMedia']) as (c: MediaStreamConstraints) => Promise<MediaStream>
        ).bind(navigator);

        return getMediaStream(constraints);
    }
}