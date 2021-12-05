class SimpleAuthPlugin {
  constructor(opts) {
    this._opts = { initiatorOnly: true, adminOnly: true, ...opts };
  }

  async beforeInteractions(interaction) {
    if (!this._opts.adminOnly) {
      return true;
    }
    
    console.log('auth:before-taps', interaction.member.permissions)
    if (
      interaction.member.permissions.has("administrator") ||
      interaction.member.permissions.has("manageGuild")
    ) {
      return true;
    }
  }

  async beforeInteraction(interaction, flow) {
    if (!this._opts.initiatorOnly) {
      return true;
    }
    
    console.log('auth:before-tap')
    
    if (interaction.member.user.id === flow.initiator.user.id) {
        return true;
    }
    
    return false;
  }
}

module.exports = { SimpleAuthPlugin };
