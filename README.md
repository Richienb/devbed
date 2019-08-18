# DevBed [![Travis CI Build Status](https://img.shields.io/travis/com/Richienb/devbed/master.svg?style=for-the-badge)](https://travis-ci.com/Richienb/devbed)

A simplified implementation of the Minecraft Bedrock Scripting API. For more info, read the [docs](https://richienb.github.io/devbed).

[![NPM Badge](https://nodei.co/npm/devbed.png)](https://npmjs.com/package/devbed)

## Example

### With DevBed

```js
import { DevBed } from "devbed"

const bed = new DevBed(client)

bed.on("initialize", () => {
    bed.logconfig({
        error: true,
        warn: true,
        info: true
    })
})

bed.on("update", () => {
    if (bed.ticks === 1) {
        bed.chat("What are we going to do tonight Server?")

        bed.trigger("example:pinky", { narf: true });
    }
})
```

### Without DevBed

```js
const clientSystem = client.registerSystem(0, 0);

clientSystem.initialize = () => {
	const eventDataDefaults = {narf: false}
	clientSystem.registerEventData("cov:pinky", eventDataDefaults)

	const scriptLoggerConfig = clientSystem.createEventData("minecraft:script_logger_config");
	scriptLoggerConfig.data.log_errors = true;
	scriptLoggerConfig.data.log_information = true;
	scriptLoggerConfig.data.log_warnings = true;
	clientSystem.broadcastEvent("minecraft:script_logger_config", scriptLoggerConfig);
}

let firstTick = true;

clientSystem.update = () => {

	if (firstTick) {
		firstTick = false;

		let chatEventData = clientSystem.createEventData("minecraft:display_chat_event");
		chatEventData.data.message = "What are we going to do tonight Server?";

		clientSystem.broadcastEvent("minecraft:display_chat_event", chatEventData);

		let pinkyEventData = clientSystem.createEventData("cov:pinky");
		pinkyEventData.data.narf = true;

		clientSystem.broadcastEvent("cov:pinky", pinkyEventData);
	}
}
```
