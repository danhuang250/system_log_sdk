import WebMonitor from "@/core/WebMonitor";
import { BaseLogger, LogType, Plugin } from "@/core/Plugin"
import { App } from 'vue'


export class VueErrorLogger extends BaseLogger {
    type: LogType.JS = LogType.JS
    msg: string
    stack?: string
    constructor(message: string, stack?: string) {
        super();
        this.msg = message
        if (stack) {
            this.stack = stack

        }
    }
}


export class VueErrorPlugin implements Plugin {
    monitor: WebMonitor;
    error_listener: any;
    promise_listener: any;
    vueAPP: App

    constructor(instance: WebMonitor, app: App) {
        this.monitor = instance;
        this.vueAPP = app;
    }
    run() {
        this.vueAPP.config.errorHandler = (err, _vm, info) => {
            this.monitor.log(new VueErrorLogger(err ? (err as Error).message : info, (err as Error)?.stack))
        }
    }
    unload() {
        window.removeEventListener("error", this.error_listener)
        window.removeEventListener("unhandledrejection", this.promise_listener)
    }


}

