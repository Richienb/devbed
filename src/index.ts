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

/// <reference types="minecraft-scripting-types-client" />
/// <reference types="minecraft-scripting-types-server" />

/**
* Entity object.
*/
interface BedEntity extends IEntity {
    /**
    * Destroy the entity object.
    */
    remove: true | null,

    /**
    * Check if the entity object is valid.
    */
    isValid: boolean | null
}

/**
* Query object.
*/
interface BedQuery extends IQuery {
    /**
    * Add a filter to the query.
    * @param identifier The identifier to use in the query.
    */
    filter(identifier: string): void,

    /**
    * Get the entities that the query captured.
    * @param cfields Filter the result by component fields.
    */
    search(cfields?: [number, number, number, number, number, number]): any[] | null
}

/**
* Component object.
*/
interface BedComponent extends IComponent<any> {
    /**
    * Add the component to an entity.
    * @param ident The identifier of the entity.
    * @param existsOk If false an error will be thrown if the component already exists on the entity.
    */
    add(ent: IEntity | BedEntity, existsOk: boolean): boolean | null,

    /**
    * Check if an entity has a component.
    * @param ent The identifier of the entity.
    */
    has(ent: IEntity | BedEntity): boolean | null,

    /**
    * Get or set the data of an entity.
    * @param ent The identifier of the entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(ent: IEntity | BedEntity, data?: object | Function): IComponent<any> | boolean | null,

    /**
    * Reload the component.
    * @param ent The identifier of the entity.
    */
    reload(ent: IEntity | BedEntity): boolean | null,

    /**
    * Remove the component from an entity.
    * @param ent The identifier of the entity.
    */
    remove(ent: IEntity | BedEntity): boolean | null
}

/**
* Component object from getComponent.
*/
interface BedGetComponent extends BedComponent {
    /**
    * Get or set the data of an entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(data: object | Function): IComponent<any> | boolean | null
}

/**
* A simplified implementation of the Minecraft Bedrock Scripting API.
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
    * The extended properties.
    */
    public ext: any = {}

    /**
    * The API version targeted by DevBed.
    */
    public static readonly version = {
        major: 0,
        minor: 0,
    }

    /**
    * The namespace name used by DevBed.
    */
    private readonly bedspace: string = "devbed"

