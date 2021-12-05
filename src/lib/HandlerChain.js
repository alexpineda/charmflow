const Queue = require("./structures/Queue");
const { InteractionHandler, EndHandler, DisableHandler, DeleteHandler, KeepHandler} = require("./handlers");

class HandlerChain {
    constructor() {
      this._template = new Queue();
      this._ended = false;
      this.onEnd = () => {};
    }
  
    get template() {
      return this._template.copy();
    }
  
    flow(handler) {
      this._template.push(new InteractionHandler(handler));
      return this;
    }
  
    end(handler) {
      this._template.push(new EndHandler(handler));
      this._ended = true;
      this.onEnd();
    }
  
    keepMessage() {
      this._template.push(new KeepHandler());
      return this;
    }
  
    disableComponents() {
      this._template.push(new DisableHandler());
      return this;
    }
  
    deleteMessages(reason) {
      this._template.push(new DeleteHandler(reason));
      return this;
    }
  
    isEnded() {
      return this._ended;
    }

  }

module.exports = HandlerChain;