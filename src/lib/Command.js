
const HandlerChain = require("./HandlerChain");
const TapBinder = require("./TapBinder");

class Command  {
    constructor(bot, opts) {
      this._bot = bot;
      this._opts = Object.assign(
        {},
        {
          timeout: 30000,
          debug: false,
          plugins: [],
        },
        opts || {}
      );
    }
    onCommand(commandName, userOpts) {
      const opts = Object.assign({ commandName }, this._opts, userOpts || {});
      const chain = new HandlerChain();
      chain.onEnd = () => {
        const binder = new TapBinder(chain, opts, this._bot);
        binder.bind();
        this._binder = binder;
      };
      return chain;
    }
  }

module.exports = Command;