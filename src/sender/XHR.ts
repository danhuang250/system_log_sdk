import { CodeStatus, SendResult, Sender, UploadData } from "@/core/Sender"
import WebMonitor from "@/core/WebMonitor";
export class XHRSender implements Sender<WebMonitor>{
    endpoint: string;
    instance: WebMonitor;
    constructor(
        endpoint: string,
        instance: WebMonitor,
    ) {
        this.endpoint = endpoint;
        this.instance = instance;
    }

    async send(data: UploadData): Promise<SendResult> {
        console.log(data)
        return Ajax(
            this.endpoint + '/logUpload',
            data,
            false,
            'POST',
            {
                'Content-Type': 'application/json',
                'Accept': 'application/json,text/javascript'
            }
        )
    }

    async canSend(): Promise<boolean> {
        try {
            var res = await Ajax(
                this.endpoint + 'isExist',
            )
        } catch (_e) {
            return false;
        }
        if (res.code === CodeStatus.success) {
            return true;
        }
        return false;
    }
}

/**
 * 
 * @param url 
 * @param data 
 * @param withCredentials 是否带上cookie
 * @param type 
 * @param headers 
 * @returns 
 */
async function Ajax(url: string, data?: any, withCredentials?: boolean, type?: 'GET' | 'POST' | string, headers?: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
        XHR({
            url,
            type: type || 'GET',
            data: JSON.stringify(data),
            withCredentials: !!withCredentials,
            headers: headers,
            success: (responseText: any) => {
                resolve(responseText);
            },
            fail: (err: string) => {
                reject(new Error(err || 'Request failed'));
            }
        });
    });
};

const NOOP = function (): void { /* Noop */ };


function XHR(opts: XHROpts): XMLHttpRequest {
    const useXDomainRequest: boolean = 'XDomainRequest' in window;
    const req = useXDomainRequest
        ? new (window as any).XDomainRequest()
        : new XMLHttpRequest();
    req.open(opts.type || 'GET', opts.url, true);
    req.success = opts.success || NOOP;
    req.fail = opts.fail || NOOP;
    req.withCredentials = opts.withCredentials;
    if (useXDomainRequest) {
        req.onload = opts.success || NOOP;
        req.onerror = opts.fail || NOOP;
        req.onprogress = NOOP;
    } else {
        req.onreadystatechange = function (): void {
            if (req.readyState === 4) {
                const status = req.status;
                if (status >= 200) {
                    opts.success && opts.success(req.responseText);
                } else {
                    opts.fail && opts.fail(`Request failed, status: ${status}, responseText: ${req.responseText}`);
                }
            }
        };
    }
    if (opts.type === 'POST') {
        if (opts.headers && !useXDomainRequest) {
            for (const key in opts.headers) {
                req.setRequestHeader(key, opts.headers[key]);
            }
        }
        req.send(opts.data);
    } else {
        req.send();
    }
    return req;
}

interface XHROpts {
    url: string;
    type: 'GET' | 'POST' | string;
    withCredentials: boolean;
    success?: Function;
    fail?: Function;
    headers?: any;
    data?: any;
}