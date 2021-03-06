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

import _ from "lodash"
import Promise from "bluebird"

/**
* Entity object.
*/
interface BedEntity extends IEntity {
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
    search(cfields?: IDoubleCoords): any[] | null
}

/**
* Component object.
*/
interface BedComponent extends IComponent<any> {
    /**
    * Add the component to an entity.
    * @param ent The identifier of the entity.
    * @param existsOk If false an error will be thrown if the component already exists on the entity.
    */
    add(ent: IEntity | BedEntity, existsOk: boolean): void,

    /**
    * Check if an entity has a component.
    * @param ent The identifier of the entity.
    */
    has(ent: IEntity | BedEntity): boolean,

    /**
    * Get or set the data of an entity.
    * @param ent The identifier of the entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(ent: IEntity | BedEntity, data?: object | Function): IComponent<unknown> | null | void,

    /**
    * Reload the component.
    * @param ent The identifier of the entity.
    */
    reload(ent: IEntity | BedEntity): void,

    /**
    * Remove the component from an entity.
    * @param ent The identifier of the entity.
    */
    remove(ent: IEntity | BedEntity): void,

    /**
    * Properties from a regular IComponent data parameter.
    */
    [v: string]: IComponent<any>["data"]
}

/**
* Component object from getComponent.
*/
interface BedGetComponent extends BedComponent {
    /**
    * Get or set the data of an entity.
    * @param data The data to change provided as an object or as a Function that takes and returns a value.
    */
    data(data: object | Function): IComponent<unknown> | null | void
}

/**
* An objective.
*/
interface Objective {
    name?: string,
    display?: "list" | "sidebar" | "belowName",
    order?: "ascending" | "descending",
    players?: {
        [player: string]: number
    }
}

/**
* An object referring players to their respective entities.
*/
interface PlayerEntityPair {
    [username: string]: IEntity
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
type IStringable = string | object | boolean | number | undefined

/**
* An array that can hold 3 numbers of which represent coordinates.
*/
type ICoords = [number, number, number]

/**
* An array that can hold 6 numbers of which represent coordinates.
*/
type IDoubleCoords = [number, number, number, number, number, number]

/**
* Chat colour codes.
*/
export const ChatCodes = {
    darkRed: "§4",
    red: "§c",
    gold: "§6",
    yellow: "§e",
    darkGreen: "§2",
    green: "§a",
    aqua: "§b",
    darkAqua: "§3",
    darkBlue: "§1",
    blue: "§9",
    lightPurple: "§d",
    darkPurple: "§5",
    white: "§f",
    grey: "§7",
    darkGrey: "§8",
    black: "§0",
    bold: "§l",
    strikethrough: "§m",
    underline: "§n",
    italic: "§o",
    reset: "§r"
}

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
    public readonly systemType: "client" | "server"

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
    * The player objects.
    */
    private playerObj: PlayerEntityPair = {}

    /**
    * The functions set to execute on interval.
    */
    private intervalled: { [id: number]: { time: number, func: Function, passed: number } } = {}

    /**
    * Check if a value is a property but not part of the prototype of an object.
    */
    private hasProp(obj: any, name: string | number | symbol): boolean {
        return Object.prototype.hasOwnProperty.call(obj, name) && !_.has(Object.getPrototypeOf(obj), name)
    }

