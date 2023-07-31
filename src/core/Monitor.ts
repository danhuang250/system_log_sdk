import { ReportConfig, ReportResult } from "@/interface";
import { Plugin } from "./Plugin";

export default abstract class Monitor {
    protected appid: string;
    protected userid?: string  // 运行时注入，存在 uid 为空的情况，
    protected endpoint: string;
    protected plugins: Array<Plugin> = []

    // // 跨plugin数据传输
    // call(event: string, payload: any) {
    //     this.plugins.forEach(plugin => {
    //         const eventsRecord = plugin.events || {}
    //         const eventKeys = Object.keys(eventsRecord);
    //         eventKeys.forEach(key => {
    //             if (key == event) {
    //                 const callback = eventsRecord[key].bind(plugin);
    //                 callback(payload)
    //             }
    //         })

    //     })
    // }
    constructor(appid: string, endpoint: string, userid?: string) {
        this.appid = appid;
        this.endpoint = endpoint;
        this.userid = userid;
    }
    abstract log(msg: any): Promise<void>;
    abstract reportLog(reportConfig: ReportConfig): Promise<ReportResult>;
    protected abstract initPlugins(plugins: Plugin[]): void;
    protected abstract initSender(senderType: string, endpoint: string): void;
    abstract destroy(): void;
}
