// SPDX-License-Identifier: GPL-2.0-or-later
// SPDX-FileCopyrightText: 2024 alexlimon404 <https://github.com/alexlimon404>
/*
 * NetPulse - lib.js
 * Shared constants and utilities
 */

export const SCHEMA = 'org.gnome.shell.extensions.netpulse';

/**
 * canShowIPs:
 * Always true for GNOME 45+ — the old GJS bug with GPtrArray marshalling
 * (GNOME 3.28–3.32) is long fixed.
 */
export function canShowIPs() {
    return true;
}
