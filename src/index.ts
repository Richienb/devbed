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
interface IBedEntity extends IEntity {
    /**
    * Destroy the entity object.
    */
    remove(): void,

    /**
    * Check if the entity object is valid.
    */
    isValid(): boolean
}

/**
* Query object.
*/
interface IBedQuery extends IQuery {
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
interface IBedComponent extends IComponent<any> {
    /**
    * Add the component to an entity.
    * @param ident The identifier of the entity.
    * @param existsOk If false an error will be thrown if the component already exists on the entity.
    */
    add(ent: IEntity | IBedEntity, existsOk: boolean): void,

    /**
    * Check if an entity has a component.
    * @param ent The identifier of the entity.
    */
    has(ent: IEntity | IBedEntity): boolean,

    /**
    * Get or set the data of an entity.
    * @param ent The identifier of the entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(ent: IEntity | IBedEntity, data?: object | Function): IComponent<unknown> | null | void,

    /**
    * Reload the component.
    * @param ent The identifier of the entity.
    */
    reload(ent: IEntity | IBedEntity): void,

    /**
    * Remove the component from an entity.
    * @param ent The identifier of the entity.
    */
    remove(ent: IEntity | IBedEntity): void
}

/**
* Component object from getComponent.
*/
interface IBedGetComponent extends IBedComponent {
    /**
    * Get or set the data of an entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(data: object | Function): IComponent<unknown> | null | void
}

/**
* Custom events exposed by DevBed.
*/
type IBedEvent = "first_tick" | "player_joined" | "player_left"

/**
* The events listenable by DevBed.
*/
type IListenableEvent = SendToMinecraftClient | SendToMinecraftServer | IBedEvent | "initialise" | "update" | "shutdown" | string

/**
* The types of values that can be converted to a string.
*/
type IStringable = string | object | boolean | number

/**
* An array that can hold 3 numbers of which represent coordinates.
*/
type ICoords = [number, number, number]

/**
* Chat colour codes.
*/
/* eslint-disable no-unused-vars */
export enum ChatColours {
    darkRed = "§4",
    red = "§c",
    gold = "§6",
    yellow = "§e",
    darkGreen = "§2",
    green = "§a",
    aqua = "§b",
    darkAqua = "§3",
    darkBlue = "§1",
    blue = "§9",
    lightPurple = "§d",
    darkPurple = "§5",
    white = "§f",
    grey = "§7",
    darkGrey = "§8",
    black = "§0"
}
/* eslint-enable no-unused-vars */

/**
* A simplified implementation of the Minecraft Bedrock Scripting API.
*/
export class DevBed {
    /**
    * The system object.
    */
    public system: IClientSystem<any> | IServerSystem<any>

    /**
    * The type of object the system is.
    */
    private readonly systemType: "client" | "server"

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
    * The default data for custom events.
    */
    private defaultData: any = {}

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
    * The client or server object.
    */
    private readonly obj: IClient | IServer

    /**
    * An array of players in a server.
    */
    public players: string[] = []