    /**
    * @param c The client or server object.
    * @param bedspace The main DevBed namespace name to use.
    */
    constructor(o: IClient | IServer, { bedspace = "devbed" } = {}) {
        this.system = o.registerSystem(DevBed.version.minor, DevBed.version.major)

        this.bedspace = bedspace

        this.system.initialize = (ev: IEventData<any>) => {
            this.callEach(this.callbacks.initialize, ev)
        }

        this.system.update = (ev: IEventData<any>) => {
            this.ticks++
            this.callEach(this.callbacks.update, ev)
        }

        this.system.shutdown = (ev: IEventData<any>) => {
            this.callEach(this.callbacks.shutdown, ev)
        }

        this.system.registerEventData(`${this.bedspace}:ev`, { name: "", isDevBed: true, data: {} })

        this.system.listenForEvent(`${this.bedspace}:ev`, (ev: { data: { isDevBed: true; name: string; data: object; }; }) => {
            if (ev.data.isDevBed !== true) throw new Error(`Conflict detected. Please ensure ${this.bedspace}:ev is not used by other scripts. If the issue persists, try changing your bedspace.`)
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
        return `${this.bedspace}_${this.ids}`
    }

    /**
    * Create an entity.
    * @param entityType The type of entity to create.
    * @param identifier The template identifier of the enitity to create.
    * @entity
    */
    private createEntity(entityType?: "entity" | "item_entity", identifier?: string): BedEntity | null {
        const obj = entityType && identifier ? this.system.createEntity(entityType, identifier) : this.system.createEntity()
        if (typeof obj === "object") {
            obj.remove = (): true | null => this.system.destroyEntity(obj)
            obj.isValid = (): boolean | null => this.system.isValidEntity(obj)
        }
        return obj
    }

    /**
    * Create an entity.
    * @param identifier The template identifier of the enitity to create.
    * @entity
    */
    public entity(identifier?: string): BedEntity | null {
        return this.createEntity("entity", identifier)
    }


    /**
    * Create an item.
    * @param identifier The template identifier of the item to create.
    * @entity
    */
    public item(identifier?: string): BedEntity | null {
        return this.createEntity("item_entity", identifier)
    }

    /**
    * Parse the transformation of an array or object.
    * @param data The object to be transformed.
    * @param transform The transformation to apply.
    */
    private parseTransform(data: object | any[], transform: object | any[] | Function): object | any[] | void {
        if (Array.isArray(data) && Array.isArray(transform)) return [...data, ...transform]
        else if (typeof data === "object" && typeof transform === "object") return { ...data, ...transform }
        else if (typeof transform === "function") return transform(data)
    }

    /**
    * Transform IComponent to BedComponent.
    * @param id The identifier of the component.
    * @param obj The IComponent object.
    * @component
    */
    private transformComponent(id: string, obj: any): BedComponent | null {
        if (typeof obj === "object") {
            obj.add = (ent: IEntity | BedEntity, existsOk: boolean = true): boolean | null => {
                if (!existsOk && obj.has(ent)) throw new TypeError("Component already exists!")
                return this.system.createComponent(id, ent)
            }
            obj.has = (ent: IEntity | BedEntity): boolean | null => this.system.hasComponent(ent, id)
            obj.data = (ent: IEntity | BedEntity, data?: object | Function): IComponent<any> | boolean | null => {
                const curr = this.system.getComponent(ent, id)
                if (!data) return curr

                return this.system.applyComponentChanges(ent, this.parseTransform(curr, data))
            }
            obj.reload = (ent: IEntity | BedEntity): boolean | null => this.system.applyComponentChanges(ent, id)
            obj.remove = (ent: IEntity | BedEntity): boolean | null => this.system.destroyComponent(ent, id)
        }
        return obj
    }

    /**
    * Create a component.
    * @param id The identifier of the component to create.
    * @param data The date to associate with the component.
    * @component
    */
    public component(id: string = this.getId(), data: object = {}): BedComponent | null {
        const obj = this.system.registerComponent(id, data)
        return this.transformComponent(id, obj)
    }

    /**
    * Get the component of an entity.
    * @param id The identifier of the component to create.
    * @param ent The entity with the component.
    * @component
    */
    public getComponent(id: string, ent: IEntity | BedEntity): BedGetComponent | null {
        const obj = this.system.getComponent(ent, id);
        const tobj = this.transformComponent(id, obj)
        if (typeof tobj === "object" && tobj != null) {
            const d = tobj.data
            tobj.data = (data: object | Function): IComponent<any> | boolean | null => d(ent, data)
        }
        return tobj
    }

    /**
    * Call each callback in the array with the provided data.
    * @param arr The array of callbacks.
    * @param data The data to provide in the callback.
    * @events
    */
    private callEach(arr: Function[], data?: any): void {
        if (Array.isArray(arr)) arr.map((cb: Function) => cb(data))
    }

    /**
    * Listen for an event.
    * @param event The event identifier.
    * @param callback The callback to trigger.
    * @events
    */
    public on(event: SendToMinecraftClient | SendToMinecraftServer, callback: Function): void {
        event.split(" ").map((ev) => {
            if (!this.callbacks[ev] && !["initialize", "update", "shutdown"].includes(ev)) this.system.listenForEvent(ev, (e: IEventData<any>) => this.callEach(this.callbacks[ev], e))
            this.callbacks[ev].push(callback)
        })
    }

    /**
    * Remove an event listener for an event.
    * @param event The event identifier.
    * @param callback The callback to remove.
    * @events
    */
    public off(event: SendToMinecraftClient | SendToMinecraftServer, callback?: Function): void {
        event.split(" ").map((ev) => {
            if (callback) this.callbacks[ev] = this.callbacks[ev].filter((val: Function) => val !== callback)
            else this.callbacks[ev] = []
        })
    }

    /**
    * Listen for an event and trigger the callback once.
    * @param event The event identifier.
    * @param callback The callback to trigger.
    * @events
    * @shorthand
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
    * @events
    */
    public trigger(name: string, data: object = {}) {
        const eventData = this.system.createEventData(name)
        eventData.data = { ...eventData.data, ...data }

        this.system.broadcastEvent(name, eventData)
    }

    /**
    * Broadcast a custom event.
    * @param message The message to post.
    * @param data The data to pass to the event handlers.
    * @events
    */
    public bc(name: string, data: object = {}): void {
        this.trigger(`${this.bedspace}:ev`, { name, data })
    }

    /**
    * Post a message in chat.
    * @param message The message to post.
    * @events
    * @shorthand
    */
    public chat(message: string): void {
        this.trigger("minecraft:display_chat_event", { message })
    }

    /**
    * Configure the logging.
    * @events
    * @shorthand
    */
    public logconfig({
        info = false,
        warning = false,
        error = true,
    } = {}): void {
        this.trigger("minecraft:script_logger_config", {
            log_information: info,
            log_errors: error,
            log_warnings: warning,
        })
    }

    /**
    * Query for an object.
    * @param component The component to query.
    * @param fields The 3 query fields as an array of strings.
    * @entity
    */
    public query(component?: string, fields: [string, string, string] = ["x", "y", "z"]): BedQuery | null {
        const obj = component ? this.system.registerQuery(component, fields[0], fields[1], fields[2]) : this.system.registerQuery()
        if (typeof obj === "object") {
            obj.filter = (identifier: string): void => this.system.addFilterToQuery(obj, identifier)
            obj.search = (cfields?: [number, number, number, number, number, number]): any[] | null => cfields ?
                this.system.getEntitiesFromQuery(obj, cfields[0], cfields[1], cfields[2], cfields[3], cfields[4], cfields[5]) :
                this.system.getEntitiesFromQuery(obj)
        }
        return obj
    }

    /**
    * Get the entities within a specific radius of an entity.
    * @param id The id of the center entity.
    * @param radius The radius to search.
    * @slash
    */
    public radius(id: string, radius: number): IEntity | null {
        const spacial_query = this.query("minecraft:position")
        const comp = this.system.getComponent("minecraft:position", id).data
        return !comp ? comp : this.system.getEntitiesFromQuery(spacial_query, comp.x - radius, comp.x + radius, comp.y - radius, comp.y + radius, comp.z - radius, comp.z + radius);
    }

    /**
    * Execute a slash command.
    * @param command The command to execute.
    * @param callback The callback to invoke when the command returned data.
    * @slash
    */
    public cmd(command: string, callback?: Function): void {
        if (!command.startsWith("/")) command = `/${command}`
        this.system.executeCommand(command, ({ data }: IExecuteCommandCallback) => {
            if (callback) callback(data)
        })
    }

    /**
    * Get blocks from the world.
    * @param area The ticking area to use.
    * @param coords 3 coords specifying the location of a block or 6 for an area of blocks.
    * @block
    */
    public block(area: ITickingArea, coords: [number, number, number] | [number, number, number, number, number, number]): IBlock {
        return coords.length === 3 ? this.system.getBlock(area, coords[0], coords[1], coords[2]) : this.system.getBlock(area, coords[0], coords[1], coords[2], coords[3], coords[4], coords[5])
    }

    /**
    * Get the data of a component stored in level.
    * @param id The id of the component.
    * @param data The data to set the component to.
    * @entity
    * @shorthand
    */
    public level(id: string, data?: any[] | object | Function): BedComponent | null | void {
        const obj = this.getComponent(id, this.system.level)
        if (!data) return obj
        if (typeof obj === "object" && obj !== null) obj.data(data)
        return null
    }

    /**
    * Check if a specific block has loaded.
    * @param coords The coords of the block to check.
    * @param callback The callback to fire after checking.
    * @slash
    * @shorthand
    */
    public blockLoaded(coords: [number, number, number], callback: Function): void {
        this.cmd(`testforblock ${coords[0]} ${coords[1]} ${coords[2]} air`, ({ data }: { data: { message: string; statusCode: number; } }) => callback(data.message !== "Cannot test for block outside of the world"))
    }

    /**
    * Check if a specific chunk has loaded.
    * @param coords The coords of the chunk to check.
    * @param callback The callback to fire after checking.
    * @slash
    * @shorthand
    */
    public chunkLoaded(coords: [number, number], callback: Function): void {
        this.blockLoaded([coords[0] * 16, 0, coords[1] * 16], callback)
    }

    /**
    * Extend DevBed functionality.
    * @param data The data to apply to DevBed. Specify names as keys and functions as values.
    * @utility
    */
    public extend(data: { [key: string]: Function }): void {
        this.ext = { ...this.ext, ...data }
    }
}
