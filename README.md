# CharmFlow

Easily create Discord interaction sequences with [Eris](https://github.com/abalabahaha/eris).

## Table of contents
- [CharmFlow](#charmflow)
  - [Table of contents](#table-of-contents)
  - [Features](#features)
  - [Setup](#setup)
  - [Quick Example](#quick-example)
  - [License](#license)

## Features
- Easily create sequential flows without worrying about interaction or message id's
- Branch depending on user choices
- Delete or keep messages easily
- Cleanup at the end or after timing out
- Low API surface mostly exposing Eris.ComponentInteraction at each step in the sequence
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
	      // optionally kick off other subflows with flow() or store stuff in db
        }
    })
    .deleteMessages() // delete top level messages except for the first
    .end(interaction => interaction.editOriginalMessage("all done!"))
```

More examples can be found in the examples folder.
	
## License
MIT
