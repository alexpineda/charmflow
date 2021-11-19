import { CommandInteraction, ComponentInteraction, Interaction, Message, TextableChannel, User } from "eris";
import { EventEmitter } from "events";
import { LinkedList } from "linked-list-typescript";

type ComposeOptions = {
  restrict: ("owner" | "server-manager")[];
  timeout: number;
  acknowledgeAllInteractions: boolean,
  deleteAfterEach?: boolean
};

class CharmFlowTemplateStack extends LinkedList<
  ComponentInteractionTap | CommandInteractionTap | CharmFlowTemplateStack
> {
  private _lastResult: Message | Interaction;
  private _createChildTemplateBuilder: () => CharmFlowTemplateBuilder;
  private _builders: CharmFlowTemplateBuilder[] = [];
  private _initiator: User;

  constructor(template, createChildTemplateBuilder) {
    super();
    this._createChildTemplateBuilder = createChildTemplateBuilder;
    for (const t of template) {
      this.append(t);
    }
  }

  private _createChildTemplateFactory(handler: ComponentInteractionHandler) {
    const builder = this._createChildTemplateBuilder();
    this._builders.push(builder);
    return builder.flow(handler);
  }

  async nextCommandInteraction(
    interaction: CommandInteraction,
    handler: CommandInteractionTap
  ) {
    if (this._lastResult) {
      throw new Error("Must tap command interaction first");
    }

    await interaction.acknowledge();
    const result = await handler.execute(interaction);
    if (result instanceof Message === false) {
      throw new Error("Expected message from command interaction");
    }
    if (result.components.length === 0) {
      throw new Error("Expected message components from command interaction");
    }
    this._initiator = result.author;
    return result;
  }

  async nextComponentInteraction(
    interaction: ComponentInteraction,
    handler: ComponentInteractionTap
  ) {
    if (!this._lastResult) {
      throw new Error("No item to check against");
    }

    await interaction.acknowledge();
    const result = await handler.execute(
      interaction,
      this._createChildTemplateFactory.bind(this)
    );
    if (result) {
      return result;
    }
    return interaction;
  }

  async next(interaction: Interaction) {
    if (this._lastResult) {
      if (this.head instanceof CommandInteractionTap) {
        throw new Error("Must tap command interaction first");
      }
      if (interaction instanceof ComponentInteraction === false) {
          return;
      }
      if (this._lastResult instanceof Interaction) {
          if (interaction.id !== this._lastResult.id) {
            return;
          }
      } else if (this._lastResult instanceof Message) {
        if ((interaction as ComponentInteraction).message .id !== this._lastResult.id) {
          return;
        }
      }
    }
    const handler = this.head;
    let result;
    if (handler instanceof CommandInteractionTap) {
      if (interaction instanceof CommandInteraction) {
        result = await this.nextCommandInteraction(interaction, handler);
        this.removeHead();
      } else {
        throw new Error("Expected command interaction");
      }
    } else if (handler instanceof ComponentInteractionTap) {
      if (interaction instanceof ComponentInteraction) {
        result = await this.nextComponentInteraction(interaction, handler);
        this.removeHead();
      } else {
        throw new Error("Expected component interaction");
      }
    } else if (handler instanceof CharmFlowTemplateStack) {
      await handler.next(interaction);
      if (handler.isComplete) {
        this.removeHead();
      }
    }

    this._builders = [];
    if (this._builders.length > 0) {
      if (result) {
        throw new Error("Cannot create messages when forking");
      }

      for (const builder of this._builders) {
        if (!builder.isEnded) {
          throw new Error("Builder is not ended");
        }
        const stack = new CharmFlowTemplateStack(
          builder.template,
          this._createChildTemplateBuilder
        );
        this.append(stack);
      }

      // new stacks, run immediately with passthrough interaction
      await this.next(interaction);
    }
  }

  get isComplete() {
    return this.length === 0;
  }
}

class CharmFlowTemplateBinder extends EventEmitter {
  private _opts: ComposeOptions;
  private _stacks: Set<CharmFlowTemplateStack> = new Set();
  private _builder: CharmFlowTemplateBuilder;
  private _eventEmitter: EventEmitter;

