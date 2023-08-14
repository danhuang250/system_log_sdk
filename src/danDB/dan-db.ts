import { CustomDB, idbIsSupported, deleteDB } from 'idb-managed';
import { dateFormat2Day, M_BYTE, sizeOf, getStartOfDay, dayFormat2Date } from './utils';
const DAN_DB_VERSION = 1;
const LOG_DETAIL_TABLE_NAME = 'dan_detail_table';
const LOG_DETAIL_REPORTNAME_INDEX = 'logReportName';
const LOG_DAY_TABLE_NAME = 'log_day_table';
export const LOG_DAY_TABLE_PRIMARY_KEY = 'logDay';
export type FormattedLogReportName = string;
var DAY_DURATION = 24 * 3600 * 1000
var DEFAULT_LOG_DURATION = 7 * DAY_DURATION; // logan-web keeps 7 days logs locally
var DEFAULT_SINGLE_DAY_MAX_SIZE = 7 * M_BYTE; // 7M storage limit for one day
var DEFAULT_SINGLE_PAGE_MAX_SIZE = 1 * M_BYTE; // 1M storage limit for one page


interface LogReportNameParsedOb {
    logDay: string;
    pageIndex: number;
}
interface DanLogItem {
    [LOG_DETAIL_REPORTNAME_INDEX]: string;
    logSize: number;
    logString: string;
}

export interface DanDBOptions {
    /**
     *  保存天数 default 7  
     */
    logDuration?: number;
    singleDayMaxSize?: number;
    singlePageMaxSize?: number;
}

export interface DanLogDayItem {
    [LOG_DAY_TABLE_PRIMARY_KEY]: string;
    totalSize: number;
    reportPagesInfo: {
        pageSizes: number[]; // Array of pageSize of each page.
    };
}
export function getStartDay() {
    return dateFormat2Day(new Date(Date.now() - DEFAULT_LOG_DURATION));
}
export function getEndDay() {
    return dateFormat2Day(new Date());
}

export default class DanDB {
    public static idbIsSupported = idbIsSupported;
    public static deleteDB = deleteDB;
    private DB: CustomDB;
    constructor(dbName: string, options?: DanDBOptions) {

        if (options) {
            if (options.logDuration) {
                DEFAULT_LOG_DURATION = options.logDuration * DAY_DURATION;
            }
            if (options.singleDayMaxSize) {
                DEFAULT_SINGLE_DAY_MAX_SIZE = options.singleDayMaxSize;
            }
            if (options.singlePageMaxSize) {
                DEFAULT_SINGLE_PAGE_MAX_SIZE = options.singlePageMaxSize;
            }
        }

        this.DB = new CustomDB({
            dbName: dbName,
            dbVersion: DAN_DB_VERSION,
            tables: {
                [LOG_DETAIL_TABLE_NAME]: {
                    indexList: [
                        {
                            indexName: LOG_DETAIL_REPORTNAME_INDEX,
                            unique: false
                        }
                    ]
                },
                [LOG_DAY_TABLE_NAME]: {
                    primaryKey: LOG_DAY_TABLE_PRIMARY_KEY
                }
            }
        });
    }

