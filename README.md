# LIVEU STATS BOT

Adds a chat command to check the current modems and bitrate on the liveu.

## Build Prerequisities

-   [Node.js](http://nodejs.org/) (with NPM)

## Installation from Source

-   `git clone <repository-url>` or use the `clone or download` button above.
-   Change into the new directory.
-   `npm install`

## Config

Edit `config.json` to your own settings.

```JSON
{
    "liveu": {
        "email": "YOUR LIVEU EMAIL",
        "password": "YOUR LIVEU PASSWORD"
    },
    "twitch": {
        "botUsername": "TWITCH BOT USERNAME",
        "botOauth": "TWITCH BOT OAUTH",
        "twitchChannel": "YOUR TWITCH CHANNEL",
        "commands": ["!lustats", "!liveustats", "!lus"]
    },
    "nginx": {
        "stats": "http://localhost/stat",
        "application": "publish",
        "key": "live"
    }
}
```

The nginx part is optional

## How to run from source

Run the node app by running: `npm start`.
