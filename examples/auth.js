const {CommandClient, Constants} = require("eris");
const CharmFlow = require("../src/index");

// restricts users to server admins and server (guild) managers, other user interactions will be ignored
const { SimpleAuthPlugin } = require("../src/auth");

const bot = new CommandClient(process.env.DISCORD_BOT_TOKEN);
const charmFlow = new CharmFlow(bot, {
    plugins: [ new SimpleAuthPlugin({ initiatorOnly: true, adminOnly: true }) ] 
    // Defaults: 
    // adminOnly - true - only server admins or managers can initialize the command
    // initiatorOnly - true -  only the initiator of the command can follow up
}); 

