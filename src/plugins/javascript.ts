import WebMonitor from "@/core/WebMonitor";
import { BaseLogger, LogType, Plugin } from "@/core/Plugin"


export class JSErrorLogger extends BaseLogger {
    type: LogType.JS=LogType.JS
    msg: string
    stack: string
    constructor(message: string, stack: string) {
        super();
        this.msg = message
        this.stack = stack
    }
}


export class JSErrorPlugin implements Plugin {
    monitor: WebMonitor;
    error_listener: any;
    promise_listener: any;

    constructor(instance: WebMonitor) {
        this.monitor = instance;
    }
    run() {
        this.error_listener = (e: ErrorEvent) => {
            const log = new JSErrorLogger(e.message, e.error?.stack)
            this.monitor.log(log)
        }
        this.promise_listener = (e: ErrorEvent) => {
            const log = new JSErrorLogger(e.message, e.error?.stack)
            this.monitor.log(log)
        }
        window.addEventListener("error", this.error_listener)
        window.addEventListener("unhandledrejection", this.promise_listener)
    }
    unload() {
        window.removeEventListener("error", this.error_listener)
        window.removeEventListener("unhandledrejection", this.promise_listener)
    }


}

