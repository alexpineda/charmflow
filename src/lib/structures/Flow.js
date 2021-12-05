const Messages = require("./Messages");
// stack state
class Flow {
    constructor(template, interaction) {
      this.handlers = template;
      this.interaction = interaction;
      this.messages = new Messages();
    }
  }
  
module.exports = Flow;