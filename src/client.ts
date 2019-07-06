export class DevBedClient {

    private system: any
    private callbacks: any = {}

    private callEach(arr: any): void {
        if (Array.isArray(arr)) arr.map((val: Function) => val())
    }

    constructor(client: any) {
        this.system = client.registerSystem(0, 0);

        this.system.initialize = () => {
            this.callEach(this.callbacks.initialize)
        };

        this.system.update = () => {
            this.callEach(this.callbacks.update)
        }

        this.system.shutdown = () => {
            this.callEach(this.callbacks.shutdown)
        }
    }

    public on(event: string, callback: Function): void {
        this.callbacks[event].push(callback)
    }

    public off(event: string, callback: Function): void {
        this.callbacks[event] = this.callbacks[event].filter((val: Function) => val !== callback)
    }

    get sys() {
        return this.system
    }

}
