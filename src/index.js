const {
    CommandInteraction,
    ComponentInteraction,
    Interaction,
    Message
  } = require("eris");
  const events = require("events");
  const LinkedList = require("linked-list-typescript");
  
  class CharmFlowStack extends LinkedList.LinkedList {
    constructor(
      initiator,
      template,
      createChildTemplateBuilder,
      acc = {},
      isDebug = false,
      level = ">"
    ) {
      super();
      this._builders = [];
      this._createChildTemplateBuilder = createChildTemplateBuilder;
      for (const t of template) this.append(t);
      this.level = level;
      this.isDebug = isDebug;
      this._initiator = initiator;
      this._messages = new Map();
      this._acc = acc;
    }
  
    log(...args) {
      console.log(this.level, ...args);
    }
  
    _createChildTemplateFactory(handler) {
      this.log("creating builder");
      const builder = this._createChildTemplateBuilder();
      this._builders.push(builder);
      return builder.flow(handler);
    }
  
    async nextInteraction(interaction, handler) {
      if (!interaction.acknowledged) {
        await interaction.acknowledge();
      }
      const result = await handler.execute(
        interaction,
        this._createChildTemplateFactory.bind(this),
        this._acc
      );
      this._lastResult = result;
  
      if (result instanceof Message) {
        this.log("received message")
        if (
          !(this.head instanceof KeepTap)
        ) {
          this.log(`to-delete: ${this._lastResult.content}`)
          this._messages.set(this._lastResult.id, this._lastResult);
        } else {
          this.log(`keeping: ${this._lastResult.content}`)
        }
      } else {
        this.log("received interaction")
      }
      
      if (this._builders.length > 0) {
        if (result instanceof Message) {
          throw new Error("Do not create a message when forking");
        }
        for (const builder of this._builders.reverse()) {
          if (!builder.isEnded) throw new Error("Builder is not ended");
          const stack = new CharmFlowStack(
            this._initiator,
            builder.template,
            this._createChildTemplateBuilder,
            this._acc,
            this.isDebug,
            this.level + ">"
          );
          this.prepend(stack);
        }
        this.log("advance: fork");
        return true;
      } else if (
        (result instanceof Interaction &&
          !(this.head instanceof CharmFlowStack))
      ) {
        this.log("advance: not stack");
        return true;
      } else if 
        (result instanceof Message && result.components.length === 0) {
        this.log("advance: no components");
        return true;
          
        
      }
      return false;
    }
  
    validateInteraction(interaction) {
      if (this._lastResult) {
        if (this._lastResult instanceof Interaction) {
          this.log("valid:interaction");
  
          if (interaction.id === this._lastResult.id) {
            return true;
          }
  
          this.log("skipping: id mismatch", interaction.id, this._lastResult.id);
          throw new Error("invalid interaction");
        } else if (this._lastResult instanceof Message) {
          this.log("valid:message", this._lastResult.content);
  
          if (this._lastResult.components.length === 0) {
            return true;
          }
  
          if (
            (this._lastResult.interaction &&
              this._lastResult.interaction.id === interaction.id) ||
            interaction.message.id === this._lastResult.id
          ) {
            return true;
          }
  
          this.log("skipping: msg id mismatch");
          throw new Error("invalid interaction");
        } else {
          return false;
        }
      } else {
        return true;
      }
    }
  
    async next(interaction) {
      this.log("stack:start-next");
      if (this.isComplete) return;
      if (!(interaction instanceof Interaction)) {
        throw new Error("Expected interaction");
      }
  
      const handler = this.head;
      this._builders = [];
  
      if (handler instanceof CharmFlowStack) {
        this.log("stack-interaction-handler");
        await handler.next(interaction);
        if (handler.isComplete) {
          this.removeHead();
          if (this._lastResult instanceof Interaction) {
            await this.next(this._lastResult);
          }
        }
      } else {
        this.removeHead();
  
        
  
        let advance = false;
        if (handler instanceof KeepTap) {
          advance = true;
        this.log("advance: keep");
          
        } else if (handler instanceof DeleteTap) {
          this.log("delete-handler");
          const toDelete = [...this._messages.values()]
          setTimeout(async () => {
            for (const messages of toDelete) {
              console.log(`deleting: ${messages.content}`)
              await messages.delete(handler.reason);
            }
          }, handler.delay);
          this._messages.clear();
          advance = true;
        this.log("advance: delete");
        } else if (
          handler instanceof InteractionTap &&
          this.validateInteraction(interaction)
        ) {
          this.log("interaction-handler", interaction.data);
          advance = await this.nextInteraction(interaction, handler);
        } else {
          console.log(handler);
          throw new Error("Unknown handler or result");
        }
  
        if (advance) {
          return this.next(interaction);
        }
      }
    }
    get isComplete() {
      return this.length === 0;
    }
  }
  
  class CharmFlowTemplateBinder {
    constructor(templateBuilder, opts, eventEmitter) {
      this._stacks = new Set();
      this._builder = templateBuilder;
      this._opts = opts;
      this._eventEmitter = eventEmitter;
    }
    async interactionHandler(interaction) {
      const completedFlows = [];
      if (interaction instanceof ComponentInteraction)
        for (const stack of this._stacks) {
          this._builder.emit("next", interaction);
          await stack.next(interaction);
          this._builder.emit("next:done", interaction);
          if (stack.isComplete) {
            this._builder.emit("stack:done", stack);
            completedFlows.push(stack);
          }
        }
      for (const instance of completedFlows) this._stacks.delete(instance);
      if (this._stacks.size === 0) this._builder.emit("stacks:empty");
      if (interaction instanceof CommandInteraction) {
        if (interaction.data.name === this._opts.commandName) {
          const stack = new CharmFlowStack(
            interaction.member.user.id,
            this._builder.template,
            () => this._builder.createChildTemplate(),
            {},
            this._opts.debug
          );
          this._stacks.add(stack);
          this._builder.emit("stack", stack);
          this._builder.emit("next", interaction);
          await stack.next(interaction);
          this._builder.emit("next:done", interaction);
        }
      }
    }
    bind() {
      this._eventEmitter.on(
        "interactionCreate",
        this.interactionHandler.bind(this)
      );
    }
    unbind() {
      this._eventEmitter.off(
        "interactionCreate",
        this.interactionHandler.bind(this)
      );
    }
  }
  
  class CharmFlowTemplateBuilder extends events.EventEmitter {
    constructor(opts) {
      super();
      this._template = new LinkedList.LinkedList();
      this._ended = false;
      this._opts = opts;
    }
  
    get template() {
      return new LinkedList.LinkedList(...this._template);
    }
  
    flow(handler) {
      this._template.append(new InteractionTap(handler));
      return this;
    }
  
    end() {
      this._ended = true;
      this.emit("end", this);
    }
  
    keepPreviousMessage() {
      this._template.append(new KeepTap());
      return this;
    }
  
    deleteMessages(delay = 0, reason) {
      this._template.append(new DeleteTap(delay, reason));
      return this;
    }
  
    isEnded() {
      return this._ended;
    }
    createChildTemplate() {
      return new CharmFlowTemplateBuilder(this._opts);
    }
  }
  
  class CharmMessage extends Message {
      constructor() {
          super();
          this._charm = {
              keep: false,
              disable: false
          }
      }
  }

  class KeepTap {}
  
  class DeleteTap {
    constructor(delay = 0, reason) {
      this.delay = delay;
      this.reason = reason;
    }
  }
  
  class InteractionTap {
    constructor(handler) {
      this.handler = handler;
    }
    async execute(interaction, builderFactory, acc) {
      return (await this.handler(interaction, builderFactory, acc)) || interaction;
    }
  }
  
  class CharmFlow extends events.EventEmitter {
    constructor(bot) {
      super();
      this._bot = bot;
    }
    onCommand(commandName, userOpts) {
      const opts = Object.assign(
        {},
        {
          restrict: ["owner", "server-manager"],
          timeout: 30000,
          debug: true,
          commandName
        },
        userOpts !== null && userOpts !== void 0 ? userOpts : {}
      );
      const builder = new CharmFlowTemplateBuilder(opts);
      builder.on("end", () => {
        const binder = new CharmFlowTemplateBinder(builder, opts, this._bot);
        binder.bind();
        this._binder = binder;
        this.emit("ready");
      });
      return builder;
    }
  }
  
  module.exports = CharmFlow;
  