/// <reference types="minecraft-scripting-types-client" />

import * as dotProp from "dot-prop"

/**
 * @license
 *
 * MIT License
 *
 * Copyright (c) 2019 Richie Bendall
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * A simplified implementation of the Minecraft Bedrock API.
 * @class
 */
export class DevBed {

    /**
    * The system object.
    */
    public system: any

    /**
    * The total ticks that have passed since the script started.
    */
    public ticks = 0

    /**
    * The callbacks for the events.
    */
    private callbacks: any = {}

    /**
    * The config of the script logger
    */
    private scriptLoggerConfig: any

    /**
    * The API version targeted by DevBed.
    */
    public version = {
        major: 0,
        minor: 0
    }

    /**
    * @method
    * @param {any} c - The client object.
    */
    constructor(c: any = client) {
        this.system = c.registerSystem(this.version.major, this.version.minor);

        this.system.initialize = (ev: any) => {
            this.callEach(this.callbacks.initialize, ev)
        };

        this.system.update = (ev: any) => {
            this.ticks++
            this.callEach(this.callbacks.update, ev)
        }

        this.system.shutdown = (ev: any) => {
            this.callEach(this.callbacks.shutdown, ev)
        }

        const eventDataDefaults = { name: "", isDevBed: true, data: {} }
        this.system.registerEventData("devbed:ev", eventDataDefaults)

        this.system.listenForEvent("devbed:ev", (ev: { data: { isDevBed: any; name: string | number; data: any; }; }) => {
            if (!ev.data.isDevBed) return;
            this.callEach(this.callbacks[ev.data.name], ev.data.data)
        })
    }

    /** Core: Listeners
    *   ===============   */

    /**
    * Call each callback in the array with the provided data.
    * @method
    * @param {Function[]} arr - The array of callbacks.
    * @param {any} data - The data to provide in the callback.
    */
    private callEach(arr: Function[], data?: any): void {
        if (Array.isArray(arr)) arr.map((cb: Function) => cb(data))
    }

    /**
    * Listen for an event.
    * @method
    * @param {string} event - The event identifier.
    * @param {Function} callback - The callback to trigger.
    */
    public on(event: string, callback: Function): void {
        if (event in ["initialize", "update", "shutdown"]) this.callbacks[event].push(callback)
        else {
            this.system.listenForEvent(event, callback);
        }
    }

    /**
    * Remove an event listener for an event.
    * @method
    * @param {string} event - The event identifier.
    * @param {Function} callback - The callback to remove.
    */
    public off(event: string, callback: Function): void {
        this.callbacks[event] = this.callbacks[event].filter((val: Function) => val !== callback)
    }

    /**
    * Listen for an event and trigger the callback once.
    * @method
    * @param {string} event - The event identifier.
    * @param {Function} callback - The callback to trigger.
    */
    public once(event: string, callback: Function): void {
        this.callbacks[event].push(() => {
            this.off(event, callback)
            callback()
        })
    }

    /** Core: Triggers
    *   ==============   */

    /**
    * Send an event.
    * @method
    * @param {string} name - The name of the event to post.
    * @param {object} [data={}] - The data to include in the event.
    * @param {any} [send=name] - The object describing where to send the event.
    */
    private sendEvent(name: string, data: object = {}, send: any = name) {
        let eventData = this.system.createEventData(name);
        eventData.data = { ...eventData.data, ...data }

        this.system.broadcastEvent(send, eventData);
    }

    /**
    * Broadcast a custom event.
    * @method
    * @param {string} message - The message to post.
    * @param {string} data - The data to pass to the event handlers.
    */
    public bc(name: string, data: object = {}): void {
        this.sendEvent("devbed:ev", { name, data })
    }

    /**
    * Trigger an event.
    * @method
    * @param {string} event - The event identifier.
    * @param {Function} data - The data to pass to the event handlers.
    */
    public trigger(event: string, data: object = {}) {
        this.sendEvent(event, data)
    }

    /** Ext: Triggers
    *   =============   */

    /**
    * Post a message in chat.
    * @method
    * @param {string} message - The message to post.
    */
    public chat(message: string): void {
        this.sendEvent("minecraft:display_chat_event", { message }, SendToMinecraftClient.DisplayChat)
    }

    /**
    * Configure the logging.
    * @method
    */
    public logconfig({
        info = false,
        warning = false,
        error = true
    } = {}): void {
        if (!this.scriptLoggerConfig) this.scriptLoggerConfig = this.system.createEventData(SendToMinecraftClient.ScriptLoggerConfig);
        this.scriptLoggerConfig.data = {
            ...this.scriptLoggerConfig.data,
            log_errors: error,
            log_warnings: warning,
            log_information: info
        }
        this.system.broadcastEvent(SendToMinecraftClient.ScriptLoggerConfig, this.scriptLoggerConfig);
    }

    /** Core: Data
    *   ==========   */

    /**
    * Get or set data.
    * @method
    * @param {any} ref - The reference to the component.
    * @param {any} name - The name of the component in the reference.
    * @param {any} path - The path of the component.
    * @param {any} value - The value to set the data to.
    */
    public data(ref: any, name: any, path?: string, value?: any): void | any {
        let data = this.system.getComponent(ref, name);
        if (!value) return path ? dotProp.get(data, path) : data
        if (path) dotProp.set(data, path, value)
        else data = value
        this.system.applyComponentChanges(ref, data)
    }

}
