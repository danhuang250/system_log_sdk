import Monitor from "./Monitor";
export interface Plugin<T extends Monitor = Monitor> {
    monitor: T;
    run: Function;
    unload?: Function;
    events?: Record<string, (payload: any) => void>
}

export enum LogType {
    userLog=0,
    JS = 1,
}


export class BaseLogger {
    userAgent: string
    path: string
    constructor() {
        this.userAgent = navigator.userAgent
        this.path = window.location.href
    }
}