    /**
    * @param obj The client or server object.
    * @param bedspace The main DevBed namespace name to use.
    */
    constructor(obj: IClient | IServer, { bedspace = "devbed" } = {}) {
        this.obj = obj
        // @ts-ignore Signature compatibility doesn't matter.
        this.system = this.obj.registerSystem(DevBed.version.minor, DevBed.version.major)
        this.systemType = (this.obj as any).local_player ? "client" : "server"

        this.bedspace = bedspace

        this.system.initialize = () => {
            this.callEachCallback("initialize")
        }

        this.system.update = () => {
            this.ticks++
            if (this.ticks === 1) this.callEachCallback("first_tick")
            this.callEachCallback("update")
        }

        this.system.shutdown = () => {
            if (this.systemType === "client") this.trigger(`${this.bedspace}:playerLeft`, { player: (this.obj as any).local_player })
            this.callEachCallback("shutdown")
        }

        if (this.systemType === "server" && this.system.createEventData(`${this.bedspace}:DevBedEvent`)) this.chat(ChatColours.yellow + `Conflict detected. Please ensure the ${this.bedspace} namespace is not used by other scripts. If the issue persists, try changing your bedspace.`)

        this.newEvent(`${this.bedspace}:DevBedEvent`, { isDevBed: true })

        this.newEvent(`${this.bedspace}:ev`, { sendName: "", id: "", data: {} })

        this.on(`${this.bedspace}:ev`, ({ sendName, data, id }: { sendName: string, data: any, id: string }) => {
            this.callEachCallback(sendName, data, (data: any) => this.trigger(id, data))
        })

        this.newEvent(`${this.bedspace}:blank`)

        this.newEvent(`${this.bedspace}:playerJoined`, { player: {} })
        this.newEvent(`${this.bedspace}:playerLeft`, { player: {} })

        if (this.systemType === "client") this.on("minecraft:client_entered_world", (data: IClientEnteredWorldEventData) => this.trigger(`${this.bedspace}:playerJoined`, data))

        if (this.systemType === "server") {
            this.on(`${this.bedspace}:playerJoined`, ({ player }: IClientEnteredWorldEventData) => {
                // @ts-ignore Component definately exists.
                const username = this.system.getComponent(player, "minecraft:nameable").data.name
                this.players.push(username)
                this.callEachCallback("player_joined", username, player)
            })

            this.on(`${this.bedspace}:playerLeft`, ({ player }: IClientEnteredWorldEventData) => {
                // @ts-ignore Component definately exists.
                const username = this.system.getComponent(player, "minecraft:nameable").data.name
                this.players = this.players.filter((val) => val !== username)
                this.callEachCallback("player_left", username, player)
            })
        }

        if (this.systemType === "server") this.on("internal_executeCommand", ({ data }: { data: { command: string, callback: Function | undefined } }) => this.cmd(data.command, data.callback))
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
        return `${this.bedspace}:custom${this.ids}`
    }

    private maybe(cb: Function, promise: Promise<any>): void
    private maybe(cb: any, promise: Promise<any>): Promise<any>

    /**
    * Convert a promise to a callback function when needed.
    * @param cb The callback to check.
    * @param promise The promise to integrate into the callback.
    */
    private maybe(cb: Function | void, promise: Promise<any>): Promise<any> | void {
        if (!cb) return promise
        promise
            .then((val) => cb(val))
            .catch((err) => {throw err})
        return undefined
    }

    /**
    * Create an entity.
    * @param entityType The type of entity to create.
    * @param identifier The template identifier of the enitity to create.
    * @entity
    */
    private createEntity(entityType?: "entity" | "item_entity", identifier?: string): IBedEntity | null {
        const obj: any = entityType && identifier ? this.system.createEntity(entityType, identifier) : this.system.createEntity()
        if (obj === null) throw new ReferenceError("Unable to create the entity.")
        obj.remove = (): void => void this.system.destroyEntity(obj)
        obj.isValid = (): boolean => Boolean(this.system.isValidEntity(obj))
        return obj
    }

    /**
    * Create an entity.
    * @param identifier The template identifier of the enitity to create.
    * @entity
    */
    public entity(identifier?: string): IBedEntity | null {
        return this.createEntity("entity", identifier)
    }

    /**
    * Create an item.
    * @param identifier The template identifier of the item to create.
    * @entity
    */
    public item(identifier?: string): IBedEntity | null {
        return this.createEntity("item_entity", identifier)
    }

    private parseTransform(data: object, transform: object | Function): object
    private parseTransform(data: any[], transform: any[] | Function): any[]

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
    private transformComponent(id: string, obj: any): IBedComponent | null {
        if (obj === null) throw new ReferenceError("Unable to setup the component.")
        obj.add = (ent: IEntity | IBedEntity, existsOk: boolean = true): void => {
            if (!existsOk && obj.has(ent)) throw new TypeError("Component already exists!")
            this.system.createComponent(ent, id)
        }
        obj.has = (ent: IEntity | IBedEntity): boolean => Boolean(this.system.hasComponent(ent, id))
        obj.data = (ent: IEntity | IBedEntity, data?: object | Function): IComponent<unknown> | null | void => {
            const curr = this.system.getComponent(ent, id)
            if (!data) return curr
            if (curr === null) throw new ReferenceError("Component not found.")

            this.system.applyComponentChanges(ent, this.parseTransform(curr, data) as IComponent<any>)
        }
        obj.reload = (ent: IEntity | IBedEntity): void => {
            const comp = this.system.getComponent(ent, id)
            if (comp) return void this.system.applyComponentChanges(ent, comp)
            throw new ReferenceError("Component not found.")
        }
        obj.remove = (ent: IEntity | IBedEntity): void => void this.system.destroyComponent(ent, id)
        return obj
    }

