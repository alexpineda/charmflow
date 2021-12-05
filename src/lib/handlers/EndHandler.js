class EndHandler {
    constructor(handler) {
      this.handler = handler;
    }
  
    async execute(interaction, acc, timedOut, forceDelete) {
      if (!this.handler) return;
      await this.handler(interaction, acc, timedOut, forceDelete);
    }
  }
  
module.exports = EndHandler;