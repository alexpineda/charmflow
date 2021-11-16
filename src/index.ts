import { CommandInteraction, ComponentInteraction, Interaction, Message, TextableChannel, User } from "eris";
import { EventEmitter } from "events";
import { LinkedList } from "linked-list-typescript";

type ComposeOptions = {
  restrict: ("owner" | "server-manager")[];
  timeout: number;
};

class CharmFlowTemplateInstance {
  private _template:CharmFlowTemplate = new LinkedList<ComponentInteractionTap|CommandInteractionTap>();
  private _createdAt = Date.now();
  private _initiator: User;
  timedOut = false;

  constructor(template: LinkedList<ComponentInteractionTap|CommandInteractionTap>) {
    this._template = template;
  }
  
  get isComplete() {
    return this._template.length === 0;
  }

  async next(
    interaction?: Interaction,
    lastItem?: Message | Interaction,
    builderFactory?: (handler: ComponentInteractionHandler) => CharmFlowTemplateBuilder
  ) {
    if (lastItem && this._template.head instanceof CommandInteractionTap) {
      throw new Error("Must tap command interaction first");
    } else if (
      !lastItem &&
      this._template.head instanceof CommandInteraction === false
    ) {
      throw new Error("No item to check against");
    }

    const action = this._template.removeHead();
    if (action instanceof CommandInteractionTap) {
      if (interaction instanceof CommandInteraction === false) {
        throw new Error("mismatch handler for command interaction");
      }
      await (interaction as CommandInteraction).acknowledge();
      const result = await action.execute(interaction);
      if (result instanceof Message === false) {
        throw new Error("Expected message from command interaction");
      }
      if (result.components.length === 0) {
        throw new Error("Expected message components from command interaction");
      }
      this._initiator = result.author;
      return result;
    } else if (action instanceof ComponentInteractionTap) {
      if (interaction instanceof ComponentInteraction === false) {
        throw new Error("mismatch handler for component interaction");
      }
      await (interaction as ComponentInteraction).acknowledge();

      const result = await action.execute(interaction, builderFactory);

      if (result) {
        return result;
      }
      return interaction;
    } else {
      throw new Error("Unknown interaction");
    }
  }
}

class CharmFlowTemplateStack extends LinkedList<CharmFlowTemplateInstance|CharmFlowTemplateStack> {
  private _lastResult: Message | Interaction;
  private _createChildTemplateBuilder: () => CharmFlowTemplateBuilder;
  private _builders: CharmFlowTemplateBuilder[] = [];

  constructor(createChildTemplateBuilder) {
    super();
    this._createChildTemplateBuilder = createChildTemplateBuilder;
  }

  private _createChildTemplateFactory(handler: ComponentInteractionHandler) {
      const builder = this._createChildTemplateBuilder();
      this._builders.push(builder);
      return builder.flow(handler);
  }

  async next(interaction: Interaction) {
    const handler = this.head;
    if (handler) {
      this._builders = [];
      const lastResult = await (handler as CharmFlowTemplateInstance).next(
        interaction,
        this._lastResult,
        this._createChildTemplateFactory.bind(this)
      );
      
      if (this._builders.length > 0) {
          if (lastResult) {
              throw new Error("Cannot create messages when forking")
          }

          for (const builder of this._builders) {
              if (!builder.isEnded) {
                throw new Error("Builder is not ended");
              }
              const stack = new CharmFlowTemplateStack(this._createChildTemplateBuilder);
              stack.append(new CharmFlowTemplateInstance(builder.template))
               this.append(stack);
          }
          
          // new stacks, run immediately
          await this.next(interaction);
        
      }
      if (handler.isComplete) {
        this.removeHead();
      }
    }
    throw new Error("No handler");
  }

  get isComplete() {
    return this.length === 0;
  }
}

class CharmFlowTemplateBinder extends EventEmitter {
  private _opts: ComposeOptions;
  private _command: string | null;
  private _stacks: Set<CharmFlowTemplateStack>;
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
      if (this._command && interaction.data.name === this._command) {
        const stack = new CharmFlowTemplateStack(
          () => this._builder.createChildTemplate()
        );
        stack.append(new CharmFlowTemplateInstance(this._builder.template));
        this._stacks.add(stack);
        await stack.next(interaction);
      }
    }
  }

  bind() {
    this._eventEmitter.on("interactionCreate", this.interactionHandler);
  }

  unbind() {
    this._eventEmitter.off("interactionCreate", this.interactionHandler);
  }
}

type CharmFlowTemplate = LinkedList<CommandInteractionTap|ComponentInteractionTap>;

class CharmFlowTemplateBuilder extends EventEmitter {
  private _opts: ComposeOptions;
  private _eventEmitter: EventEmitter;
  private _command: string | null;
  private _template: CharmFlowTemplate = new LinkedList<CommandInteractionTap|ComponentInteractionTap>();
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

type ComponentInteractionHandler = (
  interaction: ComponentInteraction,
  builderFactory?: (
    flow: (handler: ComponentInteractionHandler) => CharmFlowTemplateBuilder
  ) => void
) => Promise<void | Message<TextableChannel>>;

class ComponentInteractionTap {
  private handler: ComponentInteractionHandler;

  constructor(handler: ComponentInteractionHandler) {
    this.handler = handler;
  }

  execute(
    interaction,
    builderFactory
  ): ReturnType<ComponentInteractionHandler> {
    return this.handler(interaction, builderFactory);
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

  execute(interaction): ReturnType<CommandInteractionHandler> {
    return this.handler(interaction);
  }
}

export default class CharmFlow {
  private _bot: EventEmitter;

  constructor(bot: EventEmitter) {
    this._bot = bot;
  }

  onCommand(command: string, opts: ComposeOptions) {
    const builder = new CharmFlowTemplateBuilder(command, opts, this._bot);
    builder.on("end", () => {
      const binder = new CharmFlowTemplateBinder(builder, opts, this._bot);
      binder.bind();
    });
  }
}
