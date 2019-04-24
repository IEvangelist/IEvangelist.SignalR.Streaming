import {
    Component,
    OnInit,
    OnDestroy,
    EventEmitter,
    Input,
    Output,
    ViewChild
} from '@angular/core';
import { DeviceSelectComponent } from '../device-select/device-select.component';
import { DeviceService } from '../services/device.service';
import { debounceTime } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
    selector: 'settings',
    styleUrls: ['./settings.component.css'],
    templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit, OnDestroy {
    private devices: MediaDeviceInfo[] = [];
    private subscription: Subscription;

    @ViewChild('videoSelect') video: DeviceSelectComponent;
    @Output() settingsChanged = new EventEmitter<MediaDeviceInfo>();

    constructor(
        private readonly deviceService: DeviceService) { }

    ngOnInit() {
        this.subscription =
            this.deviceService
                .$devicesUpdated
                .pipe(debounceTime(350))
                .subscribe(async deviceListPromise => {
                    this.devices = await deviceListPromise;
                    this.handleDeviceAvailabilityChanges();
                });
    }

    ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    onSettingsChanged(deviceInfo: MediaDeviceInfo) {
        this.settingsChanged.emit(deviceInfo);
    }

    private handleDeviceAvailabilityChanges() {
        if (this.devices && this.devices.length && this.video && this.video.selectedId) {
            let videoDevice = this.devices.find(d => d.deviceId === this.video.selectedId);
            if (!videoDevice) {
                videoDevice = this.devices.find(d => d.kind === 'videoinput');
                if (videoDevice) {
                    this.video.selectedId = videoDevice.deviceId;
                    this.onSettingsChanged(videoDevice);
                }
            }
        }
    }
}