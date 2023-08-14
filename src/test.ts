import WebMonitor from "./core/WebMonitor";
import { getTestAccount } from "./testConfig"

let wm = new WebMonitor({ ...getTestAccount("EdmBr03B", "abc"), logDuration: 1, singlePageMaxSize: 1024 * 5 })
declare global {
    interface Window {
        wm: WebMonitor;
    }
}

window.wm = wm;

