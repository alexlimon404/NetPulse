// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2024 alexlimon404 <https://github.com/alexlimon404>
/*
 * NetPulse - net_speed.js
 * Core logic: reads /proc/net/dev, calculates speeds, manages NetworkManager signals.
 *
 * Based on NetSpeed by Amir Hedayaty <hedayaty@gmail.com> (GPL-2.0-or-later)
 * Ported to GNOME 45+ ES Modules API.
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import NM from 'gi://NM';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { NetSpeedStatusIcon } from './net_speed_status_icon.js';

// All /proc reads go through the async GIO API — synchronous file I/O would
// block the compositor thread (EGO review rule I-X-004).
Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');

export class NetSpeed {
    constructor(extension) {
        this._extension = extension;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    _is_up2date() {
        if (this._devices.length !== this._olddevices.length)
            return false;
        for (let i = 0; i < this._devices.length; ++i) {
            if (this._devices[i] !== this._olddevices[i])
                return false;
        }
        return true;
    }

    get_device_type(device) {
        const devices = this._client.get_devices() ?? [];
        for (const dev of devices) {
            if (dev.interface === device) {
                switch (dev.device_type) {
                    case NM.DeviceType.ETHERNET: return 'ethernet';
                    case NM.DeviceType.WIFI:     return 'wifi';
                    case NM.DeviceType.BT:       return 'bt';
                    case NM.DeviceType.OLPC_MESH: return 'olpcmesh';
                    case NM.DeviceType.WIMAX:    return 'wimax';
                    case NM.DeviceType.MODEM:    return 'modem';
                    default:                     return 'none';
                }
            }
        }
        return 'none';
    }

    _speed_to_string(amount) {
        let m_digits = this.digits;
        let divider, byte_map, bit_map;

        if (this.bin_prefixes) {
            divider  = 1024;
            byte_map = [_('B/s'), _('kiB/s'), _('MiB/s'), _('GiB/s')];
            bit_map  = [_('b/s'), _('kib/s'), _('Mib/s'), _('Gib/s')];
        } else {
            divider  = 1000;
            byte_map = [_('B/s'), _('kB/s'), _('MB/s'), _('GB/s')];
            bit_map  = [_('b/s'), _('kb/s'), _('Mb/s'), _('Gb/s')];
        }

        if (amount === 0)
            return { text: '0', unit: this.use_bytes ? _('B/s') : _('b/s') };

        if (m_digits < 3) m_digits = 3;
        amount *= 1000 * (this.use_bytes ? 1 : 8);

        let unit = 0;
        while (amount >= divider && unit < 3) {
            amount /= divider;
            ++unit;
        }

        if (amount >= 100)      m_digits -= 2;
        else if (amount >= 10)  m_digits -= 1;

        return {
            text: amount.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: m_digits - 1,
            }),
            unit: (this.use_bytes ? byte_map : bit_map)[unit],
        };
    }

    // ── UI update wrappers ───────────────────────────────────────────────────

    _set_labels(sum, up, down) {
        this._status_icon.set_labels(sum, up, down);
    }

    _update_speeds() {
        this._status_icon.update_speeds(this._speeds);
        // force a redraw in the next frame (fixes occasional stale render)
        // store the ID so disable() can cancel it before the callback fires
        this._redrawId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
            this._redrawId = 0;
            if (this._status_icon)
                this._status_icon.queue_redraw();
            return GLib.SOURCE_REMOVE;
        });
    }

    _update_ips() {
        this._status_icon.update_ips(this._ips);
    }

    _create_menu() {
        const types        = [];
        const devices_text = [];
        for (const dev of this._devices) {
            types.push(this.get_device_type(dev));
            const ssid = this._retrieve_wifi_ssid(dev);
            devices_text.push(ssid !== null ? `${dev}\n${ssid}` : dev);
        }
        this._status_icon.create_menu(devices_text, types);
    }

    // ── /proc parsers ────────────────────────────────────────────────────────

    /**
     * Reads a file without blocking the main loop.
     * Returns the decoded contents, or null on error / cancellation.
     */
    async _read_file(path) {
        try {
            const [bytes] = await Gio.File.new_for_path(path)
                .load_contents_async(this._cancellable);
            return new TextDecoder().decode(bytes);
        } catch (e) {
            if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(`NetPulse: cannot read ${path}: ${e.message}`);
            return null;
        }
    }

    // true once disable() ran (or is running) — bail out after every await
    _is_stale() {
        return this._cancellable === null || this._cancellable.is_cancelled();
    }

    async _updateDefaultGw() {
        const contents = await this._read_file('/proc/net/route');
        if (contents === null) return;
        const lines = contents.split('\n');
        for (const line of lines) {
            const params = line.replace(/^ */g, '').split('\t');
            if (params.length !== 11) continue;
            if (params[1] === '00000000')
                this._defaultGw = params[0];
        }
    }

    async _update() {
        // a previous tick may still be waiting on I/O — skip this one
        if (this._updating) return;
        this._updating = true;
        try {
            await this._update_once();
        } catch (e) {
            console.error(`NetPulse: update failed: ${e.message}`);
        } finally {
            this._updating = false;
        }
    }

    async _update_once() {
        await this._updateDefaultGw();
        if (this._is_stale()) return;

        const contents = await this._read_file('/proc/net/dev');
        if (contents === null || this._is_stale()) return;

        const lines = contents.split('\n');

        let totalUp = 0, totalDown = 0;

        this._oldvalues  = this._values;
        this._olddevices = this._devices;
        this._values  = [];
        this._devices = [];
        this._speeds  = [];
        this._ips     = [];

        const time  = GLib.get_monotonic_time() / 1000; // µs → ms
        const delta = time - this._last_time;
        this._last_time = time;

        // first two lines are header
        for (let i = 2; i < lines.length - 1; ++i) {
            const line   = lines[i].replace(/ +/g, ' ').replace(/^ */g, '');
            const params = line.split(' ');
            const iface  = params[0].replace(':', '');
            if (iface === 'lo') continue;
            // fields: iface rx_bytes ... rx_packets ... tx_bytes (col 9) ...
            this._values.push([parseInt(params[9]), parseInt(params[1])]);
            this._devices.push(iface);
        }

        let total_speed = null, up_speed = null, down_speed = null;

        if (this._is_up2date() && !this._device_state_changed) {
            for (let i = 0; i < this._values.length; ++i) {
                let _up   = this._values[i][0] - this._oldvalues[i][0];
                let _down = this._values[i][1] - this._oldvalues[i][1];
                if (_up   < 0) _up   = 0;
                if (_down < 0) _down = 0;

                const _up_speed   = this._speed_to_string(_up   / delta);
                const _down_speed = this._speed_to_string(_down / delta);
                this._speeds.push({
                    up:   `${_up_speed.text} ${_up_speed.unit}`,
                    down: `${_down_speed.text} ${_down_speed.unit}`,
                });

                totalUp   += _up;
                totalDown += _down;

                if (this.getDevice() === this._devices[i]) {
                    total_speed = this._speed_to_string((_up + _down) / delta);
                    up_speed    = this._speed_to_string(_up   / delta);
                    down_speed  = this._speed_to_string(_down / delta);
                }
            }

            if (total_speed === null) {
                total_speed = this._speed_to_string((totalUp + totalDown) / delta);
                up_speed    = this._speed_to_string(totalUp   / delta);
                down_speed  = this._speed_to_string(totalDown / delta);
            }

            this._set_labels(total_speed, up_speed, down_speed);
            this._update_speeds();
        } else {
            this._create_menu();
        }

        if (this._device_state_changed && this.show_ips) {
            this._retrieve_ips();
            this._update_ips();
        }

        this._device_state_changed = false;
    }

    // ── settings ─────────────────────────────────────────────────────────────

    _load() {
        if (this._saving) return;
        this.showsum         = this._setting.get_boolean('show-sum');
        this.use_icon        = this._setting.get_boolean('icon-display');
        this.digits          = this._setting.get_int('digits');
        this._device         = this._setting.get_string('device');
        this.timer           = this._setting.get_int('timer');
        this.label_size      = this._setting.get_int('label-size');
        this.unit_label_size = this._setting.get_int('unit-label-size');
        this.menu_label_size = this._setting.get_int('menu-label-size');
        this.use_bytes       = this._setting.get_boolean('use-bytes');
        this.bin_prefixes    = this._setting.get_boolean('bin-prefixes');
        this.show_ips        = this._setting.get_boolean('show-ips');
        this.vert_align      = this._setting.get_boolean('vert-align');
    }

    save() {
        this._saving = true;
        this._setting.set_boolean('show-sum', this.showsum);
        this._setting.set_string('device', this._device);
        this._setting.set_boolean('show-ips', this.show_ips);
        this._saving = false;
    }

    // The tick itself must stay synchronous (it has to return a GLib source
    // constant), so the async update is only kicked off from it.
    _start_timer(interval) {
        this._timerid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _reload() {
        if (!this._setting) return;
        const m_timer = this._setting.get_int('timer');
        if (m_timer !== this.timer) {
            GLib.source_remove(this._timerid);
            this._start_timer(m_timer);
        }
        this._load();
        this._status_icon.updateui();
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────

    enable() {
        this._last_time          = 0;
        this._device_state_changed = true;
        this._values  = [];
        this._devices = [];
        this._updating    = false;
        this._cancellable = new Gio.Cancellable();

        this._client     = NM.Client.new(null);
        this._nm_signals = [];
        this._nm_signals.push(
            this._client.connect('any-device-added',
                () => this._trigger_ips_reload()));
        this._nm_signals.push(
            this._client.connect('any-device-removed',
                () => this._trigger_ips_reload()));
        this._nm_signals.push(
            this._client.connect('connection-added',
                () => this._trigger_ips_reload()));
        this._nm_signals.push(
            this._client.connect('connection-removed',
                () => this._trigger_ips_reload()));
        this._nm_signals.push(
            this._client.connect('active-connection-added',
                () => this._trigger_ips_reload()));
        this._nm_signals.push(
            this._client.connect('active-connection-removed',
                () => this._trigger_ips_reload()));

        this._nm_devices_signals_map = new Map();

        // getSettings() finds schemas/ inside the extension directory
        this._setting = this._extension.getSettings();
        this._saving  = false;
        this._load();

        this._updateDefaultGw();

        this._changed = this._setting.connect('changed', () => this._reload());
        this._start_timer(this.timer);

        this._status_icon = new NetSpeedStatusIcon(this, this._extension);
        const placement   = this._setting.get_string('placement');
        Main.panel.addToStatusArea('netpulse', this._status_icon, 0, placement);
    }

    disable() {
        // aborts any in-flight /proc read; pending callbacks bail out on _is_stale()
        this._cancellable?.cancel();
        this._cancellable = null;

        if (this._timerid) {
            GLib.source_remove(this._timerid);
            this._timerid = 0;
        }

        if (this._redrawId) {
            GLib.source_remove(this._redrawId);
            this._redrawId = 0;
        }

        if (this._changed) {
            this._setting.disconnect(this._changed);
            this._changed = null;
        }

        this._devices    = null;
        this._values     = null;
        this._olddevices = null;
        this._oldvalues  = null;
        this._setting    = null;

        this._nm_signals.forEach(id => this._client.disconnect(id));
        this._nm_signals = [];

        this._disconnect_all_nm_device_state_changed();
        this._client = null;

        this._status_icon.destroy();
        this._status_icon = null;
    }

    // ── device helpers ────────────────────────────────────────────────────────

    getDevice() {
        return this._device === 'defaultGW' ? this._defaultGw : this._device;
    }

    setDevice(device) {
        this._device = device;
    }

    _trigger_ips_reload() {
        this._device_state_changed = true;
    }

    _retrieve_ips() {
        this._disconnect_all_nm_device_state_changed();
        for (const dev of this._devices) {
            const nm_dev   = this._client.get_device_by_iface(dev);
            const addresses = this._getAddresses(nm_dev, GLib.SYSDEF_AF_INET);
            this._ips.push(addresses);
            this._connect_nm_device_state_changed(nm_dev);
        }
    }

    _retrieve_wifi_ssid(iface) {
        const nm_dev = this._client.get_device_by_iface(iface);
        if (!nm_dev || nm_dev.get_device_type() !== NM.DeviceType.WIFI)
            return null;
        const ap = nm_dev.get_active_access_point();
        if (!ap) return null;
        const ssid = ap.get_ssid();
        return ssid ? new TextDecoder().decode(ssid.get_data()) : null;
    }

    _connect_nm_device_state_changed(nm_device) {
        if (!nm_device) return;
        const iface = nm_device.get_iface();
        if (this._nm_devices_signals_map.has(iface)) return;
        const sid = nm_device.connect('state-changed',
            () => this._trigger_ips_reload());
        this._nm_devices_signals_map.set(iface, [nm_device, sid]);
    }

    _disconnect_all_nm_device_state_changed() {
        for (const [nm_device, sid] of this._nm_devices_signals_map.values())
            GObject.signal_handler_disconnect(nm_device, sid);
        this._nm_devices_signals_map.clear();
    }

    _getAddresses(nm_device, family) {
        if (!nm_device) return [];
        const ip_cfg = family === GLib.SYSDEF_AF_INET
            ? nm_device.get_ip4_config()
            : nm_device.get_ip6_config();
        if (!ip_cfg) return [];
        return ip_cfg.get_addresses()
            .map(a => `${a.get_address()}/${a.get_prefix()}`);
    }
}
