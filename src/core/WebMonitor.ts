import { JSErrorPlugin } from "../plugins/javascript";
import { Plugin } from "./Plugin";
import { XHRSender } from '@/sender/XHR';
import { CodeStatus, Sender } from "./Sender";
import Monitor from "./Monitor";
import { MustLogKey, ReportConfig, ReportResult, ResultMsg, StandardLog } from "@/interface";
import { invokeInQueue } from "@/utils/operation-queue";
import DanDB, { DanDBOptions, DanLogDayItem, FormattedLogReportName, LOG_DAY_TABLE_PRIMARY_KEY, getEndDay, getStartDay } from "@/danDB/dan-db";
import { ONE_DAY_TIME_SPAN, dateFormat2Day, dayFormat2Date } from "@/danDB/utils";
const DEFAULT_ENDPOINT = 'http://175.178.76.218:9092/api/'
type WebSenderType = "xhr" | "beacon";
type SenderOption = {
    endpoint?: string,
    senderType?: "xhr"
}

class WebMonitor extends Monitor {
    private senderInstance!: Sender<WebMonitor>; // 处理存储/压缩之类的具体逻辑
    private danDB!: DanDB;
    private danDBOptions: DanDBOptions;
    private beforeLoginQueue: string[] = [];
    constructor(
        options: {
            appid: string,
            plugins?: Plugin[]
            userid?: string
        } & SenderOption & DanDBOptions
    ) {
        const { endpoint = DEFAULT_ENDPOINT, senderType = 'xhr', userid, appid } = options;
        super(appid, endpoint, userid)
        this.initSender(senderType, endpoint);
        this.initPlugins(options.plugins);
        // 初始化本地存储配置项
        this.danDBOptions = {
            logDuration: options.logDuration,
            singleDayMaxSize: options.singleDayMaxSize,
            singlePageMaxSize: options.singlePageMaxSize,
        }
        if (userid) {
            this.initDB(appid, userid,);
        }
    }
    private initDB(appid: string, userid: string) {
        let db = this.danDB = new DanDB(this.danDBNameFormatter(appid, userid), this.danDBOptions);
        // 把beforeLoginQueue队列里的数据都存到db里
        for (let msg of this.beforeLoginQueue) {
            invokeInQueue(async () => {
                return db.addLog(
                    msg
                );
            });
        }
        this.beforeLoginQueue = [];
        // 登录时自动查询是否要上报
        // 开发者模式先去掉 
        this.reportLog();
    }
    async log(msg: any) {
        if (!this.isStandardLog(msg)) {
            msg = {
                type: 0,
                msg: JSON.stringify(msg)
            }
        }
        // 把除了type和msg和timestamp之外的字段都放进msg的extra里
        msg = this.formatLog(msg);
        msg.timestamp = +new Date();
        let log = JSON.stringify(msg);
        if (typeof this.danDB !== 'undefined') {
            // 如果本地存储实例存在
            await invokeInQueue(async () => {
                await this.danDB!.addLog(
                    log
                );
            });
        } else {
            // 如果本地存储实例不存在
            this.beforeLoginQueue.push(log);
        }
    }
    async reportLog(reportConfig: ReportConfig = { fromDayString: getStartDay(), toDayString: getEndDay() }): Promise<ReportResult> {
        /**
         * todo
         * 向服务器发送请求查询是否需要上传日志以及弹出确认框让用户确认上传
         */
        let can = await this.senderInstance.canSend({ appid: this.appid, userid: this.userid! });
        if (!can) {
            console.log("不需要上传日志")
            return Promise.resolve({});
        };
        //  弹出输提示框
        let confirm = window.confirm('是否上传日志');
        if (!confirm) return Promise.resolve({});
        return await invokeInQueue(async () => {
            const logDaysInfoList: DanLogDayItem[] = await this.danDB.getLogDaysInfo(
                reportConfig.fromDayString,
                reportConfig.toDayString
            );
            /**
             * {'2020-01-01': ['2020-01-01_0', '2020-01-01_1'], '2020-01-02': ['2020-01-02_0', '2020-01-02_1']}
             */
            const logReportMap: {
                [key: string]: FormattedLogReportName[];
            } = logDaysInfoList.reduce((acc, logDayInfo: DanLogDayItem) => {
                return {
                    [logDayInfo[
                        LOG_DAY_TABLE_PRIMARY_KEY
                    ]]: logDayInfo.reportPagesInfo ? logDayInfo.reportPagesInfo.pageSizes.map((_i, pageIndex) => {
                        console.log(logDayInfo[LOG_DAY_TABLE_PRIMARY_KEY], "日志信息大小：", logDayInfo.totalSize)
                        return this.danDB!.logReportNameFormatter(
                            logDayInfo[LOG_DAY_TABLE_PRIMARY_KEY],
                            pageIndex
                        );
                    }) : [],
                    ...acc
                };
            }, {});
            const reportResult: ReportResult = {};
            const startDate = dayFormat2Date(reportConfig.fromDayString);
            const endDate = dayFormat2Date(reportConfig.toDayString);
            for (
                let logTime = +startDate;
                logTime <= +endDate;
                logTime += ONE_DAY_TIME_SPAN
            ) {
                const logDay = dateFormat2Day(new Date(logTime));
                if (logReportMap[logDay] && logReportMap[logDay].length > 0) {


                    try {
                        const batchReportResults = await Promise.all(
                            logReportMap[logDay].map(reportName => {
                                return this.getLogAndSend(reportName, reportConfig);
                            })
                        );
                        reportResult[logDay] = { msg: ResultMsg.REPORT_LOG_SUCC,pages:batchReportResults.filter((reportedPageIndex) => reportedPageIndex !== null) as number[] };
                        try {
                            const reportedPageIndexes = batchReportResults.filter((reportedPageIndex) => reportedPageIndex !== null) as number[];
                            if (reportedPageIndexes.length > 0) {
                                // Delete logs of reported pages after report.
                                await this.danDB!.deleteLogs(logDay, reportedPageIndexes);
                            }
                        } catch (e) {
                            // Noop if deletion failed.
                        }
                    } catch (e: any) {
                        reportResult[logDay] = {
                            msg: ResultMsg.REPORT_LOG_FAIL,
                            desc: e.message || e.stack || JSON.stringify(e)
                        };
                    }
                } else {
                    reportResult[logDay] = { msg: ResultMsg.NO_LOG };
                }
            }
            return reportResult;
        });
    }
    /**
     * @returns Promise<number> with reported pageIndex if this page has logs, otherwise Promise<null>.
     * 
     */
    private async getLogAndSend(reportName: string, _reportConfig?: ReportConfig): Promise<number | null> {
        const logItems = await this.danDB!.getLogsByReportName(reportName);
        if (logItems.length > 0) {
            const logItemStrings = logItems
                .map(logItem => {
                    return JSON.parse(logItem.logString)
                });
            const pageIndex = this.danDB!.logReportNameParser(reportName).pageIndex;
            let data = {
                appid: this.appid,
                userid: this.userid!,
                logArray: logItemStrings
            }
            try {
                return await this.senderInstance.send(
                    data
                ).then((res) => {
                    if (res.code === CodeStatus.success) {
                        return Promise.resolve(pageIndex);
                    } else {
                        return Promise.resolve(null);
                    }
                })
            } catch (e) {
                return Promise.resolve(null);
            }

        } else {
            return Promise.resolve(null);
        }
    }
    // 把除了type和msg和timestamp之外的字段都放进msg的extra里
    formatLog(log: StandardLog) {
        let res = {} as StandardLog;
        for (let key of MustLogKey) {
            res[key] = log[key];
        }
        res.extra = log;
        for (let key of MustLogKey) {
            delete res.extra[key];
        }
        return res;
    }
    setUid(uid: string) {
        this.userid = uid;
        this.initDB(this.appid, uid);
    }
    isStandardLog(msg: any): msg is StandardLog {
        return typeof msg.type === 'number' && typeof msg.msg === 'string';

    }
    private danDBNameFormatter(appid: string, userid: string) {
        return `${appid}_${userid}`
    }
    protected initSender(senderType: WebSenderType, endpoint: string) {
        if (senderType == "xhr") {
            this.senderInstance = new XHRSender(endpoint, this);
        }
    }
    protected initPlugins(plugins: Plugin[] = [
        new JSErrorPlugin(this),
    ]) {
        this.plugins = plugins;
        this.plugins.forEach(plugin => plugin.run());
    }
    destroy() {
        this.plugins.forEach(plugin => plugin.unload && plugin.unload())
    }
}

export default WebMonitor


