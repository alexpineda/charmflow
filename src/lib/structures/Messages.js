const { disableMessageComponents } = require("../util");

class Messages {
    constructor() {
      this._messages = new Map();
      this._delete = new Map();
    }
  
    get lastMessage() {
      return this._lastMessage;
    }
  
    keep(message) {
      this._messages.set(message.id, message);
      this._delete.delete(message.id);
      this._lastMessage = message;
    }
  
    queueDelete(message) {
      this._delete.set(message.id, message);
      this._messages.set(message.id, message);
      this._lastMessage = message;
    }
  
    queue(result) {
      this.queueDelete(result);
    }
  
    async delete(reason) {
      const toDelete = [...this._delete.values()];
          for (const message of toDelete) {
            await message.delete(reason);
            this._delete.delete(message.id);
            this._messages.delete(message.id);
            if (this._lastMessage === message) {
              this._lastMessage = null;
            }
          }
    }
  
    async deleteAnyMessages() {
      const toDelete = [...this._messages.values()];
      for (const message of toDelete) {
        await message.delete();
        this._delete.delete(message.id);
        this._messages.delete(message.id);
      }
    }

    disable(message) {
      if (message) {
        disableMessageComponents(message);
        return;
      }
      const toDisable = [...this._messages.values()];
      for (const message of toDisable) {
        disableMessageComponents(message);
      }
    }
  }

  module.exports = Messages;