  constructor(
    templateBuilder: CharmFlowTemplateBuilder,
    opts: ComposeOptions,
    eventEmitter: EventEmitter
  ) {
    super();
    this._builder = templateBuilder;
    this._opts = opts;
    this._eventEmitter = eventEmitter;
  }

  async interactionHandler(interaction) {
    const completedFlows = [];
    console.log(CommandInteraction)
    if (interaction instanceof ComponentInteraction) {
      for (const stack of this._stacks) {
        await stack.next(interaction);
        if (stack.isComplete) {
          completedFlows.push(stack);
        }
      }
    }

    for (const instance of completedFlows) {
      this._stacks.delete(instance);
    }

    if (interaction instanceof CommandInteraction) {
      if (this._builder.command && interaction.data.name === this._builder.command) {
        const stack = new CharmFlowTemplateStack(this._builder.template, () =>
          this._builder.createChildTemplate()
        );
        this._stacks.add(stack);
        await stack.next(interaction);
      }
    }
  }

  bind() {
    this._eventEmitter.on("interactionCreate", this.interactionHandler.bind(this));
  }

  unbind() {
    this._eventEmitter.off("interactionCreate", this.interactionHandler.bind(this));
  }
}

type CharmFlowTemplate = LinkedList<
  CommandInteractionTap | ComponentInteractionTap
>;

class CharmFlowTemplateBuilder extends EventEmitter {
  private _opts: ComposeOptions;
  private _eventEmitter: EventEmitter;
  private _command: string | null;
  private _template: CharmFlowTemplate = new LinkedList<
    CommandInteractionTap | ComponentInteractionTap
  >();
  private _ended = false;

  constructor(
    command: string | null,
    opts: ComposeOptions,
    eventEmitter: EventEmitter
  ) {
    super();
    this._command = command;
    this._opts = opts;
    this._eventEmitter = eventEmitter;
  }

  get command() {
    return this._command;
  }

  get template() {
    return new LinkedList<any>(...this._template);
  }

  start(handler: CommandInteractionHandler) {
    this._template.append(new CommandInteractionTap(handler));
    return this;
  }

  flow(handler: ComponentInteractionHandler) {
    this._template.append(new ComponentInteractionTap(handler));
    return this;
  }

  end() {
    this._ended = true;
    this.emit("end", this);
  }

  isEnded() {
    return this._ended;
  }

  createChildTemplate() {
    return new CharmFlowTemplateBuilder(null, this._opts, this._eventEmitter);
  }
}

type BuilderFactory = (handler : ComponentInteractionHandler) => CharmFlowTemplateBuilder;
type ComponentInteractionHandler = (
  interaction: ComponentInteraction,
  builderFactory?: BuilderFactory
) => Promise<Message | Interaction | void>;

class ComponentInteractionTap {
  private handler: ComponentInteractionHandler;

  constructor(handler: ComponentInteractionHandler) {
    this.handler = handler;
  }

  async execute(
    interaction: ComponentInteraction,
    builderFactory: BuilderFactory
  ): ReturnType<ComponentInteractionHandler> {
    return await this.handler(interaction, builderFactory);
  }
}

type CommandInteractionHandler = (
  interaction: CommandInteraction
) => Promise<Message<TextableChannel>>;

class CommandInteractionTap {
  private handler: CommandInteractionHandler;

  constructor(handler: CommandInteractionHandler) {
    this.handler = handler;
  }

  async execute(interaction): ReturnType<CommandInteractionHandler> {
    return await this.handler(interaction);
  }
}

export default class CharmFlow {
  private _bot: EventEmitter;

  constructor(bot: EventEmitter) {
    this._bot = bot;
  }

  onCommand(command: string, userOpts?: Partial<ComposeOptions>) {
    const opts = Object.assign({}, {
        restrict: ["owner", "server-manager"],
        timeout: 30000,
        acknowledgeAllInteractions: true,
        deleteAfterEach: false
    }, userOpts ?? {});
    
    const builder = new CharmFlowTemplateBuilder(command, opts, this._bot);
    builder.on("end", () => {
      const binder = new CharmFlowTemplateBinder(builder, opts, this._bot);
      binder.bind();
    });
    return builder;
  }
}
