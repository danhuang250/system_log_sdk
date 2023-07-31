export interface Sender<T> {
    endpoint: string,
    instance: T;
    send(data: UploadData): Promise<SendResult>;
}

export interface SendResult { code: string, msg: string }

export enum CodeStatus {
    success = "00000",
}

export interface UploadData {
    appid: string,
    userid: string,
    logArray: string[]
}
