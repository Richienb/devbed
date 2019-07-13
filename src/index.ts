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
    * The API version targeted by DevBed.
    */
    public version = {
        major: 0,
        minor: 0
    }

    /**
    * @method
    * @param c - The client object.
    */
    constructor(c: any = client) {
        this.system = c.registerSystem(this.version.major, this.version.minor)

        this.system.initialize = (ev: any) => {
            this.callEach(this.callbacks.initialize, ev)
        }

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
            if (!ev.data.isDevBed) return
            this.callEach(this.callbacks[ev.data.name], ev.data.data)
        })
    }

    /** Core: Listeners
    *   ===============   */

    /**
    * Call each callback in the array with the provided data.
    * @method
    * @param arr - The array of callbacks.
    * @param data - The data to provide in the callback.
    */
    private callEach(arr: Function[], data?: any): void {
        if (Array.isArray(arr)) arr.map((cb: Function) => cb(data))
    }

    /**
    * Listen for an event.
    * @method
    * @param event - The event identifier.
    * @param callback - The callback to trigger.
    */
    public on(event: string, callback: Function): void {
        event.split(" ").map(e => {
            if (!this.callbacks[e] && !["initialize", "update", "shutdown"].includes(e)) this.system.listenForEvent(e, (ev: any) => {
                this.callEach(this.callbacks[e], ev)
            })
            this.callbacks[e].push(callback)
        })
    }

    /**
    * Remove an event listener for an event.
    * @method
    * @param event - The event identifier.
    * @param callback - The callback to remove.
    */
    public off(event: string, callback?: Function): void {
        event.split(" ").map(e => {
            if (callback) this.callbacks[e] = this.callbacks[e].filter((val: Function) => val !== callback)
            else this.callbacks[e] = []
        })
    }

    /**
    * Listen for an event and trigger the callback once.
    * @method
    * @param event - The event identifier.
    * @param callback - The callback to trigger.
    */
    public once(event: string, callback: Function): void {
        const handleFire = (ev: any) => {
            this.off(event, handleFire)
            callback(ev)
        }
        this.on(event, handleFire)
    }

    /** Core: Triggers
    *   ==============   */

    /**
    * Trigger an event.
    * @method
    * @param name - The name of the event to post.
    * @param data - The data to include in the event.
    */
    public trigger(name: string, data: object = {}) {
        let eventData = this.system.createEventData(name)
        eventData.data = { ...eventData.data, ...data }

        this.system.broadcastEvent(name, eventData)
    }

    /**
    * Broadcast a custom event.
    * @method
    * @param message - The message to post.
    * @param data - The data to pass to the event handlers.
    */
    public bc(name: string, data: object = {}): void {
        this.trigger("devbed:ev", { name, data })
    }

    /** Ext: Triggers
    *   =============   */

    /**
    * Post a message in chat.
    * @method
    * @param message - The message to post.
    */
    public chat(message: string): void {
        this.trigger("minecraft:display_chat_event", { message })
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
        this.trigger("minecraft:script_logger_config", {
            log_information: info,
            log_errors: error,
            log_warnings: warning
        })
    }

    /** Core: Queries
    *   =============   */

    /**
    * Set a prototype value.
    * @method
    * @param val - The variable to modify.
    * @param name - The name of the prototype reference.
    * @param func - The function to trigger when the prototype value is invoked.
    */
    private setProto(val: any, name: string, func: Function): any {
        let prot = Object.getPrototypeOf(val)
        prot[name] = func
        Object.setPrototypeOf(val, prot)
        return val
    }

    /**
    * Query for an object.
    * @method
    * @param component - The component to query.
    * @param fields - The 3 query fields as an array of strings.
    */
    public query(component: any, fields?: [any, any, any]): any {
        let q = fields ? this.system.registerQuery(component, fields[0], fields[1], fields[2]) : this.system.registerQuery(component)
        q = this.setProto(q, "filter", (identifier: any) => this.system.addFilterToQuery(q, identifier))
        q = this.setProto(q, "entities", (cfields?: [any, any, any, any, any, any]) => cfields ?
            this.system.getEntitiesFromQuery(q, cfields[0], cfields[1], cfields[2], cfields[3], cfields[4], cfields[5]) :
            this.system.getEntitiesFromQuery(q))
    }

    /**
    * Execute a slash command.
    * @method
    * @param command - The command to execute.
    * @param callback - The callback to invoke when the command returned data.
    */
    public cmd(command: string, callback?: Function): void {
        if (!command.startsWith("/")) command = `/${command}`
        this.system.executeCommand(command, ({ data }: any) => {
            if (callback) callback(data)
        })
    }

    /** Core: Data
    *   ==========   */

    /**
    * Get or set data.
    * @method
    * @param ref - The reference to the component.
    * @param name - The name of the component in the reference.
    * @param path - The path of the component.
    * @param value - The value to set the data to.
    */
    public data(ref: any, name: any, path?: string, value?: any): void | any {
        let data = this.system.getComponent(ref, name)
        if (!value) return path ? dotProp.get(data, path) : data
        if (path) dotProp.set(data, path, value)
        else data = value
        this.system.applyComponentChanges(ref, data)
    }
}
