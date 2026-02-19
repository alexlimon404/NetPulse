/*
 * NetPulse - prefs.js
 * Preferences window using libadwaita (Adw), available since GNOME 45 / Ubuntu 24.04.
 *
 * Uses fillPreferencesWindow() — the modern approach for GNOME 45+ extensions.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import NM from 'gi://NM';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/shell/extensions/prefs.js';

export default class NetPulsePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(600, 700);

        const page = new Adw.PreferencesPage();
        window.add(page);

        // ── General ──────────────────────────────────────────────────────────
        const generalGroup = new Adw.PreferencesGroup({ title: _('General') });
        page.add(generalGroup);

        // Device selector
        const nmc       = NM.Client.new(null);
        const nmDevices = nmc.get_devices() ?? [];
        const devKeys   = ['all', 'defaultGW'];
        const devModel  = new Gtk.StringList();
        devModel.append(_('All interfaces'));
        devModel.append(_('Default Gateway'));

        const supportedTypes = [
            NM.DeviceType.ETHERNET, NM.DeviceType.WIFI,
            NM.DeviceType.BT, NM.DeviceType.OLPC_MESH,
            NM.DeviceType.WIMAX, NM.DeviceType.MODEM,
        ];
        for (const dev of nmDevices) {
            if (supportedTypes.includes(dev.device_type)) {
                devModel.append(dev.interface);
                devKeys.push(dev.interface);
            }
        }

        const devRow = new Adw.ComboRow({
            title:    _('Device to Monitor'),
            subtitle: _('Select which network interface to display'),
            model:    devModel,
        });
        const currentDev = settings.get_string('device') || 'all';
        const devIdx     = devKeys.indexOf(currentDev);
        devRow.selected  = devIdx >= 0 ? devIdx : 0;
        devRow.connect('notify::selected', () => {
            settings.set_string('device', devKeys[devRow.selected]);
        });
        generalGroup.add(devRow);

        // Placement
        const placementModel = new Gtk.StringList();
        placementModel.append(_('Right'));
        placementModel.append(_('Left'));
        const placementRow = new Adw.ComboRow({
            title:   _('Panel Placement'),
            model:   placementModel,
            selected: settings.get_string('placement') === 'left' ? 1 : 0,
        });
        placementRow.connect('notify::selected', () => {
            settings.set_string('placement', placementRow.selected === 1 ? 'left' : 'right');
        });
        generalGroup.add(placementRow);

        // Show sum
        const showSumRow = new Adw.SwitchRow({
            title:    _('Show Combined Speed'),
            subtitle: _('Display total (UP + Down) instead of two separate values'),
        });
        settings.bind('show-sum', showSumRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(showSumRow);

        // Vertical alignment
        const vertAlignRow = new Adw.SwitchRow({
            title:    _('Vertical Layout'),
            subtitle: _('Stack upload and download speeds on two rows'),
        });
        settings.bind('vert-align', vertAlignRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(vertAlignRow);

        // Show icon
        const showIconRow = new Adw.SwitchRow({
            title:    _('Show Network Icon'),
            subtitle: _('Display the interface type icon next to the speed'),
        });
        settings.bind('icon-display', showIconRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(showIconRow);

        // Show IPs
        const showIpsRow = new Adw.SwitchRow({
            title:    _('Show IP Addresses'),
            subtitle: _('Show the IP addresses of each interface in the menu'),
        });
        settings.bind('show-ips', showIpsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        generalGroup.add(showIpsRow);

        // ── Units ─────────────────────────────────────────────────────────────
        const unitsGroup = new Adw.PreferencesGroup({ title: _('Units') });
        page.add(unitsGroup);

        const useBytesRow = new Adw.SwitchRow({
            title:    _('Bytes per Second'),
            subtitle: _('On: B/s  —  Off: b/s (bits per second)'),
        });
        settings.bind('use-bytes', useBytesRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        unitsGroup.add(useBytesRow);

        const binPrefixRow = new Adw.SwitchRow({
            title:    _('Binary Prefixes'),
            subtitle: _('On: MiB/s, GiB/s  —  Off: MB/s, GB/s'),
        });
        settings.bind('bin-prefixes', binPrefixRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        unitsGroup.add(binPrefixRow);

        // ── Layout ────────────────────────────────────────────────────────────
        const layoutGroup = new Adw.PreferencesGroup({ title: _('Label Sizes') });
        page.add(layoutGroup);

        const labelSizeRow = new Adw.SpinRow({
            title: _('Speed Label Width (px)'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 300, step_increment: 1 }),
        });
        settings.bind('label-size', labelSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        layoutGroup.add(labelSizeRow);

        const unitSizeRow = new Adw.SpinRow({
            title: _('Unit Label Width (px)'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 200, step_increment: 1 }),
        });
        settings.bind('unit-label-size', unitSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        layoutGroup.add(unitSizeRow);

        const menuSizeRow = new Adw.SpinRow({
            title: _('Menu Label Width (px)'),
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 300, step_increment: 1 }),
        });
        settings.bind('menu-label-size', menuSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        layoutGroup.add(menuSizeRow);

        const digitsRow = new Adw.SpinRow({
            title:    _('Digits'),
            subtitle: _('Number of significant digits shown'),
            adjustment: new Gtk.Adjustment({ lower: 3, upper: 10, step_increment: 1 }),
        });
        settings.bind('digits', digitsRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        layoutGroup.add(digitsRow);

        // ── Advanced ──────────────────────────────────────────────────────────
        const advGroup = new Adw.PreferencesGroup({ title: _('Advanced') });
        page.add(advGroup);

        const timerRow = new Adw.SpinRow({
            title:    _('Update Interval (ms)'),
            subtitle: _('How often the speed is recalculated'),
            adjustment: new Gtk.Adjustment({ lower: 100, upper: 10000, step_increment: 100 }),
        });
        settings.bind('timer', timerRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        advGroup.add(timerRow);
    }
}
