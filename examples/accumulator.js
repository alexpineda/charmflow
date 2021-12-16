const {CommandClient, Constants} = require("eris");
const CharmFlow = require("../src/index");

// setup the client
const bot = new CommandClient(process.env.DISCORD_BOT_TOKEN);
bot.on("ready", () => {
  for (const [key, guild] of bot.guilds) {
    guild.bulkEditCommands([
      {
        name: "configure",
        description: "Configure iCalbot",
        type: Constants.ApplicationCommandTypes.CHAT_INPUT
      }
    ]);
  }
});

// setup the flow
const charmFlow = new CharmFlow(bot);
charmFlow
  .onCommand("configure")
  .flow( (interaction, flow, acc) => {
    // add to this in any flow, even subflows, it's always the same reference
    acc.selection = interaction.data.values;
  })
  .end(async (interaction, timedOut, acc) => {
      // use it wherever you need it, usually at the end to show final results
      await interaction.createFollowup({
        content: `User selected ${acc.selection.join(", ")}`,
      });
  });