const { CommandClient, Constants } = require("eris");
const CharmFlow = require("../index");

const bot = new CommandClient(process.env.DISCORD_BOT_TOKEN);
bot.on("ready", () => {
  for (const [key, guild] of bot.guilds) {
    guild.bulkEditCommands([
      {
        name: "configure",
        description: "Configure iCalbot",
        type: Constants.ApplicationCommandTypes.CHAT_INPUT,
      },
    ]);
  }
});


const charmFlow = new CharmFlow(bot, { timeout: 5000 }); // global timeout setting, default: 30_000
charmFlow
  .onCommand("configure", { timeout: 10000 }) // command-specific timeout setting, overrides global
  .flow(async (interaction) => {
    return await interaction.createFollowup({
      content: "Where should iCalbot send event notifications?",
      components: [
        {
          type: Constants.ComponentTypes.BUTTON,
          /* other options */
        },
      ],
    });
  })
  .keepMessage() // keep original so we can edit it later
  /** other flows */
  .deleteMessages()
  .end(async (interaction, acc, timedOut, messages) => {
     // While not used in this example, you can use forceDelete in child flows 
     // in order to delete even kept messages on timeout
    if (timedOut) {
      await interaction.editOriginalMessage({
        content: `Configuration Timed Out`,
        components: [],
      });
    } else {
      await interaction.editOriginalMessage({
        content: `Success!`,
        components: [],
      });
    }
  });

bot.connect(); 
