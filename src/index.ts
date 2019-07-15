/// <reference types="minecraft-scripting-types-client" />
/// <reference types="minecraft-scripting-types-server" />

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

interface BedEntity extends IEntity {
    /**
     * Destroy the entity object.
     * */
    remove: true | null,

    /**
     * Check if the entity object is valid.
     * */
    isValid: boolean | null
}

interface BedQuery extends IQuery {
    /**
     * Add a filter to the query.
     * @param identifier The identifier to use in the query.
     * */
    filter(identifier: string): void,

    /**
     * Get the entities that the query captured.
     * @param cfields Filter the result by component fields.
     * */
    entities(cfields?: [number, number, number, number, number, number]): any[] | null
}

interface BedComponent extends IComponent<any> {
    /**
     * Add the component to an entity.
     * @param ident The identifier of the entity.
     * @param existsOk If false an error will be thrown if the component already exists on the entity.
     * */
    add(ent: IEntity | BedEntity, existsOk: boolean): boolean | null,

    /**
    * Check if an entity has a component.
    * @param ent The identifier of the entity.
    * */
    has(ent: IEntity | BedEntity): boolean | null,

    /**
    * Check if an entity has a component.
    * @param ent The identifier of the entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    * */
    data(ent: IEntity | BedEntity, data: object | Function): IComponent<any> | boolean | null,

    /**
    * Reload the component.
    * @param ent The identifier of the entity.
    * */
    reload(ent: IEntity | BedEntity): boolean | null,

