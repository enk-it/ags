import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=3.0';
import { connect } from '../utils.js';
import { type Ctor } from 'gi-types/gobject2.js';

export default class Service extends GObject.Object {
    static {
        GObject.registerClass({
            Signals: { 'changed': {} },
        }, this);
    }

    static ensureInstance(api: { _instance: Service }, service: { new(): Service }) {
        if (!api._instance)
            api._instance = new service();
    }

    static register(service: Ctor, signals?: { [signal: string]: string[] }) {
        const Signals: {
            [signal: string]: { param_types: GObject.GType<unknown>[] }
        } = {};

        if (signals) {
            Object.keys(signals).forEach(signal =>
                Signals[signal] = {
                    param_types: signals[signal].map(t =>
                        // @ts-ignore
                        GObject[`TYPE_${t.toUpperCase()}`]),
                },
            );
        }

        GObject.registerClass({ Signals }, service);
    }

    static export(api: { instance: object }, name: string) {
        // @ts-ignore
        Service[name] = api;
    }

    connectWidget(
        widget: Gtk.Widget,
        callback: (widget: Gtk.Widget, ...args: unknown[]) => void,
        event = 'changed',
    ) {
        connect(this, widget, callback, event);
    }
}