    /**
    * Create a component.
    * @param data The data to associate with the component.
    * @component
    */
    public component(data: object = {}): IBedComponent | null {
        const id = this.getId()
        const obj = this.system.registerComponent(id, data)
        return this.transformComponent(id, obj)
    }

    /**
    * Get the component of an entity.
    * @param id The identifier of the component to create.
    * @param ent The entity with the component.
    * @component
    */
    public getComponent(id: string, ent: IEntity | IBedEntity): IBedGetComponent | null {
        const obj: any = this.transformComponent(id, this.system.getComponent(ent, id))

        const prevData = obj.data
        obj.data = (data: object | Function): IComponent<unknown> | null | void => prevData(ent, data)

        return obj
    }

    /**
    * Call each callback of a specific name.
    * @param arr The array of callbacks.
    * @param data The data to provide in the callback.
    * @events
    */
    private callEachCallback(name: string, ...data: any): void {
        const callbacks = this.callbacks[name]
        if (callbacks) callbacks.map((cb: Function) => cb(...data))
    }

    /**
    * Setup namespaced event to be listened for.
    * @param event The event identifier.
    * @param defaultData The callback to trigger.
    * @events
    */
    public newEvent(event: string, defaultData: object = {}): void {
        if (!event.includes(":")) this.defaultData[event] = defaultData
        else this.system.registerEventData(event, defaultData)
    }

    public on(event: IListenableEvent, callback: Function): void
    public on(event: IBedEvent, callback: Function | ((data: any, respond?: (data: any) => any) => any)): void

    /**
    * Listen for an event.
    * @param event The event identifier.
    * @param callback The callback to trigger. A respond function is included for custom events.
    * @events
    */
    public on(event: IListenableEvent, callback: Function | ((data: any, respond?: (data: any) => any) => any)): void {
        event.split(" ").map((ev) => {
            if (!this.callbacks[ev]) {
                if (ev.includes(":")) this.system.listenForEvent(ev, ({ data }: IEventData<any>) => this.callEachCallback(ev, data))
                this.callbacks[ev] = []
            }
            this.callbacks[ev].push(callback)
        })
    }

