/*
 * NetPulse - net_speed_status_icon.js
 * Panel button: speed labels, network icon, drop-down menu.
 *
 * Changes vs NetSpeed original:
 *   - ES imports
 *   - add_actor → add_child
 *   - Lang.bind → arrow functions
 *   - ExtensionUtils.openPrefs() → extension.openPreferences()
 */

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { NetSpeedLayoutMenuItem } from './net_speed_layout_menu_item.js';

export const NetSpeedStatusIcon = GObject.registerClass(
class NetSpeedStatusIcon extends PanelMenu.Button {
    _init(net_speed, extension) {
        super._init(0.0);
        this._net_speed  = net_speed;
        this._extension  = extension;

        // ── outer box ──────────────────────────────────────────────────────
        this._box = new St.BoxLayout();
        this.add_child(this._box);
        this.connect('button-release-event',
            (actor, event) => this._toggle_showsum(actor, event));

        // ── download row ───────────────────────────────────────────────────
        this._download_box = new St.BoxLayout();
        this._down     = new St.Label({ text: '---', style_class: 'ns-horizontal-label',      y_align: Clutter.ActorAlign.CENTER });
        this._downunit = new St.Label({ text: '',    style_class: 'ns-horizontal-unit-label',  y_align: Clutter.ActorAlign.CENTER });
        this._downicon = new St.Label({ text: '⬇',  style_class: 'ns-horizontal-icon',        y_align: Clutter.ActorAlign.CENTER });
        this._download_box.add_child(this._down);
        this._download_box.add_child(this._downunit);
        this._download_box.add_child(this._downicon);

        // ── upload row ─────────────────────────────────────────────────────
        this._upload_box = new St.BoxLayout();
        this._up     = new St.Label({ text: '---', style_class: 'ns-horizontal-label',      y_align: Clutter.ActorAlign.CENTER });
        this._upunit = new St.Label({ text: '',    style_class: 'ns-horizontal-unit-label',  y_align: Clutter.ActorAlign.CENTER });
        this._upicon = new St.Label({ text: '⬆',  style_class: 'ns-horizontal-icon',        y_align: Clutter.ActorAlign.CENTER });
        this._upload_box.add_child(this._up);
        this._upload_box.add_child(this._upunit);
        this._upload_box.add_child(this._upicon);

        // ── sum row ────────────────────────────────────────────────────────
        this._sum_box  = new St.BoxLayout();
        this._sum      = new St.Label({ text: '---', style_class: 'ns-horizontal-label',     y_align: Clutter.ActorAlign.CENTER });
        this._sumunit  = new St.Label({ text: '',    style_class: 'ns-horizontal-unit-label', y_align: Clutter.ActorAlign.CENTER });
        this._sum_box.add_child(this._sum);
        this._sum_box.add_child(this._sumunit);

        // ── metrics container ──────────────────────────────────────────────
        this._metrics_box = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
        this._metrics_box.add_child(this._download_box);
        this._metrics_box.add_child(this._upload_box);
        this._metrics_box.add_child(this._sum_box);
        this._box.add_child(this._metrics_box);

        // ── network type icon ──────────────────────────────────────────────
        this._icon_box = new St.BoxLayout();
        this._icon = this._get_icon(
            this._net_speed.get_device_type(this._net_speed.getDevice()));
        this._icon_box.add_child(this._icon);
        this._box.add_child(this._icon_box);

        // ── drop-down menu ─────────────────────────────────────────────────
        const prefBtn = new St.Button({ child: this._get_icon('pref') });
        prefBtn.connect('clicked', () => this._extension.openPreferences());

        this._menu_title = new NetSpeedLayoutMenuItem(
            _('Device'), prefBtn, this._net_speed.menu_label_size);
        this._menu_title.connect('activate',
            (_item, _event) => this._change_device(''));
        this._menu_title.update_speeds({ up: _('Up'), down: _('Down') });
        this._menu_title.update_ips([_('IP')]);
        this._menu_title.show_ip(this._net_speed.show_ips);
        this.menu.addMenuItem(this._menu_title);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._layouts = [];
        this.updateui();
    }

    // ── private ───────────────────────────────────────────────────────────────

    _change_device(device) {
        this._net_speed.setDevice(device);
        this.updateui();
        this._net_speed.save();
    }

    _toggle_showsum(_actor, event) {
        if (event.get_button() === 2) { // middle-click
            this._net_speed.showsum = !this._net_speed.showsum;
            this.updateui();
            this._net_speed.save();
        }
    }

    _get_icon(name, size = 16) {
        const icons = {
            ethernet: 'network-wired-symbolic',
            wifi:     'network-wireless-signal-excellent-symbolic',
            bt:       'bluetooth-active-symbolic',
            olpcmesh: 'network-wired-symbolic',
            wimax:    'network-wireless-signal-excellent-symbolic',
            modem:    'network-transmit-receive-symbolic',
            up:       'go-up-symbolic',
            down:     'go-down-symbolic',
            pref:     'emblem-system-symbolic',
        };
        return new St.Icon({
            icon_name: icons[name] ?? 'network-transmit-receive-symbolic',
            icon_size: size,
        });
    }

    // ── public ────────────────────────────────────────────────────────────────

    updateui() {
        const ns = this._net_speed;

        // label widths
        this._sum.set_width(ns.label_size);
        this._sumunit.set_width(ns.unit_label_size);
        this._up.set_width(ns.label_size);
        this._upunit.set_width(ns.unit_label_size);
        this._down.set_width(ns.label_size);
        this._downunit.set_width(ns.unit_label_size);

        // show/hide sum vs up+down
        if (!ns.showsum) {
            this._sum.hide();
            this._sumunit.hide();
            this._up.show();    this._upunit.show();   this._upicon.show();
            this._down.show();  this._downunit.show(); this._downicon.show();
            this.set_vertical_alignment(ns.vert_align);
        } else {
            this._sum.show();   this._sumunit.show();
            this._up.hide();    this._upunit.hide();   this._upicon.hide();
            this._down.hide();  this._downunit.hide(); this._downicon.hide();
            this.set_vertical_alignment(false);
        }

        // update network type icon
        this._icon.destroy();
        this._icon = this._get_icon(ns.get_device_type(ns.getDevice()));
        this._icon_box.add_child(this._icon);
        ns.use_icon ? this._icon.show() : this._icon.hide();

        // update menu
        this._menu_title.update_ui(ns.menu_label_size);
        this._menu_title.show_ip(ns.show_ips);
        for (const layout of this._layouts) {
            layout.update_ui(ns.menu_label_size);
            layout.show_ip(ns.show_ips);
        }
    }

    set_labels(sum, up, down) {
        this._sum.set_text(sum.text);
        this._sumunit.set_text(sum.unit);
        this._up.set_text(up.text);
        this._upunit.set_text(up.unit);
        this._down.set_text(down.text);
        this._downunit.set_text(down.unit);
    }

    create_menu(devices, types) {
        for (const layout of this._layouts)
            layout.destroy();
        this._layouts = [];

        for (let i = 0; i < devices.length; ++i) {
            const icon   = this._get_icon(types[i]);
            const layout = new NetSpeedLayoutMenuItem(
                devices[i], icon, this._net_speed.menu_label_size);
            layout.show_ip(this._net_speed.show_ips);
            const dev = devices[i]; // capture for closure
            layout.connect('activate', (_item, _event) => this._change_device(dev));
            this._layouts.push(layout);
            this.menu.addMenuItem(layout);
        }
    }

    update_speeds(speeds) {
        for (let i = 0; i < speeds.length; ++i)
            this._layouts[i]?.update_speeds(speeds[i]);
    }

    update_ips(ips) {
        for (let i = 0; i < ips.length; ++i)
            this._layouts[i]?.update_ips(ips[i]);
    }

    set_vertical_alignment(vertical) {
        this._metrics_box.set_vertical(vertical);
        const cls = vertical ? 'vertical' : 'horizontal';
        this._down.set_style_class_name(`ns-${cls}-label`);
        this._downunit.set_style_class_name(`ns-${cls}-unit-label`);
        this._downicon.set_style_class_name(`ns-${cls}-icon`);
        this._up.set_style_class_name(`ns-${cls}-label`);
        this._upunit.set_style_class_name(`ns-${cls}-unit-label`);
        this._upicon.set_style_class_name(`ns-${cls}-icon`);
    }
});