    /**
    * A regex to match invalid characters in a scoreboard name.
    */
    private scoreboardInvalidRegex = /[,:()\r\n"%\0 ]/g

    /**
    * The player scoreboard.
    */
    public scoreboard: { [id: string]: Objective } = new Proxy({}, {
        // TODO: Finish and remove no-invalid-this from eslint config.
        get: (target, name, receiver): any => {
            return Reflect.get(target, name, receiver)
        },
        deleteProperty: (target, name): boolean => {
            this.cmd(`scoreboard objectives remove ${name.toString()}`)
            return Reflect.deleteProperty(target, name)
        },
        set: (target, name, val, receiver): boolean => {
            const reflection = Reflect.set(target, name, val, receiver)
            if (this.hasProp(target, name) && typeof name === "string") {
                if (name.length > 16) throw new TypeError("Objective ID is too long!")
                if (this.scoreboardInvalidRegex.test(name)) throw new TypeError("Objective ID contains invalid characters!")
                this.cmd(`scoreboard objectives add ${name} dummy ${val.name || ""}`)
                if (val.display) {
                    if (val.display === "belowname") this.cmd(`scoreboard objectives setdisplay ${val.display} ${name}`)
                    else this.cmd(`scoreboard objectives setdisplay ${val.display} ${name} ${val.order}`)
                }
                if (val.players) _.forOwn(val.players, (v: string, n: string) => this.cmd(`scoreboard players set ${n} ${name} ${v}`))
            }
            return reflection
        },
    });

    /**
    * @param obj.bedspace The main DevBed namespace name to use.
    * @param obj.obj The client or server object.
    */
    constructor({ bedspace = "devbed", obj = typeof client !== "undefined" ? client : typeof server !== "undefined" ? server : undefined }: { bedspace?: string, obj?: IClient | IServer | IClientSystem<any> | IServerSystem<any> | DevBed } = {}) {
        // TODO: Update README before release.
        if (obj instanceof DevBed) {
            // Obj is a DevBed object
            this.obj = obj.obj
            this.system = obj.system
            this.systemType = obj.systemType
        } else if ((obj as ISystem<any>).createEntity) {
            // Obj is a pre-registered system object (createEntity parameter exists)
            this.system = obj as IClientSystem<any> | IServerSystem<any>
            this.systemType = (obj as IServerSystem<any>).executeCommand ? "server" : "client"
        } else {
            // Obj is a client or server object
            this.obj = obj as IClient | IServer
            this.system = (this.obj as any).registerSystem(DevBed.version.minor, DevBed.version.major)
            this.systemType = (this.obj as any).local_player ? "client" : "server"
        }
        this.bedspace = bedspace

        this.system.initialize = (...args: any): void => {
            this.callEachCallback("initialize", ...args)
        }

        this.system.update = (...args: any): void => {
            this.ticks++
            if (this.ticks === 1) this.callEachCallback("first_tick", ...args)
            _.forOwn(this.intervalled, ({ time, func }, id) => {
                this.intervalled[id].passed++
                if (this.intervalled[id].passed >= time) {
                    this.intervalled[id].passed = 0
                    func()
                }
            })
            this.callEachCallback("update", ...args)
        }

        this.system.shutdown = (...args: any): void => {
            if (this.systemType === "client") this.trigger(`${this.bedspace}:playerLeft`, { player: (this.obj as any).local_player })
            this.callEachCallback("shutdown", ...args)
        }

        if (this.systemType === "server" && this.system.createEventData(`${this.bedspace}:DevBedEvent`)) this.chat(ChatCodes.yellow + `Conflict detected. Please ensure the ${this.bedspace} namespace is not used by other scripts. If the issue persists, try changing your bedspace.`)

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
            this.on(`${this.bedspace}:playerJoined`, ({ player }: NonNullable<IClientEnteredWorldEventData>) => {
                const { name: username } = this.getComponent("minecraft:nameable", player)
                this.players.push(username)
                this.playerObj[username] = player
                this.trigger("player_joined", { username, player })
            })

            this.on(`${this.bedspace}:playerLeft`, ({ player }: NonNullable<IClientEnteredWorldEventData>) => {
                const { name: username } = this.getComponent("minecraft:nameable", player)
                _.pull(this.players, username)
                _.omit(this.playerObj, username)
                this.trigger("player_left", { username, player })
            })
        }

        this.newEvent(`${this.bedspace}:executeCommand`)

        if (this.systemType === "server") {
            this.on(`${this.bedspace}:executeCommand`, ({ command, callbackOrAs, callback, player }: { command: string | string[], callbackOrAs?: Function | string | string[] | false, callback?: Function, player: NonNullable<IEntity> }) => {
                if (typeof callbackOrAs !== "function") this.cmd(command, callbackOrAs as any, callback)
                else {
                    const { name: username } = this.getComponent("minecraft:nameable", player)
                    this.cmd(command, username, callback)
                }
            })
        }
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

    private maybe(cb: Function, promise: Promise<unknown>): void
    private maybe(cb: any, promise: Promise<unknown>): Promise<unknown>

    /**
    * Convert a promise to a callback function when needed.
    * @param cb The callback to check.
    * @param promise The promise to integrate into the callback.
    */
    private maybe(cb: Function | void, promise: Promise<any>): Promise<any> | void {
        if (!cb) return promise
        promise
            .then((val) => cb(val))
            .catch((err) => {
                throw err
            })
        return undefined
    }

    /**
    * Modify the prototype of an object.
    * @param obj The object to be transformed.
    * @param newProto The transformation to apply.
    * @utility
    */
    private modifyPrototype(obj: any, newProto: object): any {
        let proto = Object.getPrototypeOf(obj)
        proto = { ...proto, ...newProto }
        Object.setPrototypeOf(obj, proto)
        return obj
    }

    /**
    * Create an entity.
    * @param entityType The type of entity to create.
    * @param identifier The template identifier of the enitity to create.
    * @entity
    */
    private createEntity(entityType?: "entity" | "item_entity", identifier?: string): BedEntity | null {
        const obj: any = entityType && identifier ? this.system.createEntity(entityType, identifier) : this.system.createEntity()
        if (obj === null) throw new ReferenceError("Unable to create the entity.")
        return this.modifyPrototype(obj, {
            remove: (): void => void this.system.destroyEntity(obj),
            isValid: (): boolean => Boolean(this.system.isValidEntity(obj)),
        })
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
    * Get an entity object from a player username.
    * @param username The username to query.
    * @entity
    */
    public getPlayer(username: string): IEntity | void {
        return this.playerObj[username]
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
        else if (_.isPlainObject(data) && _.isPlainObject(transform)) return { ...data, ...transform }
        else if (typeof transform === "function") return transform(data)
    }

    /**
    * Transform IComponent to BedComponent.
    * @param id The identifier of the component.
    * @param obj The IComponent object.
    * @component
    */
    private transformComponent(id: string, obj: any): BedComponent | null {
        if (obj === null) throw new ReferenceError("Unable to setup the component.")
        return this.modifyPrototype(obj, {
            add: (ent: IEntity | BedEntity, existsOk: boolean = true): void => {
                if (!existsOk && obj.has(ent)) throw new TypeError("Component already exists!")
                this.system.createComponent(ent, id)
            },
            has: (ent: IEntity | BedEntity): boolean => Boolean(this.system.hasComponent(ent, id)),
            data: (ent: IEntity | BedEntity, data?: object | Function): IComponent<unknown> | null | void => {
                const curr = this.system.getComponent(ent, id)
                if (!data) return curr
                if (curr === null) throw new ReferenceError("Component not found.")

                this.system.applyComponentChanges(ent, this.parseTransform(curr, data) as IComponent<any>)
            },
            reload: (ent: IEntity | BedEntity): void => {
                const comp = this.system.getComponent(ent, id)
                if (comp) return void this.system.applyComponentChanges(ent, comp)
                throw new ReferenceError("Component not found.")
            },
            remove: (ent: IEntity | BedEntity): void => void this.system.destroyComponent(ent, id),
        })
    }

    /**
    * Create a component.
    * @param data The data to associate with the component.
    * @component
    */
    public component(data: object = {}): BedComponent | null {
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
    public getComponent(id: string, ent: IEntity | BedEntity): BedGetComponent | null {
        const comp = this.system.getComponent(ent, id)
        if (!comp) throw new ReferenceError("Component not found!")

        const obj: any = this.transformComponent(id, comp.data)

        const prevData = obj.data
        return this.modifyPrototype(obj, {
            data: (data: object | Function): IComponent<unknown> | null | void => prevData(ent, data),
        })
    }

    /**
    * Call each callback of a specific name.
    * @param name The name of the callback to call.
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
            if (callback) _.pull(this.callbacks[ev], callback)
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
        return this.maybe(callback, new Promise((resolve): void => {
            const handleFire = (...data: any): void => {
                this.off(event, handleFire)
                resolve(data)
            }
            this.on(event, handleFire)
        }))
    }

    public trigger(name: string, data: object, callback?: Function): void
    public trigger(name: string, callback?: Function): void

    /**
    * Trigger an event.
    * @param name The name of the event to post.
    * @param dataOrCb The data to include in the event.
    * @param callback The callback to handle a responded custom event.
    * @events
    */
    public trigger(name: string, dataOrCb: object | Function = {}, callback?: Function): void {
        if (!name.includes(":")) {
            const id = this.getId()
            this.newEvent(id)
            if (callback) this.on(id, (typeof dataOrCb === "function") ? dataOrCb : callback)
            this.trigger(`${this.bedspace}:ev`, {
                sendName: name,
                data: {
                    ...this.defaultData[name],
                    ..._.isPlainObject(dataOrCb) ? dataOrCb : {},
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

            eventData.data = { ...eventData.data, ..._.isPlainObject(dataOrCb) ? dataOrCb : {} }

            this.system.broadcastEvent(name, eventData)
        }
    }

    /**
    * Convert value to string
    * @param val The value to convert.
    */
    private toString(val: IStringable): string {
        if (_.isPlainObject(val)) return JSON.stringify(val)
        else return _.toString(val)
    }

    /**
    * Post a message in chat.
    * @param message The message to post. Accepts unlimited arguments.
    * @events
    * @shorthand
    */
    public chat(...message: IStringable[]): void {
        this.trigger("minecraft:display_chat_event", { message: message.map((msg) => this.toString(msg)).join(" ") })
    }

    /**
    * Post formatted json to the chat.
    * @param obj The javascript object.
    * @param indent The indention level to use.
    * @utility
    * @shorthand
    */
    public json(obj: object, indent: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 = 4): void {
        this.chat(JSON.stringify(obj, null, indent))
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
        const obj: any = component ? this.system.registerQuery(component, fields[0], fields[1], fields[2]) : this.system.registerQuery()
        if (obj === null) throw new ReferenceError("Unable to create the query.")
        return this.modifyPrototype(obj, {
            filter: (identifier: string): void => this.system.addFilterToQuery(obj, identifier),
            search: (cfields?: IDoubleCoords): any[] | null => cfields ?
                this.system.getEntitiesFromQuery(obj, cfields[0], cfields[1], cfields[2], cfields[3], cfields[4], cfields[5]) :
                this.system.getEntitiesFromQuery(obj),
        })
    }

    /**
    * Get the entities within a specific radius of an entity.
    * @param ent The centre entity.
    * @param radius The radius to search.
    * @slash
    */
    public radius(ent: IEntity | BedEntity, radius: number): IEntity[] | void {
        const spacialQuery = this.system.registerQuery("minecraft:position", "x", "y", "z")
        const comp: IComponent<any> | null = this.system.getComponent(ent, "minecraft:position")

        if (comp === null || spacialQuery === null) return undefined

        const pos = comp.data
        return this.system.getEntitiesFromQuery(spacialQuery, pos.x - radius, pos.x + radius, pos.y - radius, pos.y + radius, pos.z - radius, pos.z + radius)
    }

    /**
    * @param command The command to execute.
    * @param callback The callback to invoke when the command returned data.
    * @slash
    */
    public cmd(command: string | string[], callback?: Function): Promise<object> | void

    /**
    * @param command The command to execute. Prepend with "c:" parameter for chat.
    * @param as The player to execute the command as.
    * @param callback The callback to invoke when the command returned data.
    * @slash
    */
    public cmd(command: string | string[], as: string | string[], callback?: Function): Promise<object> | void

    /**
    * Execute a slash command.
    * @slash
    */
    public cmd(command: string | string[], callbackOrAs?: Function | string | string[] | false, callback?: Function): Promise<object> | void {
        if (this.systemType !== "server") this.trigger(`${this.bedspace}:executeCommand`, { command, callbackOrAs, callback, player: (this.obj as any).local_player })
        else {
            return this.maybe(typeof callbackOrAs === "function" ? callbackOrAs : callback, new Promise((resolve): void => {
                if (Array.isArray(command)) command = command.join(" ")

                if (typeof callbackOrAs === "string" || Array.isArray(callbackOrAs)) {
                    if (command.startsWith("/")) command = command.slice(1)
                    if (!Array.isArray(callbackOrAs)) callbackOrAs = [callbackOrAs]

                    callbackOrAs.map((username: string) => {
                        if ((command as string).startsWith("c:")) this.cmd(`tellraw @a {"rawtext":[{"text":"<${username}> ${(command as string).slice(2).replace(/(?:"|\\")/g, "\\\"")}"}]}`, resolve)
                        else this.cmd(`execute ${username} ~ ~ ~ ${command}`, resolve)
                    })
                } else (this.system as IServerSystem<any>).executeCommand(command, ({ data }: IExecuteCommandCallback) => resolve(data))
            }))
        }
    }

    /**
    * Get blocks from the world.
    * @param area The ticking area to use.
    * @param coords 3 coords specifying the location of a block or 6 for an area of blocks.
    * @block
    */
    public block(area: ITickingArea, coords: ICoords | IDoubleCoords): IBlock | IBlock[][] | null {
        return coords.length === 3 ? this.system.getBlock(area, coords[0], coords[1], coords[2]) : this.system.getBlocks(area, coords[0], coords[1], coords[2], coords[3], coords[4], coords[5])
    }

    /**
    * Get the data of a component stored in level.
    * @param id The id of the component.
    * @param data The data to set the component to.
    * @entity
    * @shorthand
    */
    public level(id: string, data?: any[] | object | Function): BedComponent | null | void {
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
        return this.maybe(callback, new Promise((resolve): void | Promise<object> => this.cmd(`testforblock ${coords[0]} ${coords[1]} ${coords[2]} air`, ({ statusMessage }: { statusMessage: string }) => resolve(statusMessage !== "Cannot test for block outside of the world"))))
    }

    /**
    * Get the id of the block at specific coordinates.
    * @param coords The coords of the block to check.
    * @param callback The callback to fire after checking.
    * @slash
    */
    public blockAt(coords: ICoords, callback?: Function): Promise<string> | void {
        return this.maybe(callback, new Promise((resolve): void | Promise<object> => this.tempLoad(coords, () => this.cmd(`testforblock ${coords[0]} ${coords[1]} ${coords[2]} Air`, ({ matches, statusMessage }: { matches: boolean, statusMessage: string }) => {
            const res = statusMessage.match(/The block at .+,.+,.+ is (.+) \(expected .+\)\./)
            if (matches) resolve("Air")
            else if (res) resolve(res[1])
            else resolve(undefined)
        }))))
    }

    /**
    * Temporarily force-load some blocks before calling a callback function and unloading them.
    * @param coords The coords of the block to check.
    * @param callback The callback to fire after checking.
    * @slash
    */
    private tempLoad(coords: ICoords | IDoubleCoords, callback: Function): void {
        this.cmd(`tickingarea add ${coords[0]} ${coords[1]} ${coords[2]} ${coords[3] || coords[0]} ${coords[4] || coords[1]} ${coords[5] || coords[2]}`, () => {
            callback()
            this.cmd(`tickingarea remove ${coords[0]} ${coords[1]} ${coords[2]}`)
        })
    }

    /**
    * Set gamerules.
    * @param rules The rules or rule to set or get.
    * @param data The data to set if a single rule was provided.
    * @slash
    * @shorthand
    */
    public rules(rules: object | string, data: boolean | number | string): void {
        if (_.isPlainObject(rules)) return void _.forOwn(rules, (val, name) => this.cmd(`gamerule ${name} ${val}`))
        else return void this.cmd(`gamerule ${rules} ${data}`)
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
    public effect(sel: string | string[], eff?: string, seconds = 30, amplifier = 0, particles = true): void {
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
        return this.maybe(callback, new Promise((resolve): void | Promise<object> =>
            this.cmd(`locate ${name}`, ({ destination, statusCode }: { destination: { x: number, y: number, z: number }, statusCode: number }) => {
                if (statusCode !== 0) resolve([undefined, undefined])
                else resolve([destination.x, destination.z])
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
        return this.maybe(callback, new Promise((resolve): void | Promise<boolean> => this.blockLoaded([coords[0] * 16, 0, coords[1] * 16], resolve)))
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
    * @param data The data to extend DevBed with. Specify names as keys and functions as values.
    * @utility
    */
    public extend(data: { [key: string]: any }): void

    /**
    * @param name The name of the data to extend DevBed with.
    * @param data The data to extend DevBed with.
    * @utility
    */
    public extend(name: string, data: any): void

    /**
    * Extend DevBed functionality.
    */
    public extend(dataOrName: { [key: string]: any } | string, data?: any): void {
        if (typeof dataOrName === "string") this.ext[dataOrName] = data
        else this.ext = { ...this.ext, ...dataOrName }
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

    /**
    * Execute callback every specified milliseconds.
    * @param cb Callback to execute.
    * @param time Milliseconds to wait between executions. (1 sec = 1000 ms)
    * @param type The type of time to count. Can be set to `ms` or `ticks`.
    * @utility
    */
    public setInterval(cb: Function, time: number, type: "ms" | "ticks" = "ms"): number {
        const i = +_.findLastKey(this.intervalled) + 1 || 0
        this.intervalled[i] = {
            time: type === "ms" ? Math.round(time / 1000 * 20) : time,
            func: cb,
            passed: 0,
        }
        return i
    }

    /**
    * Clear interval set by {@link DevBed.setInterval}. Can also be used to cancel {@link DevBed.setTimeout}.
    * @param id The id returned by the setInterval or setTimeout function.
    * @utility
    */
    public clearInterval(id?: number): void {
        if (!id) this.intervalled = {}
        else delete this.intervalled[id]
    }

    /**
    * Execute a function once after a specific amount of time.
    * @param cb Callback to execute.
    * @param time Milliseconds to wait before executing. (1 sec = 1000 ms)
    * @param type The type of time to count. Can be set to `ms` or `ticks`.
    * @utility
    */
    public setTimeout(cb: Function, time: number, type: "ms" | "ticks" = "ms"): number {
        const data: { id: number } = { id: 0 }
        const func = (): void => {
            this.clearInterval(data.id)
            cb()
        }
        data.id = this.setInterval(func, time, type)
        return data.id
    }

    /**
    * Execute a function in the very next tick.
    * @param cb Callback to execute.
    * @utility
    */
    public setImmediate(cb: Function): number {
        return this.setTimeout(cb, 0)
    }
}
