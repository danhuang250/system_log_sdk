type TestAccount = {
    [key: string]: string[]
}

export const testAccount: TestAccount = {
    ["fLPwmJmZ"]:
        ["adadaafj"],
    ["EdmBr03B"]:
        ["abc"],
    ["ilzqfsHN"]:
        ["lalalala", "abcdxxx", "fffffz"],
    ["rFYMw4IJ"]:
        ["halalaj", "adaada"],
    ["pZimmCOi"]:
        ["sswa", "zjdfz", "yszmnl", "gzennml"],
    ["0ldoNXKK"]:
        ["002845", "adaladada", "hhhhxxxx"],
}


export function getTestAccount(appid?: string, userid?: string) {
    if (!appid) {
        let appIds = Object.keys(testAccount);
        appid = appIds[Math.floor(Math.random() * appIds.length)];

    }
    if (!userid) {
        let userids = testAccount[appid];
        userid = userids[Math.floor(Math.random() * userids.length)];
    }

    console.log("appid:", appid, "userid", userid);
    return {
        appid,
        userid
    }
}

