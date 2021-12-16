const {CommandClient, Constants} = require("eris");
const CharmFlow = require("../src/index");

const bot = new CommandClient(process.env.DISCORD_BOT_TOKEN);

const charmFlow = new CharmFlow(bot);
charmFlow
  .onCommand("one two") // two is a subcommand
  .end(async (interaction, timedOut, acc) => {
      await interaction.createFollowup({
        content: `Great job subcommander!`,
      });
  });