    /**
    * Remove an event listener for an event.
    * @param event The event identifier.
    * @param callback The callback to remove.
    * @events
    */
    public off(event: IListenableEvent, callback?: Function): void {
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
    public once(event: IListenableEvent, callback?: Function): Promise<any> | void {
        return this.maybe(callback, new Promise((resolve) => {
            const handleFire = (ev: any) => {
                this.off(event, handleFire)
                resolve(ev)
            }
            this.on(event, handleFire)
        }))
    }

    /**
    * Trigger an event.
    * @param name The name of the event to post.
    * @param data The data to include in the event.
    * @param callback The callback to handle a responded custom event.
    * @events
    */
    public trigger(name: string, data: object = {}, callback?: Function): void {
        if (!name.includes(":")) {
            const id = this.getId()
            this.newEvent(id)
            if (callback) this.on(id, callback)
            this.trigger(`${this.bedspace}:ev`, {
                sendName: name,
                data: {
                    ...this.defaultData[name],
                    ...data,
                },
                id,
            })
        } else {
            let eventData = this.system.createEventData(name)

            if (eventData === null) {
                eventData = {
                    ...(this.system.createEventData(`${this.bedspace}:blank`) as IEventData<any>),
                    "__identifier__": name,
                }
            }

            eventData.data = { ...eventData.data, ...data }

            this.system.broadcastEvent(name, eventData)
        }
    }

    /**
    * Convert value to string
    * @param val The value to convert.
    */
    private toString(val: IStringable): string {
        return typeof val === "object" ? JSON.stringify(val) : val.toString()
    }

    /**
    * Post a message in chat.
    * @param message The message to post. Accepts unlimited arguments.
    * @events
    * @shorthand
    */
    public chat(...message: IStringable[]): void {
        // TODO: Allow only specific players to be targeted via /tell
        this.trigger("minecraft:display_chat_event", { message: message.map((msg) => this.toString(msg)).join(" ") })
    }

    /**
    * Post formatted json to the chat.
    * @param obj The javascript object.
    * @utility
    * @shorthand
    */
    public json(message: object, indent: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 4): void {
        this.chat(JSON.stringify(message, null, indent))
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
    public query(component?: string, fields: [string, string, string] = ["x", "y", "z"]): IBedQuery | null {
        const obj: any = component ? this.system.registerQuery(component, fields[0], fields[1], fields[2]) : this.system.registerQuery()
        if (obj === null) throw new ReferenceError("Unable to create the query.")
        obj.filter = (identifier: string): void => this.system.addFilterToQuery(obj, identifier)
        obj.search = (cfields?: [number, number, number, number, number, number]): any[] | null => cfields ?
            this.system.getEntitiesFromQuery(obj, cfields[0], cfields[1], cfields[2], cfields[3], cfields[4], cfields[5]) :
            this.system.getEntitiesFromQuery(obj)
        return obj
    }

    /**
    * Get the entities within a specific radius of an entity.
    * @param ent The centre entity.
    * @param radius The radius to search.
    * @slash
    */
    public radius(ent: IEntity | IBedEntity, radius: number): IEntity[] | void {
        const spacialQuery = this.system.registerQuery("minecraft:position", "x", "y", "z")
        const comp: IComponent<any> | null = this.system.getComponent(ent, "minecraft:position")

        if (comp === null || spacialQuery === null) return undefined

        const pos = comp.data
        return this.system.getEntitiesFromQuery(spacialQuery, pos.x - 10, pos.x + 10, pos.y - 10, pos.y + 10, pos.z - 10, pos.z + 10)
    }

    /**
    * Execute a slash command.
    * @param command The command to execute.
    * @param callback The callback to invoke when the command returned data.
    * @slash
    */
    public cmd(command: string | string[], callback?: Function): Promise<object> | void {
        if (this.systemType !== "server") this.trigger("internal_executeCommand", { data: { command, callback } })
        else {
            return this.maybe(callback, new Promise((resolve) => {
                if (Array.isArray(command)) command = command.join(" ");
                (this.system as IServerSystem<any>).executeCommand(command, ({ data }: IExecuteCommandCallback) => resolve(data))
            }))
        }
    }

    /**
    * Get blocks from the world.
    * @param area The ticking area to use.
    * @param coords 3 coords specifying the location of a block or 6 for an area of blocks.
    * @block
    */
    public block(area: ITickingArea, coords: ICoords | [number, number, number, number, number, number]): IBlock | IBlock[][] | null {
        return coords.length === 3 ? this.system.getBlock(area, coords[0], coords[1], coords[2]) : this.system.getBlocks(area, coords[0], coords[1], coords[2], coords[3], coords[4], coords[5])
    }

    /**
    * Get the data of a component stored in level.
    * @param id The id of the component.
    * @param data The data to set the component to.
    * @entity
    * @shorthand
    */
    public level(id: string, data?: any[] | object | Function): IBedComponent | null | void {
        if (this.systemType !== "server") throw new ReferenceError("The level component can only be accessed in the server script.")
        const obj = this.getComponent(id, (this.obj as any).level)
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
    public blockLoaded(coords: ICoords, callback?: Function): Promise<boolean> | void {
        return this.maybe(callback, new Promise((resolve) => this.cmd(`testforblock ${coords[0]} ${coords[1]} ${coords[2]} air`, ({ data }: { data: { message: string; statusCode: number; } }) => resolve(data.message !== "Cannot test for block outside of the world"))))
    }

    /**
    * Get the id of the block at specific coordinates.
    * @param coords The coords of the block to check.
    * @param callback The callback to fire after checking.
    * @slash
    * @beta
    */
    public blockAt(coords: ICoords, callback?: Function): Promise<string> | void {
        return this.maybe(callback, new Promise((resolve) => this.cmd(`testforblock ${coords[0]} ${coords[1]} ${coords[2]} air`, ({ data }: { data: { message: string; statusCode: number; } }) => {
            if (data.message.match(/Successfully found the block at .+\./)) resolve("Air")
            else {
                const res = data.message.match(/The block at .+ is Air \(expected: (.+)\)\./)
                if (res) resolve(res[1])
                else resolve(undefined) // TODO: Force load block to check then unload.
            }
        })))
    }

    /**
    * Set gamerules.
    * @param rules The rules or rule to set or get.
    * @param data The data to set if a single rule was provided.
    * @slash
    * @shorthand
    */
    public rules(rules: object | string, data: boolean | number | string): void {
        if (typeof rules === "object") return void Object.entries(rules).map((val) => this.cmd(`gamerule ${val[0]} ${val[1]}`))
        return void this.cmd(`gamerule ${rules} ${data}`)
    }

    /**
    * Give or take potion effects from players.
    * @param sel The player selectors or usernames to apply the effect to.
    * @param eff The effect type.
    * @param seconds The seconds the effect will be active.
    * @param amplifier The amplifier amount.
    * @param particles Whether or not to show the particles.
    * @slash
    */
    public effect(sel: string | string[], eff?: string, seconds: number = 30, amplifier = 0, particles = true): void {
        if (Array.isArray(sel)) sel = sel.join(" ")
        if (!eff) return void this.cmd(`effect ${sel} clear`)
        this.cmd(`effect ${sel} ${seconds} ${amplifier} ${!particles}`)
    }

    /**
    * Locate a structure.
    * @param name The structure to locate.
    * @param callback The function to invoke with the results.
    * @slash
    * @shorthand
    */
    public locate(name: string, callback?: Function): Promise<[number, number] | [undefined, undefined]> | void {
        return this.maybe(callback, new Promise((resolve) =>
            this.cmd(`locate ${name}`, ({ data }: { data: { message: string; statusCode: number; } }) => {
                const m = data.message.match(/The nearest .+ is at block (.+), \(y\?\), (.+)/)
                if (!m) resolve([undefined, undefined])
                else resolve([+m[0], +m[1]])
            })
        ))
    }

    /**
    * Check if a specific chunk has loaded.
    * @param coords The coords of the chunk to check.
    * @param callback The callback to fire after checking.
    * @slash
    * @shorthand
    */
    public chunkLoaded(coords: [number, number], callback?: Function): Promise<boolean> | void {
        return this.maybe(callback, new Promise((resolve) => this.blockLoaded([coords[0] * 16, 0, coords[1] * 16], resolve)))
    }

    /**
    * Teleport players.
    * @param sel The player selectors or usernames to teleport.
    * @param dest The destination to teleport to.
    * @param facing The y and x rotation values, coordinates or entity selector
    * @slash
    * @shorthand
    * @beta
    */
    public teleport(sel: string | string[], dest: string | ICoords, facing?: [number, number] | ICoords | string): void {
        // TODO: Use best location calculation
        if (!Array.isArray(sel)) sel = [sel]
        if (facing) {
            if (typeof facing === "string") facing = `facing ${facing}`
            else if (facing.length === 2) facing = facing.join(" ")
            else facing = `facing ${facing.join(" ")}`
        }
        if (Array.isArray(dest)) dest = dest.join(" ")
        sel.map((val) => this.cmd(`tp ${val} ${dest}`))
    }

    /**
    * Teleport players.
    * @param sel The player selectors or usernames to teleport.
    * @param dest The destination to teleport to.
    * @param facing The y and x rotation values, coordinates or entity selector
    * @slash
    * @shorthand
    * @beta
    */
    public tp(sel: string | string[], dest: string | ICoords, facing?: [number, number] | ICoords | string): void {
        this.teleport(sel, dest, facing)
    }

    /**
    * Extend DevBed functionality.
    * @param data The data to apply to DevBed. Specify names as keys and functions as values.
    * @utility
    */
    public extend(data: { [key: string]: Function }): void {
        this.ext = { ...this.ext, ...data }
    }

    /**
    * Proxy an event to another event.
    * @param name The event to proxy.
    * @param proxyName The proxied event.
    * @utility
    */
    public proxyEvent(name: string, proxyName: string): void {
        this.on(name, (...data: any) => this.callEachCallback(proxyName, ...data))
    }
}
