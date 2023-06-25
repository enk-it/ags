import Gtk from 'gi://Gtk?version=3.0';
import Service from './service.js';

imports.gi.versions.GnomeBluetooth = '3.0';
const { GnomeBluetooth } = imports.gi;

const _STATES = {
    [GnomeBluetooth.AdapterState.ABSENT]: 'absent',
    [GnomeBluetooth.AdapterState.ON]: 'enabled',
    [GnomeBluetooth.AdapterState.TURNING_ON]: 'enabled',
    [GnomeBluetooth.AdapterState.OFF]: 'disabled',
    [GnomeBluetooth.AdapterState.TURNING_OFF]: 'disabled',
};

type BluetoothDevice = {
    address: string
    batteryLevel: number
    batteryPercentage: number
    connected: boolean
    iconName: string
    alias: string
    name: string
    trusted: boolean
    paired: boolean
}

type BluetoothState = {
    state: string,
    connectedDevices: BluetoothDevice[]
    devices: BluetoothDevice[]
}

interface Device extends BluetoothDevice {
    battery_level: number
    battery_percentage: number
    icon: string
    connect: (event: string, callback: () => void) => number
    disconnect: (id: number) => void
}

class BluetoothService extends Service{
    static { Service.register(this); }

    _state!: BluetoothState;
    _devices: Map<string, Device>;
    _connections: Map<string, number[]>;
    // @ts-ignore
    _client: GnomeBluetooth.Client;

    constructor() {
        super();

        this._devices = new Map();
        this._connections = new Map();
        this._client = new GnomeBluetooth.Client();
        this._client.connect('notify::default-adapter-state', this._sync.bind(this));
        this._client.connect('device-added', this._deviceAdded.bind(this));
        this._client.connect('device-removed', this._deviceRemoved.bind(this));
        this._getDevices().forEach(device => this._deviceAdded(this, device));
        this._sync();
    }

    toggle() {
        this._client.default_adapter_powered = !this._client.default_adapter_powered;
    }

    _getDevices() {
        const devices: Device[] = [];
        const deviceStore = this._client.get_devices();

        for (let i=0; i<deviceStore.get_n_items(); ++i) {
            const device = deviceStore.get_item(i);

            if (device.paired || device.trusted)
                devices.push(device as Device);
        }

        return devices;
    }

    _deviceAdded(_c: unknown, device: Device) {
        if (this._devices.has(device.address))
            return;

        const connections = [
            'address',
            'alias',
            'battery-level',
            'battery-percentage',
            'connected',
            'icon',
            'name',
            'paired',
            'trusted',
        ].map(prop => device.connect(`notify::${prop}`, this._sync.bind(this)));
        this._connections.set(device.address, connections);

        this._devices.set(device.address, device);
        this._sync();
    }

    _deviceRemoved(_c: unknown, device: Device) {
        if (!this._devices.has(device.address))
            return;

        this._connections.get(device.address)?.forEach(id => device.disconnect(id));
        this._connections.delete(device.address);
        this._devices.delete(device.address);
        this._sync();
    }

    _sync() {
        this._state = {
            state: _STATES[this._client.default_adapter_state],
            connectedDevices: [],
            devices: [],
        };

        for (const [, device] of this._devices) {
            const item: BluetoothDevice = {
                address: device.address,
                alias: device.alias,
                batteryLevel: device.battery_level,
                batteryPercentage: device.battery_percentage,
                connected: device.connected,
                name: device.name,
                iconName: device.icon,
                paired: device.paired,
                trusted: device.trusted,
            };
            this._state.devices.push(item);
            if (device.connected)
                this._state.connectedDevices.push(item);
        }

        this.emit('changed');
    }
}

export default class Bluetooth {
    static { Service.export(this, 'Bluetooth'); }
    static _instance: BluetoothService;

    static connect(widget: Gtk.Widget, callback: () => void) {
        Service.ensureInstance(Bluetooth, BluetoothService);
        Bluetooth._instance.listen(widget, callback);
    }

    static toggle() {
        Service.ensureInstance(Bluetooth, BluetoothService);
        Bluetooth._instance.toggle();
    }

    static get state() {
        Service.ensureInstance(Bluetooth, BluetoothService);
        const state = { ...Bluetooth._instance._state };
        return state;
    }
}
