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
    streams: string[] = [];
    isStreaming = false;
    isWatching = false;
    isInitialized = false;

    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private ascii: HTMLPreElement;
    private connection: HubConnection;
    private subject: Subject<string>;
    private asciiChars: string[];
    private remoteSubscription: ISubscription<any>;
    private lastFrame: string[];

    constructor(private readonly renderer: Renderer2) {
        this.connection =
            new HubConnectionBuilder()
                .withUrl('/stream')
                .configureLogging(LogLevel.Debug)
                .build();

        this.connection.on("StreamCreated", stream => {
            if (this.streams) {
                this.streams.push(stream);
            } else {
                this.streams = [stream];
            }
        });

        this.connection.on("StreamRemoved", stream => {
            if (this.streams) {
                const index = this.streams.indexOf(stream);
                this.streams.splice(index, 1);
            }
        });

        this.connection.onclose(async () => {
            this.stopStream();
            await this.connectToSignalR();
        });

        this.asciiChars = ['@', '#', '$', '=', '*', '!', ';', ':', '~', '-', ',', '.', '&nbsp;'];
    }

    async ngOnInit() {
        await this.connectToSignalR();
        this.streams = await this.connection.invoke<string[]>('ListStreams');
    }

    ngAfterViewInit(): void {
        if (this.videoElement && this.videoElement.nativeElement) {
            this.video = this.videoElement.nativeElement as HTMLVideoElement;
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

    private async connectToSignalR() {
        await this.connection.start().catch(_ => {
            setTimeout(() => this.connectToSignalR(), 5000);
        });
    }

    async startStream() {
        if (!this.isInitialized) {
            await this.startWebCam();
        }

        if (this.connection.state != HubConnectionState.Connected) {
            await this.connectToSignalR();
        }

        if (!this.subject) {
            this.subject = new Subject<string>();
        }

        await this.connection.send('StartStream', this.streamName, this.subject);

        this.isStreaming = true;
        this.tryDrawFrame();
    }

    async startWebCam() {
        if (this.video) {
            await this.getMediaStreamPromise({ video: true })
                      .then((stream: MediaStream) => this.video.srcObject = stream);
            this.isInitialized = true;
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


    stopStream() {
        this.isStreaming = false;
        if (!this.subject) {
            this.subject.complete();
        }
    }

    async watchStream(streamName: string) {
        this.stopWatchingStream();
        this.remoteSubscription =
            this.connection
                .stream('WatchStream', streamName)
                .subscribe({
                    next: ascii => {
                        this.renderer.setProperty(this.ascii, 'innerHTML', ascii);
                    },
                    complete: () => {
                        console.log('Stream is finished.');
                    },
                    error: err => {
                        console.log(`Failed to watch the stream: ${err}`);
                    },
                });

        this.isWatching = true;
    }

    stopWatchingStream() {
        if (this.remoteSubscription) {
            this.remoteSubscription.dispose();
            this.isWatching = false;
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
        this.lastFrame = [];

        for (let i = 1; i < width * height; ++ i) {
            if (i % width === 0) {
                str += '\n';
                this.lastFrame.push('\n');
            }
            const rgb = this.toRGB(imageData, i);
            const val = Math.max(rgb[0], rgb[1], rgb[2]) / 255;
            const char = this.getChar(val);
            const isSpace = char === '&nbsp;'
            const colorAttr = isSpace ? 'background' : 'color';
            const color = isSpace
                ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.2)`
                : this.toHex(rgb[0], rgb[1], rgb[2]);

            str += `<font style='${colorAttr}:${color}'>${char}</font>`;
            this.lastFrame.push(char);
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