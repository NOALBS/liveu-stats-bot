const puppeteer = require("puppeteer");
const fs = require("fs");
const fetch = require("node-fetch");
const tmi = require("tmi.js");
const xml2js = require("xml2js");

const config = require("../config.json");
let browserData = require("../browser.json");

async function getAuth() {
    const { email, password } = config.liveu;
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto("https://solo.liveu.tv/login", {
        waitUntil: "networkidle2",
    });

    await page.waitForSelector("input[id='txtUsername']", { visible: true });
    await page.type("input[id='txtUsername']", email);
    await page.type("input[id='txtPassword']", password);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0" });

    const localStorage = await page.evaluate(() =>
        Object.assign({}, window.localStorage)
    );
    browserData.token = JSON.parse(localStorage["ngStorage-access_token"]);
    browserData.unit = JSON.parse(localStorage["ngStorage-mobileunit"]);

    fs.writeFileSync("./browser.json", JSON.stringify(browserData));

    await browser.close();
}

async function getUnits() {
    const { unit, token } = browserData;

    let response = await fetch(
        "https://lu-central.liveu.tv/luc/luc-core-web/rest/v0/units/" +
            unit +
            "/status/interfaces",
        {
            credentials: "include",
            headers: {
                accept: "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                authorization: "Bearer " + token,
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
            },
            referrer: "https://solo.liveu.tv/dashboard/units/" + unit,
            referrerPolicy: "no-referrer-when-downgrade",
            body: null,
            method: "GET",
            mode: "cors",
        }
    );

    switch (response.status) {
        case 200:
            let data = await response.json();
            let connected = data.filter((e) => {
                return e.connected;
            });

            connected.forEach((e) => {
                switch (e.port) {
                    case "eth0":
                        e.port = "Ethernet";
                        break;
                    case "wlan0":
                        e.port = "WiFi";
                        break;
                    case "2":
                        e.port = "USB1";
                        break;
                    case "3":
                        e.port = "USB2";
                        break;
                    default:
                        break;
                }
            });

            return connected;
        case 204:
            return [];
        case 401:
            console.log("Request failed getting a new auth token");
            await getAuth();
            console.log("Got a new auth token trying again");
            return await getUnits();
        default:
            console.log("Something went wrong when getting the units");
            break;
    }
}

async function getBitrate() {
    const { stats, application, key } = config.nginx;
    let bitrate = 0;

    const response = await fetch(stats);
    const data = await response.text();

    if (response.ok) {
        try {
            xml2js.parseString(data, (err, result) => {
                const publish = result.rtmp.server[0].application.find(
                    (stream) => {
                        return stream.name[0] === application;
                    }
                ).live[0].stream;

                if (publish == null) {
                    return 0;
                } else {
                    const stream = publish.find((stream) => {
                        return stream.name[0] === key;
                    });

                    bitrate = Math.round(stream.bw_video[0] / 1024);
                }
            });
        } catch (error) {
            // Well that didn't work just return 0
        }
    }

    return bitrate;
}

let isTimeout = false;

function timeout(ms) {
    isTimeout = true;

    setTimeout(() => {
        isTimeout = false;
    }, ms);
}

const {
    botUsername,
    botOauth,
    channel,
    commands,
    commandCooldown,
} = config.twitch;

const client = new tmi.Client({
    connection: {
        reconnect: true,
        secure: true,
    },
    identity: {
        username: botUsername,
        password: botOauth,
    },
    channels: [channel],
});

client.on("message", async (channel, tags, message, self) => {
    if (!isTimeout && commands.includes(message.toLowerCase())) {
        // (MODEMS) WiFi: 2453 Kbps, USB1: 2548 Kbps, USB2: 2328 Kbps, Ethernet: 2285 Kbps. (TOTAL BITRATE) LiveU to LRT: 10739 Kbps, LRT to RTMP: 8104 Kbps
        timeout(1000 * commandCooldown);
        let units = await getUnits();

        if (units.length == 0) {
            client.say(channel, "LiveU Offline :(");
            return;
        }

        let message = "(MODEMS) ";
        let total = 0;

        units.forEach((e, i) => {
            message += `${e.port}: ${e.uplinkKbps} Kbps${
                i != units.length - 1 ? ", " : ""
            }`;
            total += e.uplinkKbps;
        });

        if (total == 0) {
            client.say(channel, "LiveU Online and Ready");
            return;
        }

        client.say(channel, message);

        if ("nginx" in config) {
            message = `(TOTAL BITRATE) LiveU to LRT: ${total} Kbps, LRT to RTMP: ${await getBitrate()} Kbps`;
        } else {
            message = `(TOTAL BITRATE) LiveU to LRT: ${total} Kbps`;
        }

        client.say(channel, message);
    }
});

client.connect();
console.log("Started liveu stats bot");
