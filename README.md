# DevBed [![Travis CI Build Status](https://img.shields.io/travis/com/Richienb/devbed/master.svg?style=for-the-badge)](https://travis-ci.com/Richienb/devbed)

A simplified implementation of the Minecraft Bedrock Scripting API. For more info, read the [docs](https://richienb.github.io/devbed).

[![NPM Badge](https://nodei.co/npm/devbed.png)](https://npmjs.com/package/devbed)

## Example

### With DevBed

```ts
import * as DevBed from "devbed"

namespace Client {
    const bed = new DevBed(client)

    bed.on("initialize", () => {
        bed.logconfig({
            info: true,
            warn: true,
            error: true
        })
    })

    bed.on("update", () => {
        if (bed.ticks === 1) {
            bed.chat("What are we going to do tonight Server?")

            bed.trigger("example:foo", { narf: true })
        }
    })
}
```

### Without DevBed

```ts
namespace Client {
    const system = client.registerSystem(0, 0)

    system.initialize = function() {
        const eventDataDefaults = { narf: false }
        system.registerEventData("example:foo", eventDataDefaults)

        const scriptLoggerConfig = system.createEventData(
            SendToMinecraftClient.ScriptLoggerConfig
        )
        scriptLoggerConfig.data.log_errors = true
        scriptLoggerConfig.data.log_information = true
        scriptLoggerConfig.data.log_warnings = true
        system.broadcastEvent(
            SendToMinecraftClient.ScriptLoggerConfig,
            scriptLoggerConfig
        )
    }

    let firstTick = true

    system.update = function() {
        if (firstTick) {
            firstTick = false

            let chatEventData = system.createEventData(
                "minecraft:display_chat_event"
            )
            chatEventData.data.message =
                "What are we going to do tonight Server?"

            system.broadcastEvent(
                SendToMinecraftClient.DisplayChat,
                chatEventData
            )

            const eventData = system.createEventData("example:foo")
            eventData.data.narf = true

            system.broadcastEvent("example:foo", eventData)
        }
    }
}
```
