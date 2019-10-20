# DevBed [![Travis CI Build Status](https://img.shields.io/travis/com/Richienb/devbed/master.svg?style=for-the-badge)](https://travis-ci.com/Richienb/devbed)

A simplified implementation of the Minecraft Bedrock Scripting API. For more info, read the [docs](https://richienb.github.io/devbed).

[![NPM Badge](https://nodei.co/npm/devbed.png)](https://npmjs.com/package/devbed)

## Usage

### Quickstart

To begin, install some packages with `npm i -g yo generator-minecraft-addon-devbed` or with yarn: `yarn global add yo generator-minecraft-addon-devbed`

Then run `yo minecraft-addon-devbed`.

### Manual installation

Install DevBed by running `npm install devbed` or with yarn: `yarn add devbed`.

Then add the following code to the top of your `client.js` and `server.js` files:

```js
import { DevBed } from "devbed";

const bed = new DevBed(client);
```

From here, you can use all of the functions offered by DevBed through the `bed` object.

### Migration guide

If you want to introduce DevBed into your current scripts, you can continue to use legacy code thoughout the migration.

After installing DevBed, find code in your `client.js` and `server.js` that looks like this:

```js
const system = client.registerSystem(0, 0);
```

and replace it with something like this:

```js
import { DevBed } from "devbed";

DevBed.version = {
    major: 0,
    minor: 0
};

const bed = new DevBed(client);

const system = bed.system;
```

> You should only set the version if your legacy scripts break because of the migration.

## Practical Example

### With DevBed

```js
import { DevBed } from "devbed";

const bed = new DevBed(client);

bed.on("initialize", () => {
    bed.logconfig({
        error: true,
        warn: true,
        info: true
    });
});

bed.on("first_tick", () => {
    bed.chat("What are we going to do tonight Server?");

    bed.trigger("pinky", { narf: true });
});
```

### Without DevBed

```js
const clientSystem = client.registerSystem(0, 0);

clientSystem.initialize = () => {
    const eventDataDefaults = { narf: false };
    clientSystem.registerEventData("example:pinky", eventDataDefaults);

    const scriptLoggerConfig = clientSystem.createEventData(
        "minecraft:script_logger_config"
    );
    scriptLoggerConfig.data.log_errors = true;
    scriptLoggerConfig.data.log_information = true;
    scriptLoggerConfig.data.log_warnings = true;
    clientSystem.broadcastEvent(
        "minecraft:script_logger_config",
        scriptLoggerConfig
    );
};

let firstTick = true;

clientSystem.update = () => {
    if (firstTick) {
        firstTick = false;

        let chatEventData = clientSystem.createEventData(
            "minecraft:display_chat_event"
        );
        chatEventData.data.message = "What are we going to do tonight Server?";

        clientSystem.broadcastEvent(
            "minecraft:display_chat_event",
            chatEventData
        );

        let pinkyEventData = clientSystem.createEventData("example:pinky");
        pinkyEventData.data.narf = true;

        clientSystem.broadcastEvent("example:pinky", pinkyEventData);
    }
};
```
