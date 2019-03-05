import { Component, AfterViewInit, ViewChild, ElementRef, Renderer2, OnInit } from '@angular/core';
import { HubConnectionBuilder, LogLevel, HubConnection, Subject, HubConnectionState, ISubscription } from '@aspnet/signalr';

@Component({
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit, OnInit {
    @ViewChild('video') videoElement: ElementRef;
    @ViewChild('canvas') canvasElement: ElementRef;
    @ViewChild('ascii') asciiElement: ElementRef;

    streamName: string;

    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private ascii: HTMLPreElement;
    private connection: HubConnection;
    private subject: Subject<string>;
    private streams: string[] = [];
    private asciiChars: string[];
    private remoteSubscription: ISubscription<any>;

    constructor(private readonly renderer: Renderer2) {
        this.connection =
            new HubConnectionBuilder()
                .withUrl('/stream')
                .configureLogging(LogLevel.Information)
                .build();

        this.asciiChars =
            ['@', '#', '$', '=', '*', '!', ';', ':', '~', '-', ',', '.', '&nbsp;', '&nbsp;'];
    }

    async ngOnInit() {
        await this.connection.start();
        this.streams = await this.connection.invoke<string[]>('getAvailabeStreams');
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
            if (this.canvas) {
                this.context = this.canvas.getContext('2d');
            }
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

    private isStreaming = false;

    async startStream() {
        if (this.connection.state === HubConnectionState.Disconnected) {
            await this.connection.start();
        }

        if (!this.subject) {
            this.subject = new Subject<string>();
        }

        this.isStreaming = true;
        this.tryDrawFrame();    
        
        await this.connection.send('startStream', this.streamName, this.subject);
    }

    stopStream() {
        this.subject.complete();
        this.isStreaming = false;
    }

    async watchStream(streamName: string) {
        this.stopWatchingStream();
        this.remoteSubscription =
            this.connection
                .stream("WatchStream", streamName)
                .subscribe({
                    next: ascii => {
                        this.renderer.setProperty(this.ascii, 'innerHTML', ascii);
                    },
                    complete: () => {
                        console.log("Stream is finished.");
                    },
                    error: err => {
                        console.log("Failed to watch the stream: " + err);
                    },
                });
    }

    stopWatchingStream() {
        if (this.remoteSubscription) {
            this.remoteSubscription.dispose();
        }
    }

    private tryDrawFrame() {
        try {
            if (this.isStreaming) {
                const height = 72, width = 96;
                this.context.drawImage(this.video, 0, 0, width, height);
                const imageData = this.context.getImageData(0, 0, width, height).data;
                const asciiStr = this.getAsciiString(imageData, width, height);
                this.renderer.setProperty(this.ascii, 'innerHTML', asciiStr);
                this.subject.next(asciiStr);   
            }
        } finally {
            if (this.isStreaming) {
                setTimeout(() => {
                    if (this.isStreaming) {
                        this.tryDrawFrame();
                    }
                }, 30);
            }
        }
    }

    private getAsciiString(imageData: Uint8ClampedArray, width: number, height: number) {
        let str = '';
        for (let i = 0; i < width * height; ++ i) {
            if (i % width === 0) {
                str += '\n';
            }
            const rgb = this.toRGB(imageData, i);
            const val = Math.max(rgb[0], rgb[1], rgb[2]) / 255;

            str += `<font style='color:${this.toHex(rgb[0], rgb[1], rgb[2])}'>${this.getChar(val)}</font>`;
        }

        return str;
    }

    private toRGB(imageData: Uint8ClampedArray, i: number) {
        return [imageData[i = i * 4], imageData[i + 1], imageData[i + 2]];
    }

    private toHex(r: number, g: number, b: number) {
        return `#${this.toHexStr(r)}${this.toHexStr(g)}${this.toHexStr(b)}`;
    }

    private toHexStr(val: number) {
        const hex = val.toString(16);
        return hex.length == 1 ? `0${hex}` : hex;
    }

    private getChar(val: number) {
        return this.asciiChars[parseInt((val * this.asciiChars.length).toString(), 10)] || '&nbsp;';
    }
}