    /**
    * Remove the component from an entity.
    * @param ent The identifier of the entity.
    * */
    remove(ent: IEntity | BedEntity): boolean | null
}

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
    * @param c The client or server object.
    */
    constructor(o: IClient | IServer) {
        this.system = o.registerSystem(this.version.major, this.version.minor)

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

    /**
    * The amount of ids that have already been created.
    */
    private ids = -1

    /**
    * Get a new ID for DevBed to use.
    */
    private getId(): string {
        this.ids++
        return `devbed_${this.ids}`
    }


    /** *Script Bindings*
    *   =================   */

    /** Entity Bindings
    *   ===============   */

    /**
    * Create an entity.
    * @param entityType The type of entity to create.
    * @param identifier The template identifier of the enitity to create.
    */
    public entity(entityType?: string, identifier?: string): BedEntity | null {
        let obj = entityType && identifier ? this.system.createEntity(entityType, identifier) : this.system.createEntity()
        if (typeof obj === "object") {
            obj.remove = (): true | null => this.system.destroyEntity(obj)
            obj.isValid = (): boolean | null => this.system.isValidEntity(obj)
        }
        return obj
    }

    /** Component Bindings
    *   ==================   */

    /**
    * Create a component.
    * @param id The identifier of the component to create.
    * @param data The date to associate with the compontent.
    */
    public component(id: string = this.getId(), data: object): BedComponent | null {
        let obj = this.system.registerComponent(id, data)
        if (typeof obj === "object") {
            obj.add = (ent: IEntity | BedEntity, existsOk: boolean = false): boolean | null => {
                if (!existsOk && obj.has(ent)) throw new TypeError("Component already exists!")
                return this.system.createComponent(id, ent)
            }
            obj.has = (ent: IEntity | BedEntity): boolean | null => this.system.hasComponent(ent, id)
            obj.data = (ent: IEntity | BedEntity, data?: object | Function): IComponent<any> | boolean | null => {
                let curr = this.system.getComponent(ent, id)
                if (!data) return curr

                if (typeof data === "function") curr = data(curr)
                else curr = { ...curr, ...data }

                return this.system.applyComponentChanges(ent, curr)
            }
            obj.reload = (ent: IEntity | BedEntity): boolean | null => this.system.applyComponentChanges(ent, id)
            obj.remove = (ent: IEntity | BedEntity): boolean | null => this.system.destroyComponent(ent, id)
        }
        return obj
    }

    /** Event Bindings
    *   ==============   */

    /**
    * Call each callback in the array with the provided data.
    * @param arr The array of callbacks.
    * @param data The data to provide in the callback.
    */
    private callEach(arr: Function[], data?: any): void {
        if (Array.isArray(arr)) arr.map((cb: Function) => cb(data))
    }

    /**
    * Listen for an event.
    * @param event The event identifier.
    * @param callback The callback to trigger.
    */
    public on(event: SendToMinecraftClient | SendToMinecraftServer, callback: Function): void {
        event.split(" ").map(e => {
            if (!this.callbacks[e] && !["initialize", "update", "shutdown"].includes(e)) this.system.listenForEvent(e, (ev: any) => {
                this.callEach(this.callbacks[e], ev)
            })
            this.callbacks[e].push(callback)
        })
    }

    /**
    * Remove an event listener for an event.
    * @param event The event identifier.
    * @param callback The callback to remove.
    */
    public off(event: SendToMinecraftClient | SendToMinecraftServer, callback?: Function): void {
        event.split(" ").map(e => {
            if (callback) this.callbacks[e] = this.callbacks[e].filter((val: Function) => val !== callback)
            else this.callbacks[e] = []
        })
    }

    /**
    * Listen for an event and trigger the callback once.
    * @param event The event identifier.
    * @param callback The callback to trigger.
    */
    public once(event: SendToMinecraftClient | SendToMinecraftServer, callback: Function): void {
        const handleFire = (ev: any) => {
            this.off(event, handleFire)
            callback(ev)
        }
        this.on(event, handleFire)
    }

    /**
    * Trigger an event.
    * @param name The name of the event to post.
    * @param data The data to include in the event.
    */
    public trigger(name: string, data: object = {}) {
        let eventData = this.system.createEventData(name)
        eventData.data = { ...eventData.data, ...data }

        this.system.broadcastEvent(name, eventData)
    }

    /**
    * Broadcast a custom event.
    * @param message The message to post.
    * @param data The data to pass to the event handlers.
    */
    public bc(name: string, data: object = {}): void {
        this.trigger("devbed:ev", { name, data })
    }

    /**
    * Post a message in chat.
    * @param message The message to post.
    */
    public chat(message: string): void {
        this.trigger("minecraft:display_chat_event", { message })
    }

    /**
    * Configure the logging.
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

    /** Entity Queries
    *   ==============   */

    /**
    * Query for an object.
    * @param component The component to query.
    * @param fields The 3 query fields as an array of strings.
    */
    public query(component: string, fields?: [string, string, string]): BedQuery | null {
        let obj = fields ? this.system.registerQuery(component, fields[0], fields[1], fields[2]) : this.system.registerQuery(component)
        if (typeof obj === "object") {
            obj.filter = (identifier: string): void => this.system.addFilterToQuery(obj, identifier)
            obj.entities = (cfields?: [number, number, number, number, number, number]): any[] | null => cfields ?
                this.system.getEntitiesFromQuery(obj, cfields[0], cfields[1], cfields[2], cfields[3], cfields[4], cfields[5]) :
                this.system.getEntitiesFromQuery(obj)
        }
        return obj
    }

    /** Slash Commands
    *   ==============   */

    /**
    * Execute a slash command.
    * @param command The command to execute.
    * @param callback The callback to invoke when the command returned data.
    */
    public cmd(command: string, callback?: Function): void {
        if (!command.startsWith("/")) command = `/${command}`
        this.system.executeCommand(command, ({ data }: any) => {
            if (callback) callback(data)
        })
    }

    /** Block Bindings
    *   ==============   */

    /**
    * Get blocks from the world.
    * @param area The ticking area to use.
    * @param coords 3 coords specifying the location of a block or 6 for an area of blocks.
    */
    public block(area: ITickingArea, coords: [number, number, number] | [number, number, number, number, number, number]): IBlock {
        return coords.length === 3 ? this.system.getBlock(area, coords[0], coords[1], coords[2]) : this.system.getBlock(area, coords[0], coords[1], coords[2], coords[3], coords[4], coords[5])
    }
}
