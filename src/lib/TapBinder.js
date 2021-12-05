const { CommandInteraction } = require("eris");
const HandlerChain = require("./HandlerChain");
const Tap = require("./Tap");

class TapBinder {
  constructor(chain, opts, bot) {
    this._taps = new Set();
    this._timeouts = new WeakMap();
    this._chain = chain;
    this._opts = opts;
    this._bot = bot;
  }

  async doPlugins(fn, ...args) {
    for (const plugin of this._opts.plugins) {
      if (!plugin[fn]) continue;
      if (!(await plugin[fn](...args))) {
        return false;
      }
    }
    return true;
  }

  async interactionHandler(interaction) {
    if (!this.doPlugins("beforeInteractions", interaction)) {
      return;
    }
    const completedTaps = [];

    if (interaction instanceof CommandInteraction) {
      if (interaction.data.name === this._opts.commandName) {
        const tap = new Tap(
          interaction,
          this._chain.template,
          () => new HandlerChain(),
          {},
          this._opts.debug
        );
        this._taps.add(tap);
      }
    }

    for (const tap of this._taps) {
      if (!this.doPlugins("beforeInteraction", interaction, tap)) {
        continue;
      }

      let _interaction = interaction;

      do {
        _interaction = await tap.onInteraction(_interaction);
      } while (_interaction);

      if (tap.isComplete) {
        completedTaps.push(tap);
      } else if (this._opts.timeout) {
        clearTimeout(this._timeouts.get(tap));
        this._timeouts.set(
          tap,
          setTimeout(() => {
            tap.timeout();
            this._taps.delete(tap);
          }, this._opts.timeout)
        );
      }
    }
    for (const instance of completedTaps) this._taps.delete(instance);
  }

  bind() {
    this._bot.on("interactionCreate", this.interactionHandler.bind(this));
  }
  unbind() {
    this._bot.off("interactionCreate", this.interactionHandler.bind(this));
  }
}

module.exports = TapBinder;
