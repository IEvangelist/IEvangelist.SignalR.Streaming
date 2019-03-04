import { Component, AfterViewInit, ViewChild, ElementRef, Renderer2 } from '@angular/core';
import { HubConnectionBuilder, LogLevel, HubConnection, Subject, HubConnectionState } from '@aspnet/signalr';

@Component({
    selector: 'home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit {
    @ViewChild('video') videoElement: ElementRef;
    @ViewChild('canvas') canvasElement: ElementRef;
    @ViewChild('ascii') asciiElement: ElementRef;

    streamName: string;

    private video: HTMLVideoElement;    
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;    
    private ascii: HTMLPreElement;
    private connection: HubConnection;
    private timeout: NodeJS.Timeout;
    private subject: signalR.Subject<string>;

    private asciiChars: string[];

    constructor(private readonly renderer: Renderer2) {
        this.connection =
            new HubConnectionBuilder()
                .withUrl('/stream')
                .configureLogging(LogLevel.Information)
                .build();

        this.asciiChars =
            ['@', '#', '$', '=', '*', '!', ';', ':', '~', '-', ',', '.', '&nbsp;', '&nbsp;'];
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

    startStream() {
        //if (this.connection.state === HubConnectionState.Disconnected) {
        //    await this.connection.start();
        //}

        if (this.timeout) {
            clearInterval(this.timeout);
        }

        //if (!this.subject) {
        //    this.subject = new Subject<string>();
        //}

        this.timeout = this.interval(() => this.tryDrawFrame(), 1000 / 50 /* frames per second */);        
        //await this.connection.send('startStream', this.streamName, this.subject);
    }

    stopStream() {
        if (this.timeout) {
            clearInterval(this.timeout);
        }
    }

    private tryDrawFrame() {
        try {
            const height = this.video.height || 192;
            const width = this.video.width || 256;
            this.context.drawImage(this.video, 0, 0, width, height);
            const imageData = this.context.getImageData(0, 0, width, height).data;
            const asciiStr = this.getAsciiString(imageData, width, height);
            this.renderer.setProperty(this.ascii, 'innerHTML', asciiStr);
            //this.subject.next(asciiStr);
        } catch (e) { }
    }

    private getAsciiString(imageData: Uint8ClampedArray, width: number, height: number) {
        let str = '';        
        for (let i = 0; i < width * height; ++ i) {
            if (i % width === 0) {
                str += '\n';
            }

            const rgb = this.getRGB(imageData, i);
            const val = Math.max(rgb[0], rgb[1], rgb[2]) / 255;

            str += `<font style='color:${this.toHex(rgb[0], rgb[2], rgb[2])}'>${this.getChar(val)}</font>`;
        }

        return str;
    }

    private getRGB(imageData: Uint8ClampedArray, i: number) {
        return [imageData[i = i * 4], imageData[i + 1], imageData[i + 2]];
    }

    private toHex(r: number, g: number, b: number) {
        return `#${this.toHexStr(r)}${this.toHexStr(g)}${this.toHexStr(b)}`;
    }

    private toHexStr(val: number) {
        let hex = val.toString(16);
        return hex.length == 1 ? `0${hex}` : hex;
    }

    private getChar(val: number) {
        return this.asciiChars[parseInt((val * this.asciiChars.length).toString(), 10)];
    }

    private interval(func: Function, wait: number) {
        var interv = function (w) {
            return () => {
                setTimeout(interv, w);
                try {
                    func.call(null);
                }
                catch (e) {
                    throw e.toString();
                }
            };
        }(wait);

        return setTimeout(interv, wait);
    };
}