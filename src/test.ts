import WebMonitor from "./core/WebMonitor";

let wm = new WebMonitor({ appid: "ceshiappid", userid: "ceshiuserid" })
wm.log({ type: 0, msg: "567" })