    /**
     * @param logDay
     * @param pageIndex start from 0
     */
    logReportNameFormatter(
        logDay: string,
        pageIndex: number
    ): FormattedLogReportName {
        return `${logDay}_${pageIndex}`;
    }
    logReportNameParser(reportName: FormattedLogReportName): LogReportNameParsedOb {
        const splitArray = reportName.split('_');
        return {
            logDay: splitArray[0],
            pageIndex: +splitArray[1]
        };
    }
    async getLogDayInfo(logDay: string): Promise<DanLogDayItem | null> {
        return ((await this.DB.getItem(
            LOG_DAY_TABLE_NAME,
            logDay
        )) as any) as DanLogDayItem | null;
    }
    async getLogDaysInfo(
        fromLogDay: string,
        toLogDay: string
    ): Promise<DanLogDayItem[]> {
        if (fromLogDay === toLogDay) {
            const result = ((await this.DB.getItem(
                LOG_DAY_TABLE_NAME,
                fromLogDay
            )) as any) as DanLogDayItem | null;
            return result ? [result] : [];
        } else {
            return ((await this.DB.getItemsInRange({
                tableName: LOG_DAY_TABLE_NAME,
                indexRange: {
                    indexName: LOG_DAY_TABLE_PRIMARY_KEY,
                    lowerIndex: fromLogDay,
                    upperIndex: toLogDay,
                    lowerExclusive: false,
                    upperExclusive: false
                }
            })) as any[]) as DanLogDayItem[];
        }
    }
    async getLogsByReportName(
        reportName: FormattedLogReportName
    ): Promise<DanLogItem[]> {
        const logs = ((await this.DB.getItemsInRange({
            tableName: LOG_DETAIL_TABLE_NAME,
            indexRange: {
                indexName: LOG_DETAIL_REPORTNAME_INDEX,
                onlyIndex: reportName
            }
        })) as any[]) as DanLogItem[];
        return logs;
    }
    /**
     * 
     * @param logString 
     */
    async addLog(logString: string): Promise<void> {
        const logSize = sizeOf(logString);
        const now = new Date();
        const today: string = dateFormat2Day(now);
        const todayInfo: DanLogDayItem = (await this.getLogDayInfo(
            today
        )) || {
            [LOG_DAY_TABLE_PRIMARY_KEY]: today,
            totalSize: 0,
            reportPagesInfo: {
                pageSizes: [0]
            }
        };
        if (todayInfo.totalSize + logSize > DEFAULT_SINGLE_DAY_MAX_SIZE) {
            /**
             * delete old log by logReportName at today
             */
            //找到最早sizeof不是0的分页片段
            let index = 0;
            for (let i = 0; i < todayInfo.reportPagesInfo.pageSizes.length; i++) {
                if (todayInfo.reportPagesInfo.pageSizes[i] > 0) {
                    index = i;
                    break;
                }
            }
            await this.deleteLogs(today, [index]);
            todayInfo.totalSize -= todayInfo.reportPagesInfo.pageSizes[index];
            todayInfo.reportPagesInfo.pageSizes[index] = 0;
        }
        if (!todayInfo.reportPagesInfo || !todayInfo.reportPagesInfo.pageSizes) {
            todayInfo.reportPagesInfo = { pageSizes: [0] };
        }
        const currentPageSizesArr = todayInfo.reportPagesInfo.pageSizes;
        const currentPageIndex = currentPageSizesArr.length - 1;
        const currentPageSize = currentPageSizesArr[currentPageIndex];
        const needNewPage =
            currentPageSize > 0 &&
            currentPageSize + logSize > DEFAULT_SINGLE_PAGE_MAX_SIZE;
        const nextPageSizesArr = (function (): number[] {
            const arrCopy = currentPageSizesArr.slice();
            if (needNewPage) {
                arrCopy.push(logSize);
            } else {
                arrCopy[currentPageIndex] += logSize;
            }
            return arrCopy;
        })();
        const logItem: DanLogItem = {
            [LOG_DETAIL_REPORTNAME_INDEX]: this.logReportNameFormatter(
                today,
                needNewPage ? currentPageIndex + 1 : currentPageIndex
            ),
            logSize,
            logString
        };
        const updatedTodayInfo: DanLogDayItem = {
            [LOG_DAY_TABLE_PRIMARY_KEY]: today,
            totalSize: todayInfo.totalSize + logSize,
            reportPagesInfo: {
                pageSizes: nextPageSizesArr
            }
        };
        const durationBeforeExpired =
            DEFAULT_LOG_DURATION - (+new Date() - getStartOfDay(new Date()));
        await this.DB.addItems([
            {
                tableName: LOG_DAY_TABLE_NAME,
                item: updatedTodayInfo,
                itemDuration: durationBeforeExpired
            },
            {
                tableName: LOG_DETAIL_TABLE_NAME,
                item: logItem,
                itemDuration: durationBeforeExpired
            }
        ]);
    }
    /**
     * Delete reported pages of logDay, in case that new pages are added after last report.
     */
    async deleteLogs(logDay: string, reportedPageIndexes: number[]): Promise<void> {
        const dayInfo: DanLogDayItem | null = await this.getLogDayInfo(logDay);
        if (dayInfo && dayInfo.reportPagesInfo && dayInfo.reportPagesInfo.pageSizes instanceof Array) {
            const currentPageSizesArr = dayInfo.reportPagesInfo.pageSizes;
            const currentTotalSize = dayInfo.totalSize;
            const totalReportedSize = currentPageSizesArr.reduce((accSize, currentSize, indexOfPage) => {
                if (reportedPageIndexes.indexOf(indexOfPage) >= 0) {
                    return accSize + currentSize;
                } else {
                    return accSize;
                }
            }, 0);
            const pageSizesArrayWithNewPage = (function addNewPageIfLastPageIsReported(): number[] {
                // 新增一页，如果最后一页是已经上报的。 （为了是已经上报的片段不再增加数据）
                if (reportedPageIndexes.indexOf(currentPageSizesArr.length - 1) >= 0) {
                    return currentPageSizesArr.concat([0]);
                } else {
                    return currentPageSizesArr;
                }
            })();
            const resetReportedPageSizes = pageSizesArrayWithNewPage.reduce((accSizesArray, currentSize, index) => {
                if (reportedPageIndexes.indexOf(index) >= 0) {
                    return accSizesArray.concat([0]); // Reset to 0 if this page is reported.
                } else {
                    return accSizesArray.concat([currentSize]);
                }
            }, [] as number[]);
            // 更新dayInfo
            const updatedDayInfo = {
                ...dayInfo,
                reportPagesInfo: {
                    pageSizes: resetReportedPageSizes
                },
                totalSize: Math.max(currentTotalSize - totalReportedSize, 0)
            };
            // 过期时间还是logDay的后七天凌晨0点  所以不是 7*24*60*60000
            const durationBeforeExpired = DEFAULT_LOG_DURATION - (+new Date() - getStartOfDay(new Date())) - (getStartOfDay(new Date()) - dayFormat2Date(logDay).getTime());
            await this.DB.addItems([
                {
                    tableName: LOG_DAY_TABLE_NAME,
                    item: updatedDayInfo,
                    itemDuration: durationBeforeExpired
                }
            ]);
            // 删除已经上报的页的日志
            for (const pageIndex of reportedPageIndexes) {
                await this.DB.deleteItemsInRange([
                    {
                        tableName: LOG_DETAIL_TABLE_NAME,
                        indexRange: {
                            indexName: LOG_DETAIL_REPORTNAME_INDEX,
                            onlyIndex: this.logReportNameFormatter(logDay, pageIndex)
                        }
                    }
                ]);
            }
        }
    }
}
