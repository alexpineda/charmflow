const { Interaction, Message } = require("eris");
const { disableMessageComponents } = require("./util");
const { Stack, Flow } = require("./structures");
const {
  InteractionHandler,
  EndHandler,
  DisableHandler,
  DeleteHandler,
  KeepHandler,
} = require("./handlers");

class Tap {
  constructor(
    interaction,
    template,
    createHandlerChain,
    acc = {},
    isDebug = false
  ) {
    this._createHandlerChain = createHandlerChain;
    this.isDebug = isDebug;
    this.initiator = interaction.member;
    this._acc = acc;
    this._stack = new Stack([new Flow(template, interaction)]);
  }

  log(...args) {
    this.isDebug && console.log(">".repeat(this._stack.length), ...args);
  }

  push(items) {
    this._stack.push(items);
  }

  pop() {
    return this._stack.pop();
  }

  get flow() {
    return this._stack.peek();
  }

  get accumulator() {
    return this._acc;
  }

  async _endHandler(interaction, tap, timedOut = false) {
    if (!(tap instanceof EndHandler)) {
      throw new Error("end tap without EndTap");
    }
    if (!interaction.acknowledged) {
      await interaction.acknowledge();
    }
    await tap.execute(interaction, this._acc, timedOut, this.flow.messages);
  }

  async _timeoutHandler(interaction, tap) {
    if (!(tap instanceof EndHandler)) {
      throw new Error("timeout without EndTap");
    }
    await this._endHandler(interaction, tap, true);
  }

  async _interactionHandler(tap, interaction, builders) {
    this.log("handler:interaction", interaction.data);
    if (!interaction.acknowledged) {
      await interaction.acknowledge();
    }
    // get new result from interaction handler
    return await tap.execute(
      interaction,
      (handler) => {
        this.log("creating builder");
        const builder = this._createHandlerChain();
        builders.push(builder);
        return builder.flow(handler);
      },
      this._acc,
      this.flow.messages
    );
  }

  async _passthroughHandlers(handler, interaction) {
    if (handler instanceof EndHandler) {
      await this._endHandler(interaction, handler);
    } else if (handler instanceof DisableHandler) {
      disableMessageComponents(this.flow.messages.lastMessage);
    } else if (handler instanceof DeleteHandler) {
      await this.flow.messages.delete(handler.reason);
    } else if (handler instanceof KeepHandler) {
      await this.flow.messages.keep(this.flow.messages.lastMessage);
    } else {
      return false;
    }
    return true;
  }

  // entry point from discord interaction event
  async onInteraction(interaction) {
    if (this.isComplete) return;

    if (!(interaction instanceof Interaction)) {
      throw new Error("Expected interaction");
    }

    if (!this.flow.handlers.peek()) {
      this.pop();
      if (!this.flow) {
        return;
      } else if (this.flow.well) {
        interaction = this.flow.well;
        this.flow.well = null;
      }
    }

    // commmand interaction, no previous state -> ok!
    // component interaction, previous message. id === interaction.message.id -> ok!
    // new subflow, component interaction, no previous message
    // block entry if this interaction doesn't belong to us
    if (this.flow.messages.lastMessage) {
      if (
        !this.messageBelongsToInteraction(
          interaction,
          this.flow.messages.lastMessage
        )
      ) {
        return;
      }
    }

    const handler = this.flow.handlers.pop();
    this.log("handler", handler.constructor.name);

    const pass = await this._passthroughHandlers(handler, interaction);
    if (pass) {
      return interaction;
    }

    this.flow.interaction = interaction;

    if (handler instanceof InteractionHandler) {

      const subflows = [];
      const response = await this._interactionHandler(
        handler,
        interaction,
        subflows
      );

       if (subflows.length > 0) {
        this.flow.well = interaction;

        this.push(
          subflows
            .reverse()
            .map((subflow) => new Flow(subflow.template, interaction))
        );
        if (response instanceof Message) {
          this.log(
            "Do not create a message when forking unless you use await flow()"
          );
        }
      }

      if (response instanceof Message) {
        this.flow.messages.queue(response);
        return subflows.length > 0 ? interaction : false;
      } else {
        return interaction;
      }

    }

    throw new Error("wtf we doing here");
  }

  messageBelongsToInteraction(interaction, message) {
    let valid = false;
    // An object containing info about the interaction the message is responding to, if applicable
    // interaction -> message
    if (message.interaction && message.interaction.id === interaction.id) {
      this.log("validate:message - message.interaction.id === interaction.id");
      valid = true;
    } else {
      this.log("validate:message - message.interaction.id !== interaction.id");
    }

    // the message the interaction came from...
    // message.componenets[] -> interaction
    if (interaction.message.id === message.id) {
      this.log("validate:message - interaction.message.id === message.id");
      valid = true;
    } else {
      this.log("validate:message - interaction.message.id !== message.id");
    }

    return valid;
  }

  _timeout() {
    this.log("timing out");
    if (this.isComplete) {
      return;
    }

    let handler;
    do {
      handler = this.flow.handlers.pop(); 
    } while(handler);

    if (handler instanceof EndHandler) {
      this._timeoutHandler(this.flow.interaction, handler);
    }
  }

  timeout() {
    while (this._stack.length > 1) {
      this._timeout( );
      this.pop();
    }
  }

  get isComplete() {
    return this._stack.length === 0;
  }
}

module.exports = Tap;
