# CharmFlow

A charmful adapter for Eris to create message component based wizards and configuration dialogs.

## Table of contents
- [CharmFlow](#charmflow)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Setup](#setup)
  - [Quick Example](#quick-example)
  - [License](#license)

## Features
- Create multiple branching flows depending on user choices
- Delete or keep messages easily
- Cleanup at the end or after timing out
- Low API surface mostly exposing Eris.CommandClient at each interaction
- Automatically acknowledges interactions

## Setup
To run this project, install it locally using npm:

```
$ npm install --save charmflow
```

or with yarn

```
$ yarn add -S charmflow
```

## Quick Example
```js
const charmFlow = new CharmFlow(erisClient);

charmFlow.onCommand("setup")
    .flow(interaction => interaction.createFollowup("Hey welcome to My Bot, this is a quick setup guide!"))
    .keepMessage()
    .flow(interaction => interaction.createFollowup(/* ... */))
    .flow((interaction, flow) => { 
        // do this if they picked yes
        if (interaction.data.values.includes("yes")) {
        }
    })
    .deleteMessages() // delete top level messages except for the first
    .end(interaction => interaction.editOriginalMessage("all done!"))
```

More examples can be found in the examples folder.
	
## License
MIT