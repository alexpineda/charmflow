
class InteractionHandler {
    constructor(handler) {
      this.handler = handler;
      this.keepMessage = false;
      this.disableComponents = false;
    }
  
    async execute(interaction, builderFactory, acc, messages) {
      return await this.handler(interaction, builderFactory, acc, messages);
    }
}

module.exports = InteractionHandler;