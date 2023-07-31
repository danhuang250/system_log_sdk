/**
 * Result resolved by report() method.
 *
 * @param {YYYY-MM-DD} key The log day string.
 * @param msg This log day's report result message.
 * @param desc More information of report failure reason.
 */
export interface ReportResult {
    [key: string]: {
        msg: ResultMsg; desc?: string;
    };
}

/**
 * ResultMsg is used for DanLog-web to show failure reasons or report results.
 */
export enum ResultMsg {
    DB_NOT_SUPPORT = 'IndexedDB is not supported',
    NO_LOG = 'No log exists',
    REPORT_LOG_SUCC = 'Report succ',
    REPORT_LOG_FAIL = 'Report fail',
    EXCEED_TRY_TIMES = 'Exceed try times',
    EXCEED_LOG_SIZE_LIMIT = 'Exceed log size day limit'
}

export interface StandardLog{
       //上传数据类型 0用户主动上传   1 js报错
       type:Number,
       //日志信息
       msg:String,
}

export interface ReportConfig {
    /**
     * @param {YYYY-MM-DD}
     */
    fromDayString: string;
    /**
     * @param {YYYY-MM-DD}
     */
    toDayString: string;
    // reportUrl?: string;
    // deviceId?: string;
    // webSource?: string;
    // environment?: string;
    // customInfo?: string;
    // xhrOptsFormatter?: {
    //     (logItemStrings: string[], logPageNo: number /* logPageNo starts from 1 */, logDayString: string): ReportXHROpts;
    // };
    // /**
    //  * Will delete reported logs after report.
    //  */
    // incrementalReport?: boolean;
}