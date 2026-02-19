/*
 * NetPulse - net_speed_layout_menu_item.js
 * A single row in the drop-down menu showing device name, speeds, IPs.
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const NetSpeedLayoutMenuItem = GObject.registerClass(
class NetSpeedLayoutMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(device, icon, menu_label_size) {
        super._init();
        this.device = device;

        this._device_title = new St.Label({
            text: device,
            style_class: 'ns-menuitem',
        });
        this._device_title.get_clutter_text().set_line_wrap(true);

        this._down_label = new St.Label({ text: '', style_class: 'ns-menuitem' });
        this._up_label   = new St.Label({ text: '', style_class: 'ns-menuitem' });
        this._ips_label  = new St.Label({ text: '', style_class: 'ns-menuitem' });

        this.add_child(icon ?? new St.Label());
        this.add_child(this._device_title);
        this.add_child(this._down_label);
        this.add_child(this._up_label);
        this.add_child(this._ips_label);

        this.update_ui(menu_label_size);
        this.show_ip(false);
    }

    update_ui(menu_label_size) {
        this._device_title.set_width(menu_label_size);
        this._down_label.set_width(menu_label_size);
        this._up_label.set_width(menu_label_size);
        this._ips_label.set_width(menu_label_size);
    }

    update_speeds(speed) {
        this._down_label.set_text(speed.down);
        this._up_label.set_text(speed.up);
    }

    show_ip(value) {
        value ? this._ips_label.show() : this._ips_label.hide();
    }

    update_ips(ips) {
        this._ips_label.set_text(ips.join('\n'));
    }
});
