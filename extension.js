// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2024 alexlimon404 <https://github.com/alexlimon404>
/*
 * NetPulse - GNOME Shell Extension
 * Displays network upload and download speed in the panel
 *
 * Compatible with GNOME 45, 46, 47 (Ubuntu 24.04+)
 * Based on NetSpeed by Amir Hedayaty <hedayaty@gmail.com>
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { NetSpeed } from './net_speed.js';

export default class NetPulseExtension extends Extension {
    enable() {
        this._netSpeed = new NetSpeed(this);
        this._netSpeed.enable();
    }

    disable() {
        this._netSpeed.disable();
        this._netSpeed = null;
    }
}
